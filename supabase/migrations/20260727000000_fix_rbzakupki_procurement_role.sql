-- Restore the procurement role for the shared procurement employee record.
-- The exact id + email guard prevents broad role changes if live data drifts.
DO $$
DECLARE
  matching_employees integer;
BEGIN
  SELECT count(*)
  INTO matching_employees
  FROM public.employees
  WHERE id = '615aae11-42ec-49af-9933-f2a85bcb864a'::uuid
    AND lower(email) = lower('rbzakupki@rbpartners.kz');

  IF matching_employees <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one rbzakupki employee, found %',
      matching_employees;
  END IF;

  UPDATE public.employees
  SET
    role = 'procurement',
    level = '1',
    updated_at = now()
  WHERE id = '615aae11-42ec-49af-9933-f2a85bcb864a'::uuid
    AND lower(email) = lower('rbzakupki@rbpartners.kz')
    AND (
      role IS DISTINCT FROM 'procurement'
      OR level IS DISTINCT FROM '1'
    );
END
$$;
