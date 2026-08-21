-- Durable service-only 1C inbox and per-batch audit ledger. Project notes remain
-- the operational accounting view; rejected source rows are counted, never stored.

-- Keep the mutable 1C secret and sync history outside app_settings.companies.
-- Several existing settings writers replace that JSON envelope as a whole; a
-- dedicated CAS-protected singleton prevents them from erasing accounting state.
CREATE TABLE IF NOT EXISTS public.one_c_accounting_state (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  state JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(state) = 'object'),
  revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-time rollout copy. Some clean/older installations do not yet have the
-- legacy companies column, so reference it only through guarded dynamic SQL.
-- ON CONFLICT DO NOTHING is intentional: reapplying the migration must never
-- overwrite a newer dedicated secret/history with legacy JSON.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_settings'
      AND column_name = 'companies'
  ) THEN
    EXECUTE $copy_legacy_state$
      INSERT INTO public.one_c_accounting_state (id, state)
      SELECT
        'default',
        COALESCE((
          SELECT CASE
            WHEN jsonb_typeof(companies::jsonb) = 'object'
             AND jsonb_typeof(companies::jsonb -> 'oneCAccounting') = 'object'
            THEN companies::jsonb -> 'oneCAccounting'
            ELSE '{}'::jsonb
          END
          FROM public.app_settings
          LIMIT 1
        ), '{}'::jsonb)
      ON CONFLICT (id) DO NOTHING
    $copy_legacy_state$;
  ELSE
    INSERT INTO public.one_c_accounting_state (id, state)
    VALUES ('default', '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$$;

COMMENT ON TABLE public.one_c_accounting_state IS
  'Service-only singleton containing the 1C integration secret and sync state.';

CREATE TABLE IF NOT EXISTS public.one_c_accounting_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('invoice', 'avr', 'esf', 'payment')),
  external_id TEXT NOT NULL,
  normalized_record JSONB NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL CHECK (match_status IN ('matched', 'unmatched')),
  match_reason TEXT NOT NULL DEFAULT '',
  match_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_c_accounting_records_source_kind_external_key
    UNIQUE (source, kind, external_id),
  CONSTRAINT one_c_accounting_records_candidates_array
    CHECK (jsonb_typeof(match_candidates) = 'array')
);

ALTER TABLE public.one_c_accounting_records
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS one_c_accounting_records_project_idx
  ON public.one_c_accounting_records (project_id);
CREATE INDEX IF NOT EXISTS one_c_accounting_records_unmatched_cursor_idx
  ON public.one_c_accounting_records (id)
  WHERE match_status = 'unmatched' AND project_id IS NULL;
CREATE INDEX IF NOT EXISTS one_c_accounting_records_active_unmatched_cursor_idx
  ON public.one_c_accounting_records (id)
  WHERE is_active = true AND match_status = 'unmatched' AND project_id IS NULL;
CREATE INDEX IF NOT EXISTS one_c_accounting_records_active_snapshot_idx
  ON public.one_c_accounting_records (source, last_seen_at, id)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS one_c_accounting_records_match_status_idx
  ON public.one_c_accounting_records (match_status, match_reason);
CREATE INDEX IF NOT EXISTS one_c_accounting_records_kind_idx
  ON public.one_c_accounting_records (kind);
CREATE INDEX IF NOT EXISTS one_c_accounting_records_last_seen_idx
  ON public.one_c_accounting_records (last_seen_at DESC);

COMMENT ON TABLE public.one_c_accounting_records IS
  'Service-written durable inbox of normalized accounting records received from 1C.';
COMMENT ON COLUMN public.one_c_accounting_records.normalized_record IS
  'Normalized accepted 1C record used by HUB matching and project-note merge.';
COMMENT ON COLUMN public.one_c_accounting_records.match_candidates IS
  'Candidate project identifiers captured when automatic matching is ambiguous.';

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
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS one_c_accounting_record_project_deleted
  ON public.one_c_accounting_records;
CREATE TRIGGER one_c_accounting_record_project_deleted
BEFORE UPDATE OF project_id ON public.one_c_accounting_records
FOR EACH ROW
EXECUTE FUNCTION public.one_c_accounting_record_project_deleted();

REVOKE ALL ON FUNCTION public.one_c_accounting_record_project_deleted()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.one_c_accounting_record_project_deleted()
  TO service_role;

-- If this migration is reapplied after the table has already received rows,
-- repair matches whose project was removed before the trigger existed.
UPDATE public.one_c_accounting_records
SET match_status = 'unmatched',
    match_reason = 'project_deleted',
    match_candidates = '[]'::jsonb,
    updated_at = now()
