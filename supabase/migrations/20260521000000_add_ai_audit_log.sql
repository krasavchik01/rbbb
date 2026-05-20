-- AI audit log — все вызовы LLM из системы.
--
-- Зачем: аудиторская фирма, нужна прослеживаемость использования AI.
-- Что писать:
--   - кто вызвал (user_id)
--   - какое действие (action: autofill_survey, chat, report, ...)
--   - сколько токенов потрачено и какая модель использовалась
--   - сколько PII было замаскировано (для верификации что маскировка работает)
--   - какой prompt_hash (SHA-256 от MASKED-промпта, для дедупа и сверки)
--   - что AI вернул (краткая выжимка, не полный ответ)
--
-- Что НЕ писать:
--   - реальные ФИО клиентов в открытом виде в prompt_preview (только хвост ID и стат)
--   - cекреты / API ключи

CREATE TABLE IF NOT EXISTS ai_audit_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL,
  user_name           TEXT,
  user_role           TEXT,
  action              TEXT NOT NULL,         -- 'autofill_survey' | 'chat' | 'report' | ...
  model               TEXT NOT NULL,         -- claude-haiku-4-5 / claude-opus-4-7 / ...
  status              TEXT NOT NULL,         -- 'success' | 'error'
  error_message       TEXT,
  -- Токены
  input_tokens        INTEGER DEFAULT 0,
  output_tokens       INTEGER DEFAULT 0,
  cache_read_tokens   INTEGER DEFAULT 0,
  cache_write_tokens  INTEGER DEFAULT 0,
  cost_estimate_usd   NUMERIC(10, 6),        -- оценка стоимости в долларах
  -- Маскировка
  pii_masked_count    INTEGER DEFAULT 0,     -- сколько ФИО/проектов было замаскировано
  pii_masked_breakdown JSONB,                -- { users: N, clients: N, managers: N, partners: N }
  -- Tool use
  tools_called        JSONB,                 -- [{ name, count }] какие tools и сколько раз
  tool_calls_count    INTEGER DEFAULT 0,
  -- Что отправляли/получали
  prompt_hash         TEXT,                  -- SHA-256 от masked-промпта
  response_summary    TEXT,                  -- краткое описание ответа (≤ 500 chars)
  request_metadata    JSONB,                 -- дополнительно (target user, context size, ...)
  -- Длительность
  duration_ms         INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_user_id      ON ai_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_action       ON ai_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_ai_audit_status       ON ai_audit_log(status);
CREATE INDEX IF NOT EXISTS idx_ai_audit_created_at   ON ai_audit_log(created_at DESC);

-- RLS — открытый доступ (как у остальных таблиц проекта), фильтрация
-- по ролям делается в приложении. Удаления и UPDATE запрещены —
-- audit log должен быть append-only.
ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_audit_log_read"   ON ai_audit_log FOR SELECT USING (true);
CREATE POLICY "ai_audit_log_insert" ON ai_audit_log FOR INSERT WITH CHECK (true);
-- Update и delete НЕ разрешены — append-only.
