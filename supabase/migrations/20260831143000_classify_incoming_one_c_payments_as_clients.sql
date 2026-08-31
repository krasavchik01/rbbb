-- The bundled 1C exchange exports incoming payment orders. Historical rows
-- without an explicit direction are client receipts, not unknown expenses.
-- A manual classification always remains authoritative in the application.
UPDATE public.one_c_accounting_records
SET auto_scope = 'project',
    scope_updated_at = now()
WHERE kind = 'payment'
  AND COALESCE(normalized_record ->> 'accountingDirection', 'unknown')
      IN ('', 'unknown', 'customer', 'incoming');
