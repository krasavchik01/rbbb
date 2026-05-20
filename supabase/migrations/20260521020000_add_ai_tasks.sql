-- Задачи, создаваемые AI или пользователями через AI-чат.
--
-- Например: «AI, скажи Иванову подготовить отчёт по Karaton к пятнице» →
-- AI вызывает create_task → запись здесь со status='pending'.
-- Когда подключим канал доставки (Telegram/email) — отправка пойдёт отсюда.

CREATE TABLE IF NOT EXISTS ai_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Кому
  assigned_to     TEXT NOT NULL,             -- employee.id
  assigned_to_name TEXT,
  -- От кого
  created_by      TEXT NOT NULL,             -- employee.id (CEO/admin/deputy)
  created_by_name TEXT,
  -- Содержимое
  title           TEXT NOT NULL,
  description     TEXT,
  priority        TEXT NOT NULL DEFAULT 'medium',  -- low | medium | high | urgent
  related_project_id TEXT,                   -- опционально привязано к проекту
  -- Сроки и статус
  due_date        TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | in_progress | done | cancelled
  completed_at    TIMESTAMPTZ,
  -- Доставка уведомления (заглушка под V2)
  notify_channel  TEXT,                      -- 'telegram' | 'email' | 'inapp' | null
  notified_at     TIMESTAMPTZ,
  -- Аудит
  created_via     TEXT NOT NULL DEFAULT 'ai_chat',  -- ai_chat | manual | ...
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_assigned_to ON ai_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status      ON ai_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_due_date    ON ai_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_created_at  ON ai_tasks(created_at DESC);

ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_tasks_all" ON ai_tasks FOR ALL USING (true) WITH CHECK (true);
