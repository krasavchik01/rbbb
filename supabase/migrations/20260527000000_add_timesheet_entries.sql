-- Таймщиты с подтверждением партнёра.
--
-- Одна строка = один день × одна секция × один сотрудник × один проект.
-- Это позволяет партнёру видеть детализацию (когда, где, какая секция, сколько часов)
-- и точечно подтверждать / отклонять записи.
--
-- Источники данных (source):
--   'import'  — построчная запись из xlsx-импорта (ImportTimesheet)
--   'manual'  — ручной ввод сотрудника на странице Timesheets
--   'survey'  — добавлено через опрос «кто в каком проекте» (manual section в ProjectSurvey)
--
-- Жизненный цикл (status):
--   'draft'      — черновик сотрудника
--   'submitted'  — отправлено партнёру/зам.директору
--   'approved'   — подтверждено (часы идут в расчёт бонуса)
--   'rejected'   — отклонено (сотрудник правит → снова submitted)
--
-- Routing подтверждения (не в БД, в приложении):
--   project.partner_id есть → апрувит партнёр
--   нет (или project_id NULL — админ-работа) → апрувит зам.директор
--
-- Идемпотентность повторного xlsx-импорта: реализуется в коде через
--   DELETE WHERE import_batch_id = $hash AND source = 'import'
-- перед INSERT (а не UNIQUE-индексом, чтобы не блокировать ручное редактирование).

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Кто работал. employee_name — snapshot на момент создания (на случай rename).
  employee_id       TEXT NOT NULL,
  employee_name     TEXT NOT NULL,

  -- На каком проекте. NULL = админ-работа / без проекта (апрув идёт к зам.дир).
  project_id        TEXT,
  project_name      TEXT NOT NULL,

  -- День и часы — основа записи.
  work_date         DATE NOT NULL,
  hours             NUMERIC(6, 2) NOT NULL DEFAULT 0,

  -- Детализация (что парсит timesheetImport.ts из xlsx-колонок).
  section           TEXT,             -- "Денежные средства", "Дебиторская задолженность", ...
  position          TEXT,             -- должность сотрудника на проекте
  location          TEXT,             -- офис / выезд / удалённо
  city              TEXT,             -- Алматы / Астана / ...
  manager_raw       TEXT,             -- кого сотрудник записал руководителем (для контроля расхождений)
  partner_raw       TEXT,             -- то же, для партнёра (сверка с project.partner_id)
  notes             TEXT,             -- свободный текст

  -- Источник и трассировка.
  source            TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'import' | 'survey'
  import_batch_id   TEXT,                            -- хэш xlsx-файла (для отката пачки)

  -- Workflow подтверждения.
  status            TEXT NOT NULL DEFAULT 'submitted', -- 'draft' | 'submitted' | 'approved' | 'rejected'
  reviewed_by       TEXT,
  reviewed_by_name  TEXT,
  reviewed_at       TIMESTAMPTZ,
  reviewer_notes    TEXT,

  created_by        TEXT,             -- кто создал запись (employee_id для self-report, импортёр для bulk)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы под основные сценарии чтения.
CREATE INDEX IF NOT EXISTS idx_ts_entries_employee_date  ON timesheet_entries(employee_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_ts_entries_project_status ON timesheet_entries(project_id, status);
CREATE INDEX IF NOT EXISTS idx_ts_entries_status         ON timesheet_entries(status);
CREATE INDEX IF NOT EXISTS idx_ts_entries_batch          ON timesheet_entries(import_batch_id) WHERE import_batch_id IS NOT NULL;

-- Автообновление updated_at при UPDATE.
CREATE OR REPLACE FUNCTION trg_timesheet_entries_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS timesheet_entries_set_updated_at ON timesheet_entries;
CREATE TRIGGER timesheet_entries_set_updated_at
  BEFORE UPDATE ON timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION trg_timesheet_entries_set_updated_at();

-- RLS — открытый доступ, как у остальных таблиц проекта (auth ещё не подключен,
-- фильтрация делается в приложении). Ужесточить вместе с фазой 1.5 PLAN.md.
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheet_entries_read"   ON timesheet_entries FOR SELECT USING (true);
CREATE POLICY "timesheet_entries_insert" ON timesheet_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "timesheet_entries_update" ON timesheet_entries FOR UPDATE USING (true);
CREATE POLICY "timesheet_entries_delete" ON timesheet_entries FOR DELETE USING (true);
