-- Движок опросов: кампании с настраиваемыми вопросами.
-- Старые таблицы project_survey_* остаются как legacy.

CREATE TABLE IF NOT EXISTS survey_campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  template      TEXT,             -- 'where_worked' | 'project_status' | 'confirm_team' | 'custom'
  scope         TEXT NOT NULL DEFAULT 'general',
                                 -- 'general'           — общие вопросы, без привязки к проекту
                                 -- 'project_picker'    — пользователь сам добавляет проекты в список
                                 -- 'my_projects'       — система подставляет проекты пользователя
  audience      JSONB NOT NULL DEFAULT '{"mode":"all"}'::jsonb,
                                 -- {mode: 'all'} | {mode: 'roles', roles: ['partner', ...]}
                                 -- | {mode: 'users', userIds: [...]}
  questions     JSONB NOT NULL DEFAULT '[]'::jsonb,
                                 -- [{id, type, label, hint?, required?, options?}]
  status        TEXT NOT NULL DEFAULT 'draft',
                                 -- 'draft' | 'active' | 'closed'
  deadline      TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  closed_at     TIMESTAMPTZ,
  created_by    TEXT,
  created_by_name TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES survey_campaigns(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  user_name     TEXT NOT NULL,
  user_role     TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',     -- 'draft' | 'submitted'
  -- Для scope='general' хранится один answers-объект; для project-скоупов — массив записей.
  -- В обоих случаях шаблон: { items: [{ projectId?, projectName?, values: { [questionId]: any } }] }
  payload       JSONB NOT NULL DEFAULT '{"items":[]}'::jsonb,
  submitted_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_submissions_campaign ON survey_submissions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_survey_submissions_user     ON survey_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_campaigns_status     ON survey_campaigns(status);

ALTER TABLE survey_campaigns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "survey_campaigns_rw"   ON survey_campaigns   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "survey_submissions_rw" ON survey_submissions FOR ALL USING (true) WITH CHECK (true);
