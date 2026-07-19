import { NextResponse } from "next/server";
import { getQboConnectionStatus, refreshQboTokens } from "@/lib/qbo";
import { notifyOps } from "@/lib/lark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel cron (see vercel.json): weekly QuickBooks token keepalive. Intuit
// refresh tokens die ~100 days after issue; refreshing weekly means the
// connection never idles out between invoices. Lark-warns when disconnected
// or when the refresh-token expiry is inside 14 days despite the refresh.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getQboConnectionStatus();
  if (!status.connected) {
    // Not connected is a normal state until Dave runs the connect flow once —
    // no alarm, just report.
    return NextResponse.json({ connected: false });
  }

  const result = await refreshQboTokens();
  if (!result.ok) {
    await notifyOps(
      `⚠️ QuickBooks token refresh failed (${result.error}). Client invoicing will degrade to manual until reconnected: https://www.edge8.ai/admin/settings/quickbooks`,
    );
    return NextResponse.json({ connected: true, refreshed: false, error: result.error }, { status: 500 });
  }

  const after = await getQboConnectionStatus();
  if (after.connected) {
    const daysLeft = (new Date(after.refreshTokenExpiresAt).getTime() - Date.now()) / 86_400_000;
    if (daysLeft < 14) {
      await notifyOps(
        `⚠️ QuickBooks refresh token expires in ${Math.floor(daysLeft)} days — reconnect at https://www.edge8.ai/admin/settings/quickbooks`,
      );
    }
  }
  return NextResponse.json({ connected: true, refreshed: true });
}
