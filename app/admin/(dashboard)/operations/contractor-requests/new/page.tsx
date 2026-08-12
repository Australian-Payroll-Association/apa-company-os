import { PageHead } from "@/components/admin/PageHead";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { listContractors } from "../../contractors/data";
import { NewRequestForm } from "./NewRequestForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New Work Request",
  description: "Send a work request to a contractor.",
};

export default async function NewWorkRequestPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const { rows, error } = await listContractors();
  const preselect = firstParam(searchParams.person);
  const contractors = rows
    .filter((r) => r.status === "active")
    .map((r) => ({ personId: r.person_id, label: r.full_name || r.email, hasRate: r.hourly_rate_cents !== null }));

  return (
    <>
      <PageHead
        eyebrow="Operations · Work Requests"
        title="New work request"
        sub="The contractor gets an email with a private link to estimate the work."
      />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="admin-content--form">
        <NewRequestForm
          contractors={contractors}
          defaultPersonId={contractors.some((c) => c.personId === preselect) ? preselect : undefined}
        />
      </div>
    </>
  );
}