WHERE project_id IS NULL
  AND match_status = 'matched';

CREATE TABLE IF NOT EXISTS public.one_c_sync_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  run_id TEXT NOT NULL,
  batch_index INTEGER NOT NULL CHECK (batch_index >= 0),
  batch_count INTEGER NOT NULL CHECK (batch_count >= 1),
  raw_count INTEGER NOT NULL DEFAULT 0 CHECK (raw_count >= 0),
  accepted_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  rejected_count INTEGER NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  rejected_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  matched_count INTEGER NOT NULL DEFAULT 0 CHECK (matched_count >= 0),
  unmatched_count INTEGER NOT NULL DEFAULT 0 CHECK (unmatched_count >= 0),
  unmatched_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_projects INTEGER NOT NULL DEFAULT 0 CHECK (updated_projects >= 0),
  updated_project_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  full_snapshot BOOLEAN NOT NULL DEFAULT false,
  snapshot_since DATE,
  snapshot_captured_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  error_message TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_c_sync_batches_source_run_batch_key
    UNIQUE (source, run_id, batch_index),
  CONSTRAINT one_c_sync_batches_status_check
    CHECK (status IN ('processing', 'skipped', 'success', 'error')),
  CONSTRAINT one_c_sync_batches_rejected_reasons_object
    CHECK (jsonb_typeof(rejected_reasons) = 'object'),
  CONSTRAINT one_c_sync_batches_unmatched_reasons_object
    CHECK (jsonb_typeof(unmatched_reasons) = 'object'),
  CONSTRAINT one_c_sync_batches_updated_project_ids_array
    CHECK (jsonb_typeof(updated_project_ids) = 'array')
);

ALTER TABLE public.one_c_sync_batches
  ADD COLUMN IF NOT EXISTS updated_project_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS full_snapshot BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS snapshot_since DATE,
  ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;

-- Existing installations have the original success/error-only check. Replace
-- it idempotently before the API starts writing pre-mutation reservations.
ALTER TABLE public.one_c_sync_batches
  DROP CONSTRAINT IF EXISTS one_c_sync_batches_status_check;
