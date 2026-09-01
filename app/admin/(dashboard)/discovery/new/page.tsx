import { PageHead } from "@/components/admin/PageHead";
import { listAssignablePeople } from "@/lib/admin/people-options";
import { NewEngagementForm } from "./NewEngagementForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "New Discovery Review" };

export default async function NewDiscoveryPage() {
  const people = await listAssignablePeople();
  return (
    <>
      <PageHead eyebrow="Payroll 360" title="New Discovery Review" />
      <div className="admin-content admin-content--form">
        <NewEngagementForm people={people} />
      </div>
    </>
  );
}
