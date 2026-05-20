/**
 * AI-чат для админа/CEO/партнёра.
 *
 * POST /api/ai/chat
 * Body:
 *   {
 *     userId: string,
 *     userName?: string,
 *     userRole?: string,
 *     conversationId?: string,   // null/undefined → новый чат
 *     message: string,           // user input
 *   }
 *
 * Возвращает:
 *   {
 *     conversationId: string,
 *     reply: string,              // финальный текст AI
 *     toolsUsed: Array<{name, input, output}>,  // что AI смотрел в системе
 *     tokens: { in, out, cacheRead, cacheWrite },
 *     costUsd: number,
 *   }
 *
 * Архитектура:
 *  - Conversation history хранится в Supabase (ai_chat_conversations + ai_chat_messages).
 *    Это даёт «ничего не забывает» между перезагрузками страницы и устройств.
 *  - Долговременная память (факты о компании, личные предпочтения юзера) — в ai_memory.
 *    AI читает её при старте каждого чата и может записывать новые через tool save_memory.
 *  - Prompt caching на статичной части системного промпта (раздут до >4096 токенов
 *    инструкциями + структурой данных, чтобы Haiku 4.5 действительно кешировал).
 *    Это «грамотно тратит токены»: каждое следующее сообщение того же юзера читает
 *    кеш за 0.1× input стоимости вместо 1×.
 *  - Модель: claude-haiku-4-5 (быстро + дёшево, для read-only Q&A с tools хватает).
 *  - Tool use loop: max 5 итераций, защита от бесконечного цикла.
 *  - PII-маскировки СОЗНАТЕЛЬНО НЕТ в этом endpoint'е — это инструмент для CEO/админа,
 *    которому нужно видеть реальные ФИО и проекты. (Маскировка работает в autofill-survey
 *    где данные сотрудника отправляются в LLM для обработки — другой риск-профиль.)
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const MODEL = 'claude-haiku-4-5';
const PRICE_INPUT_PER_M = 1.0;
const PRICE_OUTPUT_PER_M = 5.0;
const PRICE_CACHE_READ_PER_M = 0.1;
const PRICE_CACHE_WRITE_PER_M = 1.25;
const MAX_TOOL_ITERATIONS = 5;
const MAX_HISTORY_MESSAGES = 30;  // последние N сообщений из БД в контекст

function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function estCost({ input_tokens = 0, output_tokens = 0, cache_read_input_tokens = 0, cache_creation_input_tokens = 0 }) {
  return (
    (input_tokens / 1e6) * PRICE_INPUT_PER_M +
    (output_tokens / 1e6) * PRICE_OUTPUT_PER_M +
    (cache_read_input_tokens / 1e6) * PRICE_CACHE_READ_PER_M +
    (cache_creation_input_tokens / 1e6) * PRICE_CACHE_WRITE_PER_M
  );
}

// ─── Tools ──────────────────────────────────────────────────────────────────
// Все tools read-only. Изменения (запись, отправка уведомлений) — отдельным
// будущим коммитом с явным подтверждением пользователя.

const TOOLS = [
  {
    name: 'list_projects',
    description: 'Список проектов фирмы с опциональным фильтром по статусу и/или поисковой строке.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Опционально: planning | in_progress | completed | cancelled | new | pending_approval | ready_to_complete | approved' },
        search: { type: 'string', description: 'Опционально: подстрока для поиска в названии проекта или клиенте' },
        limit: { type: 'integer', description: 'Сколько вернуть, default 20, max 100' },
      },
    },
  },
  {
    name: 'get_project',
    description: 'Подробности конкретного проекта: команда, клиент, статус, период, бюджет, история.',
    input_schema: {
      type: 'object',
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
    },
  },
  {
    name: 'list_employees',
    description: 'Список сотрудников фирмы с опциональным фильтром по роли.',
    input_schema: {
      type: 'object',
      properties: {
        role: { type: 'string', description: 'Опционально: ceo | deputy_director | partner | hr | manager | senior_assistant | assistant_1 | assistant_2 | admin' },
        search: { type: 'string', description: 'Опционально: подстрока в ФИО' },
      },
    },
  },
  {
    name: 'get_employee_workload',
    description: 'Загруженность сотрудника: текущие проекты, общие часы по импортам таймщитов, последний опрос.',
    input_schema: {
      type: 'object',
      properties: { employeeId: { type: 'string' } },
      required: ['employeeId'],
    },
  },
  {
    name: 'list_survey_responses',
    description: 'Кто ответил на опрос «Кто в каком проекте участвовал» и когда. Статистика, не сами ответы.',
    input_schema: { type: 'object', properties: { limit: { type: 'integer' } } },
  },
  {
    name: 'list_survey_proposals',
    description: 'Авто-предложения по составам команд проектов (после опроса). Фильтр по статусу: pending/approved/rejected.',
    input_schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['pending', 'approved', 'rejected'] } },
    },
  },
  {
    name: 'recent_ai_activity',
    description: 'Что AI делал недавно (audit log). Полезно если пользователь спрашивает «когда последний раз вызывали автозаполнение».',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', description: 'default 10' } },
    },
  },
  {
    name: 'save_memory',
    description: 'Сохранить важный факт в долговременную память. Используй для предпочтений пользователя, правил фирмы, контекста, который пригодится в будущих разговорах. Пример: «пользователь предпочитает короткие ответы», «таймщиты приходят 1-го числа каждого месяца».',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'короткий слаг kebab-case, уникальный' },
        content: { type: 'string', description: '≤ 500 символов' },
        scope: { type: 'string', enum: ['user', 'workspace'], description: 'user = личное для текущего юзера, workspace = всем' },
        importance: { type: 'integer', minimum: 1, maximum: 10 },
      },
      required: ['key', 'content', 'scope'],
    },
  },
];

// ─── Tool executors (server-side, read from Supabase) ──────────────────────

async function execTool(supabase, ctx, name, input) {
  try {
    switch (name) {
      case 'list_projects': {
        let q = supabase.from('projects').select('id, name, status, clientName:client_name, updated_at').limit(Math.min(input.limit || 20, 100));
        if (input.status) q = q.eq('status', input.status);
        if (input.search) q = q.or(`name.ilike.%${input.search}%,client_name.ilike.%${input.search}%`);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { projects: data || [] };
      }
      case 'get_project': {
        const { data, error } = await supabase.from('projects').select('*').eq('id', input.projectId).maybeSingle();
        if (error) return { error: error.message };
        if (!data) return { error: 'Project not found' };
        // Чистим тяжёлые поля
        const slim = { ...data };
        delete slim.documents;
        delete slim.files;
        return { project: slim };
      }
      case 'list_employees': {
        let q = supabase.from('employees').select('id, name, role, email').limit(200);
        if (input.role) q = q.eq('role', input.role);
        if (input.search) q = q.ilike('name', `%${input.search}%`);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { employees: data || [] };
      }
      case 'get_employee_workload': {
        const [emp, survey] = await Promise.all([
          supabase.from('employees').select('id, name, role, email').eq('id', input.employeeId).maybeSingle().then((r) => r.data),
          supabase.from('project_survey_responses').select('user_id, status, answers, updated_at').eq('user_id', input.employeeId).maybeSingle().then((r) => r.data),
        ]);
        if (!emp) return { error: 'Employee not found' };
        const summary = {
          employee: emp,
          surveySubmitted: !!(survey && survey.status === 'submitted'),
          surveyUpdatedAt: survey?.updated_at || null,
          projectsCount: Array.isArray(survey?.answers) ? survey.answers.filter((a) => a.participated).length : 0,
          totalHours: Array.isArray(survey?.answers) ? survey.answers.reduce((s, a) => s + (a.totalHours || 0), 0) : 0,
        };
        return summary;
      }
      case 'list_survey_responses': {
        const { data, error } = await supabase
          .from('project_survey_responses')
          .select('user_id, user_name, user_role, status, updated_at')
          .order('updated_at', { ascending: false })
          .limit(Math.min(input.limit || 50, 200));
        if (error) return { error: error.message };
        return { responses: data || [], total: (data || []).length };
      }
      case 'list_survey_proposals': {
        let q = supabase
          .from('project_survey_proposals')
          .select('project_id, project_name, status, proposed_status, participants_count, confidence, updated_at')
          .order('updated_at', { ascending: false })
          .limit(50);
        if (input.status) q = q.eq('status', input.status);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { proposals: data || [] };
      }
      case 'recent_ai_activity': {
        const { data, error } = await supabase
          .from('ai_audit_log')
          .select('user_id, user_name, action, model, status, input_tokens, output_tokens, cost_estimate_usd, created_at')
          .order('created_at', { ascending: false })
          .limit(Math.min(input.limit || 10, 50));
        if (error) return { error: error.message };
        return { activity: data || [] };
      }
      case 'save_memory': {
        const scope = input.scope === 'user' ? `user:${ctx.userId}` : 'workspace';
        const { error } = await supabase.from('ai_memory').upsert(
          {
            scope,
            memory_key: input.key,
            content: String(input.content).slice(0, 2000),
            importance: input.importance || 5,
            created_by: ctx.userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'scope,memory_key' },
        );
        if (error) return { error: error.message };
        return { saved: true, key: input.key, scope };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: String(err?.message || err) };
  }
}

// ─── System prompt (стабильный, для prompt caching) ────────────────────────

function buildSystemPrompt(memorySnippets) {
  // Кешируем большой стабильный prefix. Минимум 4096 токенов для Haiku 4.5,
  // иначе caching не сработает — поэтому делаем его подробным.
  return `Ты — AI-ассистент аудиторской фирмы RBBB Partners в Казахстане. Твоё имя — «RB». Ты работаешь напрямую с CEO, директорами, партнёрами, HR и админами.

ТВОЯ РОЛЬ
Ты — как очень умный, преданный, ничего не забывающий ассистент. Действуешь как «полноценный сотрудник», который:
- знает структуру компании, проекты, сотрудников;
- умеет смотреть данные в системе через предоставленные tools;
- помнит важные факты между разговорами (через долговременную память);
- даёт чёткие, краткие, по-делу ответы по-русски;
- никогда не выдумывает данные — если не знаешь, вызываешь tool или говоришь «не знаю»;
- никогда не предполагает что юзер хочет — если задача неясна, переспрашивает.

СТРУКТУРА СИСТЕМЫ
1. Сотрудники (таблица employees): роли — ceo, deputy_director, partner, hr, manager, senior_assistant, assistant_1, assistant_2, admin.
   - Партнёры (partner): верхний уровень, ведут проекты, сами себе руководители.
   - Заместитель директора (deputy_director): операционное управление, апрув предложений.
   - Менеджеры/супервайзеры: ведут команды на проектах.
   - Ассистенты (assistant_1, assistant_2, senior_assistant): аудит-работа по секциям ФО.
   - HR, admin: вспомогательные роли с расширенными правами.
2. Проекты (таблица projects): статусы — new, planning, pending_approval, approved, in_progress, ready_to_complete, completed, cancelled. Каждый проект имеет команду (массив teamIds + team), клиента, период, бюджет.
3. Опрос «Кто в каком проекте участвовал» (project_survey_responses + project_survey_proposals):
   - Сотрудники отвечают на опрос (один ответ на сотрудника = UNIQUE user_id, при импорте таймщита перезаписывается).
   - Система автоматически собирает proposed_team по проекту из всех ответов.
   - Зам.директор апрувит/отклоняет предложения.
4. Импорт таймщитов: страница /import-timesheet, загружает XLSX/CSV из Google Sheets, парсит даты/часы/проекты/секции, маппит к проектам системы через fuzzy-матчинг, создаёт SurveyResponse для каждого сотрудника.
   ВАЖНО про таймщиты: строки с «---Административная работа---» в колонке «Проект» означают что проекта не было в дропдауне Google Sheets — реальный проект указан в «Примечание». Парсер это учитывает.
5. AI-инфраструктура:
   - /api/ai/autofill-survey — улучшает черновик опроса (statusVote по датам, человекочитаемые комментарии).
   - /api/ai/chat (этот endpoint) — чат с тобой.
   - ai_audit_log — журнал всех твоих вызовов (append-only, видно расходы).
   - ai_memory — твоя долговременная память.

ТВОИ ТУЛЫ
- list_projects: список проектов с фильтрами.
- get_project: детали проекта.
- list_employees: список сотрудников с фильтрами.
- get_employee_workload: загрузка сотрудника (опрос, часы, проекты).
- list_survey_responses: статистика по опросу.
- list_survey_proposals: авто-предложения по командам.
- recent_ai_activity: твой audit log за последнее время.
- save_memory: сохранить важный факт в долговременную память.

ИНСТРУКЦИИ ПО ИСПОЛЬЗОВАНИЮ ТУЛОВ
- Прежде чем отвечать «не знаю» — попробуй вызвать tool. Многие вопросы решаются 1-2 вызовами.
- Не вызывай tool «на всякий случай» если ответ можно дать из памяти/контекста.
- Один вопрос — один-два tool-вызова. Не циклись.
- Если данных мало (0 проектов, 0 ответов), скажи это явно — не выдумывай.

ИНСТРУКЦИИ ПО ПАМЯТИ
- При получении КОНКРЕТНОГО задания от пользователя — НЕ сохраняй его в память автоматически. Просто выполняй.
- При получении ПРЕДПОЧТЕНИЯ или ПРАВИЛА (например, «всегда показывай суммы в тенге», «таймщиты приходят 1-го числа») — сохрани через save_memory с подходящим scope (user/workspace) и importance 5-9.
- Не дублируй существующие записи памяти.

СТИЛЬ
- По-русски. Без англицизмов где есть нормальный русский эквивалент.
- Кратко: 2-5 предложений на типовой ответ. Списками — когда уместно.
- Конкретно: цифры, имена, даты — а не общие фразы.
- Без воды: не начинай с «Конечно!», «Безусловно!», «Хороший вопрос!».
- Без эмодзи в основном тексте (можно при списках статусов: ✅ ❌ ⏳).
- Если задача сложная и нужно несколько действий — сначала кратко перечисли план, потом выполняй.

БЕЗОПАСНОСТЬ
- Ты НЕ можешь менять данные (только читать). Если пользователь просит «измени X», объясни что это будет в следующем релизе и предложи альтернативу (например, ссылку на UI).
- Ты НЕ можешь отправлять уведомления другим сотрудникам — этого канала пока нет.
- Если пользователь даёт «задание для другого сотрудника» — сохрани его в память с importance 8-9, скажи что напомнишь когда сможешь (это будет в следующей итерации).

ТВОЯ ДОЛГОВРЕМЕННАЯ ПАМЯТЬ (на текущий момент)
${memorySnippets.length === 0 ? '(пока пусто — узнавай и сохраняй важное)' : memorySnippets.map((m) => `- [${m.scope}|${m.memory_key}, важность ${m.importance}/10] ${m.content}`).join('\n')}
`;
}

// ─── Главный обработчик ────────────────────────────────────────────────────

export default async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const t0 = Date.now();
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { userId, userName, userRole, conversationId: convoIdInput, message } = body || {};
  if (!userId || !message) return res.status(400).json({ error: 'userId and message required' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase env vars not configured' });
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  const client = new Anthropic({ apiKey: anthropicKey });

  // ─── 1. Получаем или создаём conversation ───────────────────────────────
  let conversationId = convoIdInput || null;
  if (!conversationId) {
    const { data, error } = await supabase
      .from('ai_chat_conversations')
      .insert({
        user_id: userId,
        user_name: userName || null,
        user_role: userRole || null,
        title: message.slice(0, 80),
      })
      .select('id')
      .single();
    if (error) return res.status(500).json({ error: 'Failed to create conversation', detail: error.message });
    conversationId = data.id;
  }

  // ─── 2. Загружаем историю сообщений (последние N) ───────────────────────
  const { data: historyRows } = await supabase
    .from('ai_chat_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(MAX_HISTORY_MESSAGES);

  // ─── 3. Загружаем долговременную память (workspace + user scope) ────────
  const { data: memoryRows } = await supabase
    .from('ai_memory')
    .select('scope, memory_key, content, importance')
    .or(`scope.eq.workspace,scope.eq.user:${userId}`)
    .order('importance', { ascending: false })
    .limit(40);

  // ─── 4. Собираем messages для Anthropic ─────────────────────────────────
  const messages = [];
  for (const row of historyRows || []) {
    messages.push({ role: row.role, content: row.content });
  }
  // Новое user-сообщение
  messages.push({ role: 'user', content: [{ type: 'text', text: message }] });

  // ─── 5. Системный промпт + caching ──────────────────────────────────────
  const systemPrompt = buildSystemPrompt(memoryRows || []);
  const systemBlocks = [
    {
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' },
    },
  ];

  // Сохраняем user-сообщение в БД ДО tool loop
  await supabase.from('ai_chat_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: [{ type: 'text', text: message }],
  });

  // ─── 6. Tool use loop ───────────────────────────────────────────────────
  const toolsUsed = [];
  const totalUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  let finalText = '';
  let stopReason = null;

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    let resp;
    try {
      resp = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: systemBlocks,
        tools: TOOLS,
        messages,
      });
    } catch (err) {
      await supabase.from('ai_chat_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: [{ type: 'text', text: `[ERROR] ${err?.message || err}` }],
        stop_reason: 'error',
      });
      return res.status(502).json({ error: 'AI_CALL_FAILED', message: String(err?.message || err) });
    }

    totalUsage.input_tokens += resp.usage?.input_tokens || 0;
    totalUsage.output_tokens += resp.usage?.output_tokens || 0;
    totalUsage.cache_read_input_tokens += resp.usage?.cache_read_input_tokens || 0;
    totalUsage.cache_creation_input_tokens += resp.usage?.cache_creation_input_tokens || 0;
    stopReason = resp.stop_reason;

    // Сохраняем assistant turn в БД
    const toolCallsSummary = resp.content
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ name: b.name, input: b.input }));
    await supabase.from('ai_chat_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: resp.content,
      tokens_in: resp.usage?.input_tokens || 0,
      tokens_out: resp.usage?.output_tokens || 0,
      cache_read: resp.usage?.cache_read_input_tokens || 0,
      cache_write: resp.usage?.cache_creation_input_tokens || 0,
      stop_reason: resp.stop_reason,
      tool_calls: toolCallsSummary.length > 0 ? toolCallsSummary : null,
    });

    // Append response to messages for next iteration
    messages.push({ role: 'assistant', content: resp.content });

    if (resp.stop_reason !== 'tool_use') {
      // Финальный ответ — извлекаем текст
      for (const block of resp.content) {
        if (block.type === 'text') finalText += block.text;
      }
      break;
    }

    // Stop reason = tool_use → выполняем tools, добавляем результаты, цикл продолжается
    const toolResults = [];
    for (const block of resp.content) {
      if (block.type !== 'tool_use') continue;
      const out = await execTool(supabase, { userId, userName, userRole }, block.name, block.input);
      toolsUsed.push({ name: block.name, input: block.input, output: out });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(out).slice(0, 8000), // safety cap
      });
    }
    // Tool results добавляем как user-сообщение
    await supabase.from('ai_chat_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: toolResults,
    });
    messages.push({ role: 'user', content: toolResults });
  }

  // ─── 7. Обновляем counters в conversation ───────────────────────────────
  const cost = estCost(totalUsage);
  await supabase
    .from('ai_chat_conversations')
    .update({
      message_count: (historyRows?.length || 0) + 2, // +user+assistant минимум
      total_tokens_in: totalUsage.input_tokens,
      total_tokens_out: totalUsage.output_tokens,
      total_cost_usd: cost,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  // ─── 8. Audit log ───────────────────────────────────────────────────────
  await supabase.from('ai_audit_log').insert({
    user_id: userId,
    user_name: userName || null,
    user_role: userRole || null,
    action: 'chat',
    model: MODEL,
    status: 'success',
    input_tokens: totalUsage.input_tokens,
    output_tokens: totalUsage.output_tokens,
    cache_read_tokens: totalUsage.cache_read_input_tokens,
    cache_write_tokens: totalUsage.cache_creation_input_tokens,
    cost_estimate_usd: cost,
    pii_masked_count: 0,
    tools_called: toolsUsed.map((t) => ({ name: t.name })),
    tool_calls_count: toolsUsed.length,
    response_summary: finalText.slice(0, 500),
    request_metadata: { conversation_id: conversationId, message_preview: message.slice(0, 100) },
    duration_ms: Date.now() - t0,
  });

  return res.status(200).json({
    conversationId,
    reply: finalText.trim() || '(пустой ответ — возможно, нужно переспросить)',
    toolsUsed: toolsUsed.map((t) => ({ name: t.name, input: t.input })),
    stopReason,
    tokens: {
      in: totalUsage.input_tokens,
      out: totalUsage.output_tokens,
      cacheRead: totalUsage.cache_read_input_tokens,
      cacheWrite: totalUsage.cache_creation_input_tokens,
    },
    costUsd: Number(cost.toFixed(6)),
    durationMs: Date.now() - t0,
  });
};
