import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The hub has no Overview tab; opening a client lands on the Work Board.
export default function TeamClientHubIndex({ params }: { params: { companyId: string } }) {
  redirect(`/team/clients/${params.companyId}/board`);
}
