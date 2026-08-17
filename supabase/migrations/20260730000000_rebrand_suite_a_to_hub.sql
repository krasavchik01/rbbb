DO $$
BEGIN
  IF to_regclass('public.email_settings') IS NOT NULL THEN
    UPDATE public.email_settings
    SET from_name = 'HUB',
        updated_at = NOW()
    WHERE lower(trim(from_name)) IN ('suite-a', 'suite a', 'suite_a');
  END IF;
END $$;

-- Older installations store SMTP configuration inside app_settings.companies.
-- Keep that compatibility storage, but update the customer-facing sender name.
DO $$
DECLARE
  companies_type TEXT;
BEGIN
  SELECT data_type
  INTO companies_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'app_settings'
    AND column_name = 'companies';

  IF companies_type = 'json' THEN
    EXECUTE $sql$
      UPDATE public.app_settings
      SET companies = (
        jsonb_set(companies::jsonb, '{emailSettings,fromName}', '"HUB"'::jsonb, true)
      )::json
      WHERE lower(trim(companies::jsonb #>> '{emailSettings,fromName}'))
        IN ('suite-a', 'suite a', 'suite_a')
    $sql$;
  ELSIF companies_type = 'jsonb' THEN
    EXECUTE $sql$
      UPDATE public.app_settings
      SET companies = jsonb_set(companies, '{emailSettings,fromName}', '"HUB"'::jsonb, true)
      WHERE lower(trim(companies #>> '{emailSettings,fromName}'))
        IN ('suite-a', 'suite a', 'suite_a')
    $sql$;
  END IF;
END $$;
