import Link from "next/link";
import type { ReactNode } from "react";
import { mergeQuery, type SearchParamsObj } from "@/lib/admin/url";
import { TableSearch } from "./TableSearch";
import { PreviewRow } from "./PreviewRow";

export type Column<T> = {
  key: string;
  header: string;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "right";
  className?: string;
};

// When provided, the whole row is clickable and opens this content in the side
// car (DetailDrawer). Rendered server-side, so cells/body can use any component.
export type RowPreview = { title: ReactNode; eyebrow?: ReactNode; body: ReactNode };

// Server component. URL-driven: sortable headers and pagination are plain
// <Link>s (no client JS); only the search box is a client island. Column cell
// renderers run server-side, so they never need to be serialized.
export function DataTable<T extends { id?: string | number }>({
  columns,
  rows,
  total,
  page,
  pageSize,
  sort,
  dir,
  basePath,
  searchParams,
  searchPlaceholder,
  emptyText = "No records.",
  filterBar,
  getRowPreview,
}: {
  columns: Column<T>[];
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  sort?: string;
  dir?: "asc" | "desc";
  basePath: string;
  searchParams: SearchParamsObj;
  searchPlaceholder?: string;
  emptyText?: string;
  filterBar?: ReactNode;
  getRowPreview?: (row: T) => RowPreview;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function headerContent(col: Column<T>): ReactNode {
    if (!col.sortable) return col.header;
    const active = sort === col.key;
    const nextDir = active && dir !== "desc" ? "desc" : "asc";
    const href = basePath + mergeQuery(searchParams, { sort: col.key, dir: nextDir, page: 1 });
    return (
      <Link href={href}>
        {col.header}
        {active ? (dir === "desc" ? " ↓" : " ↑") : ""}
      </Link>
    );
  }

  return (
    <div>
      <div className="admin-toolbar">
        <TableSearch basePath={basePath} searchParams={searchParams} placeholder={searchPlaceholder} />
        {filterBar}
      </div>

      <div className="admin-table-wrap">
        <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={c.align === "right" ? { textAlign: "right" } : undefined}>
                  {headerContent(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="admin-empty">{emptyText}</div>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const cells = columns.map((c) => (
                  <td
                    key={c.key}
                    className={c.className}
                    style={c.align === "right" ? { textAlign: "right" } : undefined}
                  >
                    {c.cell ? c.cell(row) : ((row as Record<string, unknown>)[c.key] as ReactNode) ?? "—"}
                  </td>
                ));
                if (getRowPreview) {
                  const p = getRowPreview(row);
                  return (
                    <PreviewRow key={row.id ?? i} title={p.title} eyebrow={p.eyebrow} preview={p.body}>
                      {cells}
                    </PreviewRow>
                  );
                }
                return <tr key={row.id ?? i}>{cells}</tr>;
              })
            )}
          </tbody>
        </table>
        </div>

        {total > 0 && (
          <div className="admin-pagination">
            <span>
              {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
            </span>
            <div className="admin-pagination-controls">
              <Link
                className="admin-pagebtn"
                aria-disabled={page <= 1}
                href={basePath + mergeQuery(searchParams, { page: Math.max(1, page - 1) })}
              >
                Prev
              </Link>
              <span className="admin-pagebtn" aria-disabled style={{ pointerEvents: "none" }}>
                {page} / {totalPages}
              </span>
              <Link
                className="admin-pagebtn"
                aria-disabled={page >= totalPages}
                href={basePath + mergeQuery(searchParams, { page: Math.min(totalPages, page + 1) })}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
