-- AI-чат: разговоры, сообщения, долговременная память.
--
-- ai_chat_conversations — каждый чат-сессия пользователя (можно много чатов на юзера)
-- ai_chat_messages       — сообщения внутри чата (role: user/assistant/tool, + metadata)
-- ai_memory              — долговременная память AI (key → value, scope: 'user' | 'workspace')
--                          AI пишет сюда заметки сам через tool save_memory, читает при старте.
--                          Так «ничего не забывает» между сессиями.

CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  user_name       TEXT,
  user_role       TEXT,
  title           TEXT,                      -- авто-генерится по первому сообщению
  message_count   INTEGER NOT NULL DEFAULT 0,
  total_tokens_in INTEGER NOT NULL DEFAULT 0,
  total_tokens_out INTEGER NOT NULL DEFAULT 0,
  total_cost_usd  NUMERIC(10, 6) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_conv_user  ON ai_chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conv_updated ON ai_chat_conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,             -- 'user' | 'assistant' | 'tool'
  content         JSONB NOT NULL,            -- Anthropic content blocks (text/tool_use/tool_result)
  tokens_in       INTEGER DEFAULT 0,
  tokens_out      INTEGER DEFAULT 0,
  cache_read      INTEGER DEFAULT 0,
  cache_write     INTEGER DEFAULT 0,
  stop_reason     TEXT,
  tool_calls      JSONB,                     -- {name, input} для удобства фильтрации
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_msg_conv    ON ai_chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_chat_msg_created ON ai_chat_messages(created_at DESC);

-- Долговременная память. Scope:
--   'workspace' — общая для всех (например, «в этой фирме принято считать часы по 30-минутным блокам»)
--   'user:<userId>' — личная для конкретного пользователя
-- Ключ — короткий слаг, value — короткий текст (≤ 1000 символов рекомендуется).
CREATE TABLE IF NOT EXISTS ai_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       TEXT NOT NULL,                 -- 'workspace' | 'user:<userId>'
  memory_key  TEXT NOT NULL,                 -- короткий слаг, уникальный в рамках scope
  content     TEXT NOT NULL,
  importance  INTEGER NOT NULL DEFAULT 5,    -- 1-10, AI решает сам при записи
  created_by  TEXT,                          -- userId или 'ai_auto'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,                   -- опциональный TTL
  UNIQUE (scope, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_memory_scope     ON ai_memory(scope);
CREATE INDEX IF NOT EXISTS idx_ai_memory_importance ON ai_memory(importance DESC);

-- RLS — открытый доступ, фильтрация в приложении
ALTER TABLE ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memory             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_chat_conv_all"  ON ai_chat_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "ai_chat_msg_all"   ON ai_chat_messages      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "ai_memory_all"     ON ai_memory             FOR ALL USING (true) WITH CHECK (true);
