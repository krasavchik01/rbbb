CREATE TABLE IF NOT EXISTS email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host TEXT NOT NULL DEFAULT '',
  port INTEGER NOT NULL DEFAULT 465,
  secure BOOLEAN NOT NULL DEFAULT true,
  username TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  from_email TEXT NOT NULL DEFAULT '',
  from_name TEXT NOT NULL DEFAULT 'HUB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_email_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_settings_updated_at ON email_settings;
CREATE TRIGGER email_settings_updated_at
  BEFORE UPDATE ON email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_email_settings_updated_at();

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct client access to email_settings" ON email_settings;
CREATE POLICY "No direct client access to email_settings"
  ON email_settings
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE email_settings IS 'SMTP settings used only by server-side email API';
COMMENT ON COLUMN email_settings.password IS 'SMTP mailbox password. Never expose to the browser.';
