// Shared row shape + helpers for the invoices ledger (server page + client shelf).
// No server imports here — the shelf is a client component.

export type InvoiceLine = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  item_name: string;
};

export type InvoiceListRow = {
  id: string;
  external_id: string;
  doc_number: string | null;
  txn_date: string;
  due_date: string | null;
  currency: string;
  amount_cents: number;
  balance_cents: number;
  status: string;
  memo: string | null;
  customer_name: string | null;
  lines: InvoiceLine[];
  company_id: string;
  companies: {
    name: string;
    person_companies: Array<{ is_primary: boolean; people: { id: string; full_name: string | null } | null }>;
  } | null;
};

export const INVOICE_SELECT =
  "id, external_id, doc_number, txn_date, due_date, currency, amount_cents, balance_cents, status, memo, customer_name, lines, company_id, companies(name, person_companies(is_primary, people(id, full_name)))";

// Same convention as portal-assume: the is_primary link wins, else the first.
export function primaryContact(row: InvoiceListRow): { id: string; full_name: string | null } | null {
  const links = row.companies?.person_companies ?? [];
  const best = links.find((l) => l.is_primary) ?? links[0] ?? null;
  return best?.people ?? null;
}

// QBO deep link, matching the `link` field the QBO MCP returns per invoice:
// the txnId is the numeric suffix of our external_id, the realm id is the
// QuickBooks company ("Talent Edge LLC").
const QBO_REALM_ID = "9341452654454281";

export function qboInvoiceUrl(externalId: string): string {
  const txnId = externalId.split(":").pop() ?? "";
  return `https://qbo.intuit.com/app/login?pagereq=${encodeURIComponent(`invoice?txnId=${txnId}`)}&deeplinkcompanyid=${QBO_REALM_ID}`;
}
