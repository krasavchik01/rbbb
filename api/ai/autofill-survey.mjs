/**
 * Vercel Node Serverless Function: AI-автозаполнение опроса «кто в каком проекте».
 * Путь: POST /api/ai/autofill-survey
 *
 * Что делает:
 *  1. Принимает { userId } — кого автозаполняем.
 *  2. Загружает из Supabase: текущий ответ опроса (если есть), список проектов системы.
 *  3. Если есть текущий ответ (после импорта таймщита) — AI ПРЕДЛАГАЕТ улучшения:
 *     - statusVote на основе periodTo (старые → completed, свежие → in_progress)
 *     - человекочитаемый comment вместо «Импорт таймщита (N стр.) Секции: …»
 *     - подсказку про roleOnProject при противоречиях
 *  4. PII (ФИО клиентов и партнёров) маскируется ПЕРЕД отправкой в LLM.
 *  5. Размаскируем ответ, пишем audit log, возвращаем preview фронту.
 *
 * Безопасность:
 *  - Service role key к Supabase в env var (никогда не на фронте).
 *  - ANTHROPIC_API_KEY в env var.
 *  - Реальные ФИО клиентов в API Anthropic НЕ уходят.
 *  - Audit log append-only (миграция 20260521000000).
 *
 * Лимиты MVP:
 *  - Один пользователь за вызов (не batch).
 *  - Модель: Claude Haiku 4.5 (быстро, дёшево, хватает для структурированного output).
 *  - Без streaming — нам нужен полный ответ для preview.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
// PII-маскировка — общий модуль, .ts собирается Vite на фронте; для сервера
// импортируем .ts напрямую (Vercel запускает через ts-node-style hook для .mjs?).
// Безопаснее — продублируем минимальную маскировочную логику здесь как отдельный модуль.
import { createMask, maskValue, unmaskDeep, maskStats } from './piiMaskServer.mjs';

const MODEL = 'claude-haiku-4-5';
// Стоимость Haiku 4.5: $1 / 1M input, $5 / 1M output (на 2026-05-21).
const PRICE_INPUT_PER_M = 1.0;
const PRICE_OUTPUT_PER_M = 5.0;

// ─── helpers ────────────────────────────────────────────────────────────────

function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

function estimateCostUsd(inputTokens, outputTokens) {
  return (
    (inputTokens / 1_000_000) * PRICE_INPUT_PER_M +
    (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_M
  );
}

// ─── главный обработчик ────────────────────────────────────────────────────

export default async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const t0 = Date.now();
  const { userId } = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  // ─── 1. Supabase: подгружаем данные ─────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase env vars not configured on server' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const [respRow, projectsRows, userRow] = await Promise.all([
    supabase
      .from('project_survey_responses')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then((r) => r.data),
    supabase.from('projects').select('id, name, status').then((r) => r.data || []),
    supabase
      .from('users')
      .select('id, name, role')
      .eq('id', userId)
      .maybeSingle()
      .then((r) => r.data),
  ]);

  if (!respRow) {
    return res.status(404).json({
      error: 'NO_DRAFT',
      message: 'Сначала импортируйте таймщит или начните опрос — AI улучшает существующий черновик, а не создаёт с нуля.',
    });
  }

  const existingAnswers = Array.isArray(respRow.answers) ? respRow.answers : [];
  if (existingAnswers.length === 0) {
    return res.status(400).json({ error: 'EMPTY_DRAFT', message: 'Черновик пуст — нечего улучшать.' });
  }

  // ─── 2. PII-маскировка ─────────────────────────────────────────────────
  const mask = createMask();

  // Маскируем имя самого пользователя (на случай если оно появится в комментариях)
  const userName = userRow?.name || respRow.user_name || 'Unknown';
  maskValue(mask, 'User', userName);

  // Маскируем все названия проектов из ответов и из списка проектов системы
  for (const a of existingAnswers) {
    if (a.projectName) maskValue(mask, 'Client', a.projectName);
  }
  for (const p of projectsRows) {
    if (p.name) maskValue(mask, 'Client', p.name);
  }

  // Готовим masked-копию ответов для AI
  const maskedAnswers = existingAnswers.map((a) => ({
    projectId: a.projectId,
    projectName: mask.mask.get(a.projectName) || a.projectName,
    participated: a.participated,
    roleOnProject: a.roleOnProject || null,
    periodFrom: a.periodFrom || null,
    periodTo: a.periodTo || null,
    totalHours: a.totalHours ?? null,
    statusVote: a.statusVote,
    rawComment: a.comment ? a.comment.split(/[«"](.*?)[»"]/g).map((s) => mask.mask.get(s) || s).join('') : '',
  }));

  // ─── 3. Системный промпт + tool ────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `Ты — ассистент аудиторской фирмы RBBB Partners (Казахстан). Твоя задача: улучшить черновик опроса «Кто в каком проекте участвовал», который сотрудник заполнил автоматически из импорта таймщита.

Сегодня: ${today}.

ВАЖНО про данные:
- Названия клиентов замаскированы (Client_xxxx) ради конфиденциальности — не пытайся их расшифровать или комментировать сами имена.
- Имя сотрудника тоже замаскировано (User_xxxx).
- Все ответы относятся к ОДНОМУ сотруднику.

Что нужно улучшить для каждого проекта:
1. statusVote — выбери самый вероятный:
   - "completed" если periodTo старше 90 дней (сегодня ${today})
   - "in_progress" если periodTo в последние 90 дней
   - "cancelled" только если totalHours = 0 и в комментарии явный сигнал отмены
   - "unknown" если данных не хватает
2. comment — переформулируй коротко (≤ 100 символов), по-русски, для человека.
   Скажи СУТЬ участия: фактические часы, период, если есть — секции аудита.
   НЕ повторяй «Импорт таймщита». НЕ упоминай ФИО клиентов (они замаскированы).
3. roleOnProject — оставь как есть.

ОБЯЗАТЕЛЬНО:
- Сохрани projectId неизменным.
- Если данных мало (totalHours=0, periodFrom=null) — поставь statusVote="unknown" и comment="Маркер этапа, фактической работы не было" или аналогично.
- Отвечай только через вызов tool propose_refined_answers — ОДИН раз, со всеми проектами сразу.`;

  const tools = [
    {
      name: 'propose_refined_answers',
      description: 'Передать улучшенный набор ответов на опрос. Вызывается ОДИН раз с массивом всех проектов сотрудника.',
      input_schema: {
        type: 'object',
        properties: {
          answers: {
            type: 'array',
            description: 'Массив улучшенных ответов, по одному на каждый проект из исходного черновика.',
            items: {
              type: 'object',
              properties: {
                projectId: { type: 'string', description: 'projectId как был в черновике, не менять' },
                statusVote: {
                  type: 'string',
                  enum: ['in_progress', 'completed', 'cancelled', 'unknown'],
                  description: 'Предполагаемый статус проекта по голосу этого сотрудника',
                },
                comment: {
                  type: 'string',
                  description: 'Человекочитаемый комментарий ≤ 100 символов, по-русски',
                  maxLength: 200,
                },
              },
              required: ['projectId', 'statusVote', 'comment'],
            },
          },
          summary: {
            type: 'string',
            description: 'Краткая сводка для пользователя ≤ 200 символов: «улучшено N комментариев, выставлено M статусов»',
            maxLength: 400,
          },
        },
        required: ['answers', 'summary'],
      },
    },
  ];

  const userPrompt = `Вот черновик опроса этого сотрудника (роль: ${userRow?.role || 'unknown'}).
Все названия проектов замаскированы как Client_xxxx.

\`\`\`json
${JSON.stringify(maskedAnswers, null, 2)}
\`\`\`

Улучши каждый ответ согласно правилам в system prompt. Вызови propose_refined_answers ОДИН раз со всеми ${maskedAnswers.length} проектами.`;

  // ─── 4. Anthropic API ─────────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }
  const client = new Anthropic({ apiKey: anthropicKey });

  const maskedPromptForHash = systemPrompt + '\n' + userPrompt;
  const promptHash = sha256(maskedPromptForHash);
  const stats = maskStats(mask);

  let aiResponse;
  let toolCallInput = null;
  let toolError = null;
  try {
    aiResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      tool_choice: { type: 'tool', name: 'propose_refined_answers' },
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Извлекаем tool_use блок
    for (const block of aiResponse.content) {
      if (block.type === 'tool_use' && block.name === 'propose_refined_answers') {
        toolCallInput = block.input;
        break;
      }
    }
    if (!toolCallInput) {
      toolError = 'AI did not call propose_refined_answers tool';
    }
  } catch (err) {
    // Audit log даже ошибку
    await supabase.from('ai_audit_log').insert({
      user_id: userId,
      user_name: userName,
      user_role: userRow?.role || null,
      action: 'autofill_survey',
      model: MODEL,
      status: 'error',
      error_message: String(err?.message || err).slice(0, 1000),
      pii_masked_count: stats.total,
      pii_masked_breakdown: stats,
      prompt_hash: promptHash,
      duration_ms: Date.now() - t0,
    });
    return res.status(502).json({ error: 'AI_CALL_FAILED', message: String(err?.message || err) });
  }

  if (toolError) {
    await supabase.from('ai_audit_log').insert({
      user_id: userId,
      user_name: userName,
      user_role: userRow?.role || null,
      action: 'autofill_survey',
      model: MODEL,
      status: 'error',
      error_message: toolError,
      input_tokens: aiResponse?.usage?.input_tokens || 0,
      output_tokens: aiResponse?.usage?.output_tokens || 0,
      pii_masked_count: stats.total,
      pii_masked_breakdown: stats,
      prompt_hash: promptHash,
      duration_ms: Date.now() - t0,
    });
    return res.status(502).json({ error: 'AI_NO_TOOL_CALL', message: toolError });
  }

  // ─── 5. Размаскировка + сборка финального preview ──────────────────────
  const unmaskedToolInput = unmaskDeep(mask, toolCallInput);

  // Сливаем AI-предложения с исходными ответами по projectId.
  // Поля totalHours / periodFrom / periodTo / roleOnProject / participated
  // оставляем НЕИЗМЕННЫМИ — это факты из таймщита, AI их не трогает.
  const refinedById = new Map();
  for (const r of unmaskedToolInput.answers || []) {
    refinedById.set(r.projectId, r);
  }
  const proposedAnswers = existingAnswers.map((orig) => {
    const refined = refinedById.get(orig.projectId);
    if (!refined) return orig;
    return {
      ...orig,
      statusVote: refined.statusVote || orig.statusVote,
      comment: refined.comment || orig.comment,
      // Сохраняем оригинал для UI side-by-side
      _aiSuggested: { statusVote: refined.statusVote, comment: refined.comment },
      _original: { statusVote: orig.statusVote, comment: orig.comment },
    };
  });

  const inputTokens = aiResponse.usage?.input_tokens || 0;
  const outputTokens = aiResponse.usage?.output_tokens || 0;
  const cacheRead = aiResponse.usage?.cache_read_input_tokens || 0;
  const cacheWrite = aiResponse.usage?.cache_creation_input_tokens || 0;
  const costUsd = estimateCostUsd(inputTokens, outputTokens);

  await supabase.from('ai_audit_log').insert({
    user_id: userId,
    user_name: userName,
    user_role: userRow?.role || null,
    action: 'autofill_survey',
    model: MODEL,
    status: 'success',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: cacheRead,
    cache_write_tokens: cacheWrite,
    cost_estimate_usd: costUsd,
    pii_masked_count: stats.total,
    pii_masked_breakdown: stats,
    tools_called: [{ name: 'propose_refined_answers', count: 1 }],
    tool_calls_count: 1,
    prompt_hash: promptHash,
    response_summary: (unmaskedToolInput.summary || '').slice(0, 500),
    request_metadata: { answers_count: existingAnswers.length },
    duration_ms: Date.now() - t0,
  });

  return res.status(200).json({
    ok: true,
    proposedAnswers,
    summary: unmaskedToolInput.summary || '',
    stats: {
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      costUsd: Number(costUsd.toFixed(4)),
      piiMasked: stats.total,
      durationMs: Date.now() - t0,
    },
  });
};