ALTER TABLE public.one_c_sync_batches
  ADD CONSTRAINT one_c_sync_batches_status_check
  CHECK (status IN ('processing', 'skipped', 'success', 'error'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'one_c_sync_batches_updated_project_ids_array'
      AND conrelid = 'public.one_c_sync_batches'::regclass
  ) THEN
    ALTER TABLE public.one_c_sync_batches
      ADD CONSTRAINT one_c_sync_batches_updated_project_ids_array
      CHECK (jsonb_typeof(updated_project_ids) = 'array');
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS one_c_sync_batches_latest_idx
  ON public.one_c_sync_batches (completed_at DESC);
CREATE INDEX IF NOT EXISTS one_c_sync_batches_run_idx
  ON public.one_c_sync_batches (source, run_id, batch_index);
CREATE INDEX IF NOT EXISTS one_c_sync_batches_snapshot_guard_idx
  ON public.one_c_sync_batches (source, snapshot_captured_at DESC)
  WHERE snapshot_captured_at IS NOT NULL;

-- A database-backed source lease closes the gap between the watermark check and
-- the later project/inbox writes. Only one HTTP request for a 1C source may
-- mutate data at a time; a newer request receives a retryable "busy" decision,
-- while an older/equal different run is durably marked skipped. The lease is
-- deliberately longer than the API execution limit so a second worker cannot
-- enter while the first one can still be writing.
CREATE TABLE IF NOT EXISTS public.one_c_sync_source_gates (
  source TEXT PRIMARY KEY,
  latest_snapshot_captured_at TIMESTAMPTZ,
  latest_run_id TEXT,
  has_versioned_snapshot BOOLEAN NOT NULL DEFAULT false,
  active_run_id TEXT,
  active_batch_index INTEGER,
  active_lease_token TEXT,
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.one_c_sync_source_gates
  ADD COLUMN IF NOT EXISTS has_versioned_snapshot BOOLEAN NOT NULL DEFAULT false;

-- Seed the fence from the existing ledger before the API can claim it. NULL
-- capture rows were produced by the rollout fallback; completed_at is their
-- conservative server-side barrier, matching the API's legacy guard.
WITH ranked AS (
  SELECT
    source,
    COALESCE(snapshot_captured_at, completed_at) AS barrier_at,
    run_id,
    BOOL_OR(snapshot_captured_at IS NOT NULL) OVER (PARTITION BY source) AS has_versioned,
    ROW_NUMBER() OVER (
      PARTITION BY source
      ORDER BY COALESCE(snapshot_captured_at, completed_at) DESC
    ) AS position
  FROM public.one_c_sync_batches
  WHERE status = 'success'
)
INSERT INTO public.one_c_sync_source_gates (
  source, latest_snapshot_captured_at, latest_run_id, has_versioned_snapshot
)
SELECT source, barrier_at, run_id, has_versioned
FROM ranked
WHERE position = 1
ON CONFLICT (source) DO UPDATE SET
  latest_snapshot_captured_at = EXCLUDED.latest_snapshot_captured_at,
  latest_run_id = EXCLUDED.latest_run_id,
  has_versioned_snapshot = public.one_c_sync_source_gates.has_versioned_snapshot
    OR EXCLUDED.has_versioned_snapshot,
  updated_at = now()
WHERE public.one_c_sync_source_gates.latest_snapshot_captured_at IS NULL
   OR EXCLUDED.latest_snapshot_captured_at
      > public.one_c_sync_source_gates.latest_snapshot_captured_at;

CREATE OR REPLACE FUNCTION public.reserve_one_c_sync_batch(
  p_batch JSONB,
  p_lease_token TEXT,
  p_lease_seconds INTEGER DEFAULT 900
)
RETURNS TABLE(decision TEXT, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source TEXT := p_batch ->> 'source';
  v_run_id TEXT := p_batch ->> 'run_id';
  v_batch_index INTEGER := (p_batch ->> 'batch_index')::INTEGER;
  v_capture TIMESTAMPTZ := NULLIF(p_batch ->> 'snapshot_captured_at', '')::TIMESTAMPTZ;
  v_versioned BOOLEAN := COALESCE((p_batch ->> 'source_snapshot_versioned')::BOOLEAN, false);
  v_gate public.one_c_sync_source_gates%ROWTYPE;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF v_source IS NULL OR v_source = '' OR v_run_id IS NULL OR v_run_id = ''
     OR v_capture IS NULL OR p_lease_token IS NULL OR p_lease_token = '' THEN
    RAISE EXCEPTION 'invalid 1C atomic reservation';
  END IF;
  IF v_capture > v_now + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION '1C snapshot capture timestamp is too far in the future'
      USING ERRCODE = '22007';
  END IF;

  INSERT INTO public.one_c_sync_source_gates (source)
  VALUES (v_source)
  ON CONFLICT (source) DO NOTHING;

  SELECT * INTO v_gate
  FROM public.one_c_sync_source_gates
  WHERE source = v_source
  FOR UPDATE;

  INSERT INTO public.one_c_sync_batches (
    source, run_id, batch_index, batch_count, raw_count, accepted_count,
    rejected_count, rejected_reasons, matched_count, unmatched_count,
    unmatched_reasons, updated_projects, updated_project_ids, full_snapshot,
    snapshot_since, snapshot_captured_at, status, error_message, started_at,
    completed_at, updated_at
  ) VALUES (
    v_source, v_run_id, v_batch_index, (p_batch ->> 'batch_count')::INTEGER,
    COALESCE((p_batch ->> 'raw_count')::INTEGER, 0),
    COALESCE((p_batch ->> 'accepted_count')::INTEGER, 0),
    COALESCE((p_batch ->> 'rejected_count')::INTEGER, 0),
    COALESCE(p_batch -> 'rejected_reasons', '{}'::JSONB),
    COALESCE((p_batch ->> 'matched_count')::INTEGER, 0),
    COALESCE((p_batch ->> 'unmatched_count')::INTEGER, 0),
    COALESCE(p_batch -> 'unmatched_reasons', '{}'::JSONB),
    COALESCE((p_batch ->> 'updated_projects')::INTEGER, 0),
    COALESCE(p_batch -> 'updated_project_ids', '[]'::JSONB),
    COALESCE((p_batch ->> 'full_snapshot')::BOOLEAN, false),
    NULLIF(p_batch ->> 'snapshot_since', '')::DATE,
    v_capture, 'processing', '',
    (p_batch ->> 'started_at')::TIMESTAMPTZ,
    (p_batch ->> 'started_at')::TIMESTAMPTZ,
    (p_batch ->> 'started_at')::TIMESTAMPTZ
  )
  ON CONFLICT (source, run_id, batch_index) DO UPDATE SET
    raw_count = EXCLUDED.raw_count,
    accepted_count = EXCLUDED.accepted_count,
    rejected_count = EXCLUDED.rejected_count,
    rejected_reasons = EXCLUDED.rejected_reasons,
    full_snapshot = EXCLUDED.full_snapshot,
    snapshot_since = EXCLUDED.snapshot_since,
    snapshot_captured_at = EXCLUDED.snapshot_captured_at,
    status = 'processing',
    error_message = '',
    started_at = EXCLUDED.started_at,
    completed_at = EXCLUDED.completed_at,
    updated_at = EXCLUDED.updated_at;

  IF NOT v_versioned AND v_gate.has_versioned_snapshot THEN
    UPDATE public.one_c_sync_batches
    SET status = 'skipped', error_message = 'upgrade_required',
        completed_at = v_now, updated_at = v_now
    WHERE source = v_source AND run_id = v_run_id AND batch_index = v_batch_index;
    RETURN QUERY SELECT 'skipped'::TEXT, 'upgrade_required'::TEXT;
    RETURN;
  END IF;

  IF v_gate.latest_snapshot_captured_at IS NOT NULL
     AND v_gate.latest_snapshot_captured_at >= v_capture
     AND (
       v_gate.latest_snapshot_captured_at > v_capture
       OR COALESCE(v_gate.latest_run_id, '') <> v_run_id
     ) THEN
    UPDATE public.one_c_sync_batches
    SET status = 'skipped', error_message = 'newer_snapshot_exists',
        completed_at = v_now, updated_at = v_now
    WHERE source = v_source AND run_id = v_run_id AND batch_index = v_batch_index;
    RETURN QUERY SELECT 'skipped'::TEXT, 'newer_snapshot_exists'::TEXT;
    RETURN;
  END IF;

  IF v_gate.active_lease_token IS NOT NULL
     AND v_gate.lease_expires_at > v_now
     AND v_gate.active_lease_token <> p_lease_token THEN
    UPDATE public.one_c_sync_batches
    SET status = 'error', error_message = 'source_busy',
        completed_at = v_now, updated_at = v_now
    WHERE source = v_source AND run_id = v_run_id AND batch_index = v_batch_index;
    RETURN QUERY SELECT 'busy'::TEXT, 'source_busy'::TEXT;
    RETURN;
  END IF;

  UPDATE public.one_c_sync_source_gates
  SET latest_snapshot_captured_at = CASE
        WHEN latest_snapshot_captured_at IS NULL OR v_capture > latest_snapshot_captured_at
        THEN v_capture ELSE latest_snapshot_captured_at END,
      latest_run_id = CASE
        WHEN latest_snapshot_captured_at IS NULL OR v_capture > latest_snapshot_captured_at
        THEN v_run_id ELSE latest_run_id END,
      has_versioned_snapshot = has_versioned_snapshot OR v_versioned,
      active_run_id = v_run_id,
      active_batch_index = v_batch_index,
      active_lease_token = p_lease_token,
      lease_expires_at = v_now + make_interval(secs => GREATEST(60, LEAST(p_lease_seconds, 1800))),
      updated_at = v_now
  WHERE source = v_source;

  RETURN QUERY SELECT 'accepted'::TEXT, ''::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_one_c_sync_source_lease(
  p_source TEXT,
  p_lease_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released_count INTEGER := 0;
BEGIN
  UPDATE public.one_c_sync_source_gates
  SET active_run_id = NULL,
      active_batch_index = NULL,
      active_lease_token = NULL,
      lease_expires_at = NULL,
      updated_at = clock_timestamp()
  WHERE source = p_source AND active_lease_token = p_lease_token;
  GET DIAGNOSTICS v_released_count = ROW_COUNT;
  RETURN v_released_count > 0;
END;
$$;

COMMENT ON TABLE public.one_c_sync_batches IS
  'Service-only audit of every accepted or rejected 1C request batch.';

ALTER TABLE public.one_c_accounting_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_c_sync_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_c_accounting_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_c_sync_source_gates ENABLE ROW LEVEL SECURITY;

-- Browser clients never read either table directly. The authenticated API checks
-- the live projectAccess.accounting permission before returning a bounded subset.
REVOKE ALL ON TABLE public.one_c_accounting_records FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.one_c_sync_batches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.one_c_accounting_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.one_c_sync_source_gates FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.one_c_accounting_records TO service_role;
GRANT ALL ON TABLE public.one_c_sync_batches TO service_role;
GRANT ALL ON TABLE public.one_c_accounting_state TO service_role;
GRANT ALL ON TABLE public.one_c_sync_source_gates TO service_role;
REVOKE ALL ON FUNCTION public.reserve_one_c_sync_batch(JSONB, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_one_c_sync_source_lease(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_one_c_sync_batch(JSONB, TEXT, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_one_c_sync_source_lease(TEXT, TEXT)
  TO service_role;

DROP POLICY IF EXISTS "1C accounting inbox visible to accounting leadership"
  ON public.one_c_accounting_records;
