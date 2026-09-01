import type { SubmissionRow } from "@/lib/admin/newsletter";
import { trainingDateRange } from "@/lib/newsletter";
import { IncludeToggle } from "./EditionControls";

// Training rendered as the Course / Date / Delivery table the newsletter itself
// uses, rather than as cards like the other sections.
//
// The point is that what an editor curates looks like what ships: a missing
// delivery format or a course out of date order is obvious in a table and easy
// to miss in a list. Excluded rows stay visible but dimmed — curation here is a
// decision on the record, not a delete.
//
// Sorted by start date, so the table reads in the order it will be published
// regardless of the order courses were pulled or typed.

export function TrainingTable({ items }: { items: SubmissionRow[] }) {
  const sorted = [...items].sort((a, b) =>
    (a.details.date_from ?? "").localeCompare(b.details.date_from ?? ""),
  );

  return (
    <div className="admin-table-wrap" style={{ marginTop: 12 }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Course</th>
            <th style={{ whiteSpace: "nowrap" }}>Date</th>
            <th>Delivery</th>
            <th style={{ width: 1 }}></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const dates = trainingDateRange(item.details);
            return (
              <tr key={item.id} style={{ opacity: item.included ? 1 : 0.5 }}>
                <td>
                  {item.linkUrl ? (
                    <a href={item.linkUrl} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </td>
                <td className="admin-cell-muted" style={{ whiteSpace: "nowrap" }}>
                  {dates || <span style={{ opacity: 0.6 }}>No date</span>}
                </td>
                <td className="admin-cell-muted">
                  {item.details.format || <span style={{ opacity: 0.6 }}>Not set</span>}
                </td>
                <td style={{ textAlign: "right" }}>
                  <IncludeToggle id={item.id} included={item.included} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
