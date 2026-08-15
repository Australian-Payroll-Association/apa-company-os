-- Revenue must count every synced QuickBooks invoice, mapped or not. AIO
-- customers are mostly individuals with no CRM company, so the NOT NULL on
-- company_id kept the whole AIO ledger out of the mirror (the sync skipped
-- unmapped invoices). Allow company_id to be null: unmapped invoices sync with
-- customer_name only, and a later mapping (companies.metadata.qbo_customer_ids
-- / qbo_customer_ids_aio) attaches them on the next sync pass.
-- See lib/admin/qbo-invoice-sync.ts.

alter table company_os.invoices
  alter column company_id drop not null;
