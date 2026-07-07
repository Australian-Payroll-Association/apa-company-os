import { redirect } from "next/navigation";

// Renamed: /admin/revenue/registrations → /admin/revenue/public-retreats.
// Kept as a redirect so old bookmarks/links keep working.
export const dynamic = "force-dynamic";

export default function RegistrationsRedirect() {
  redirect("/admin/revenue/public-retreats");
}
