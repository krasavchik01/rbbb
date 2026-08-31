-- Separate project/client records from supplier expenses and genuinely unknown
-- counterparties. Manual classification is remembered per 1C counterparty and
-- is never overwritten by a later sync.

ALTER TABLE public.one_c_accounting_records
  ADD COLUMN IF NOT EXISTS auto_scope TEXT NOT NULL DEFAULT 'review',
  ADD COLUMN IF NOT EXISTS manual_scope TEXT,
  ADD COLUMN IF NOT EXISTS scope_updated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'one_c_accounting_records_auto_scope_check'
      AND conrelid = 'public.one_c_accounting_records'::regclass
  ) THEN
    ALTER TABLE public.one_c_accounting_records
      ADD CONSTRAINT one_c_accounting_records_auto_scope_check
      CHECK (auto_scope IN ('project', 'supplier', 'other', 'review'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'one_c_accounting_records_manual_scope_check'
      AND conrelid = 'public.one_c_accounting_records'::regclass
  ) THEN
    ALTER TABLE public.one_c_accounting_records
      ADD CONSTRAINT one_c_accounting_records_manual_scope_check
      CHECK (manual_scope IS NULL OR manual_scope IN ('project', 'supplier', 'other'));
  END IF;
END
$$;

UPDATE public.one_c_accounting_records
SET auto_scope = CASE
      WHEN project_id IS NOT NULL OR match_status = 'matched' THEN 'project'
      WHEN match_reason IN (
        'contract_identity_mismatch',
        'ambiguous_contract',
        'ambiguous_existing_record',
        'project_deleted'
      ) THEN 'project'
      ELSE 'review'
    END,
    scope_updated_at = COALESCE(scope_updated_at, updated_at, now());

CREATE INDEX IF NOT EXISTS one_c_accounting_records_effective_scope_idx
  ON public.one_c_accounting_records ((COALESCE(manual_scope, auto_scope)), id)
  WHERE is_active = true AND project_id IS NULL;

COMMENT ON COLUMN public.one_c_accounting_records.auto_scope IS
  'Automatic project/supplier/other/review classification derived from 1C direction and matching evidence.';
COMMENT ON COLUMN public.one_c_accounting_records.manual_scope IS
  'Accounting-user override. NULL keeps automatic classification; non-NULL survives future syncs.';

CREATE TABLE IF NOT EXISTS public.one_c_counterparty_scopes (
  source TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('project', 'supplier', 'other')),
  organization_name TEXT NOT NULL DEFAULT '',
  organization_bin TEXT NOT NULL DEFAULT '',
  counterparty_name TEXT NOT NULL DEFAULT '',
  counterparty_bin TEXT NOT NULL DEFAULT '',
  classified_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, rule_key)
);

CREATE INDEX IF NOT EXISTS one_c_counterparty_scopes_source_idx
  ON public.one_c_counterparty_scopes (source, updated_at DESC);

COMMENT ON TABLE public.one_c_counterparty_scopes IS
  'Service-only remembered classification of 1C counterparties as projects, suppliers, or other operations.';

CREATE OR REPLACE FUNCTION public.one_c_accounting_record_project_deleted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.project_id IS NOT NULL
     AND NEW.project_id IS NULL
     AND OLD.match_status = 'matched'
     AND NEW.match_status = 'matched' THEN
    NEW.match_status := 'unmatched';
    NEW.match_reason := 'project_deleted';
    NEW.match_candidates := '[]'::jsonb;
    NEW.auto_scope := 'project';
    NEW.scope_updated_at := now();
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.one_c_counterparty_scopes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.one_c_counterparty_scopes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.one_c_counterparty_scopes TO service_role;
