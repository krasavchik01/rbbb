-- Global access settings are readable by the application, but only a real
-- Supabase-authenticated employee with the admin role may update them directly.
-- The legacy-compatible server endpoint verifies the employee again and writes
-- with the service role, so old accounts remain supported without weakening RLS.

DROP POLICY IF EXISTS "Allow authenticated users to update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Only administrators can update app_settings" ON public.app_settings;

CREATE POLICY "Only administrators can update app_settings"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees employee
      WHERE lower(employee.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        AND employee.role::text = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees employee
      WHERE lower(employee.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        AND employee.role::text = 'admin'
    )
  );
