-- Опрос «Кто в каком проекте участвовал» + авто-предложения для апрува зам.дир.
--
-- Две таблицы:
--   project_survey_responses — ответы сотрудников (один на пользователя)
--   project_survey_proposals — авто-сгенерированные предложения по каждому проекту,
--     которые зам.директор подтверждает или отклоняет.

CREATE TABLE IF NOT EXISTS project_survey_responses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  user_name         TEXT NOT NULL,
  user_role         TEXT,
  status            TEXT NOT NULL DEFAULT 'draft', -- draft | submitted
  answers           JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS project_survey_proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        TEXT NOT NULL,           -- TEXT, т.к. id проекта в этой системе строковый
  project_name      TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  proposed_team     JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_status   TEXT,                    -- in_progress | completed | cancelled
  status_votes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  respondents_count INTEGER NOT NULL DEFAULT 0,
  participants_count INTEGER NOT NULL DEFAULT 0,
  confidence        TEXT,                    -- low | medium | high
  reviewed_by       TEXT,
  reviewed_by_name  TEXT,
  reviewed_at       TIMESTAMPTZ,
  applied_at        TIMESTAMPTZ,
  override_notes    TEXT,
  generated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id)
);

CREATE TABLE IF NOT EXISTS project_survey_config (
  id            TEXT PRIMARY KEY DEFAULT 'default',
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  title         TEXT NOT NULL DEFAULT 'Опрос по участию в проектах',
  description   TEXT,
  deadline      TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  started_by    TEXT,
  started_by_name TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO project_survey_config (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- RLS — открытый доступ, т.к. демо-юзеры без auth (как у attendance)
ALTER TABLE project_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_survey_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_survey_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "survey_responses_read"   ON project_survey_responses FOR SELECT USING (true);
CREATE POLICY "survey_responses_insert" ON project_survey_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "survey_responses_update" ON project_survey_responses FOR UPDATE USING (true);
CREATE POLICY "survey_responses_delete" ON project_survey_responses FOR DELETE USING (true);

CREATE POLICY "survey_proposals_read"   ON project_survey_proposals FOR SELECT USING (true);
CREATE POLICY "survey_proposals_insert" ON project_survey_proposals FOR INSERT WITH CHECK (true);
CREATE POLICY "survey_proposals_update" ON project_survey_proposals FOR UPDATE USING (true);
CREATE POLICY "survey_proposals_delete" ON project_survey_proposals FOR DELETE USING (true);

CREATE POLICY "survey_config_read"      ON project_survey_config FOR SELECT USING (true);
CREATE POLICY "survey_config_insert"    ON project_survey_config FOR INSERT WITH CHECK (true);
CREATE POLICY "survey_config_update"    ON project_survey_config FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_survey_responses_user_id     ON project_survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_status      ON project_survey_responses(status);
CREATE INDEX IF NOT EXISTS idx_survey_proposals_project_id  ON project_survey_proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_survey_proposals_status      ON project_survey_proposals(status);
