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
const MAX_TOOL_ITERATIONS = 8;        // увеличено: write-flow тратит больше итераций (dry_run → confirm → apply)
const MAX_HISTORY_MESSAGES = 30;      // последние N сообщений из БД в контекст

// Роли которые могут вызывать write-tools. Остальные — только read.
// Проверяется server-side по employees.role (не доверяем клиенту).
const WRITE_ROLES = new Set(['ceo', 'admin', 'deputy_director']);

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
    description: 'Список проектов фирмы с опциональным фильтром по статусу, поиску и/или нашему бренду (МАК/RB IT/Parker Russell/Fin Consulting/Andersonkz и т.п.).',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Опционально: planning | in_progress | completed | cancelled | new | pending_approval | ready_to_complete | approved' },
        search: { type: 'string', description: 'Опционально: подстрока для поиска в названии проекта ИЛИ клиента' },
        ourCompany: { type: 'string', description: 'Опционально: бренд нашей фирмы (например, «МАК», «RB IT», «Parker Russell»). Ищется по notes.ourCompany через ILIKE %X%.' },
        periodFrom: { type: 'string', description: 'Опционально ISO дата: вернуть проекты у которых notes.periodFrom >= этого.' },
        periodTo:   { type: 'string', description: 'Опционально ISO дата: вернуть проекты у которых notes.periodTo <= этого.' },
        limit: { type: 'integer', description: 'Сколько вернуть, default 20, max 200' },
      },
    },
  },
  {
    name: 'list_companies',
    description: 'Список НАШИХ собственных юр.лиц / брендов под которыми работает фирма (RB Partners IT Audit, Russell Bedford A+ Partners, Parker Russell, Fin Consulting, Andersonkz). Их 5. ЭТО НЕ КЛИЕНТЫ — это наши компании.',
    input_schema: { type: 'object', properties: {} },
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
  // ─── DIAGNOSTIC / REPORT (read-only) ─────────────────────────────────────
  {
    name: 'find_gaps',
    description: 'Найти «дыры» в данных: проекты без команды, протухшие proposals, сотрудники без активных проектов, неподанные опросы. Полезно когда юзер просит «найди недоработки» / «что не так в системе».',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'projects_no_team', 'pending_proposals', 'employees_no_projects', 'missing_surveys', 'stale_projects'],
          description: 'Что искать. all = всё сразу.',
        },
      },
    },
  },
  {
    name: 'generate_report',
    description: 'Сводный отчёт по системе. Используй когда юзер спрашивает «сколько …» или «дай сводку».',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['projects_by_status', 'projects_started_completed', 'employees_workload', 'survey_completion', 'ai_spending', 'projects_by_our_company'],
        },
      },
      required: ['type'],
    },
  },
  // ─── WRITE TOOLS (двухфазный confirm: dry_run → подтверждение пользователя → apply) ──
  // Все write tools имеют параметр dry_run (default true). В dry_run возвращают
  // «что было бы сделано», не меняют БД. Только когда юзер явно подтвердил
  // в чате — AI вызывает повторно с dry_run=false.
  // Доступны только для ролей в WRITE_ROLES (проверяется server-side).
  {
    name: 'approve_proposal',
    description: 'Утвердить авто-предложение по составу команды проекта. Двухфазный confirm: первый раз вызывай с dry_run=true чтобы увидеть что будет сделано, покажи юзеру и спроси согласия, потом — с dry_run=false.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        dry_run: { type: 'boolean', description: 'true (default) = только показать что будет, false = применить' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'reject_proposal',
    description: 'Отклонить авто-предложение по составу команды. Двухфазный confirm.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        reason: { type: 'string', description: 'Короткая причина отклонения' },
        dry_run: { type: 'boolean' },
      },
      required: ['projectId', 'reason'],
    },
  },
  {
    name: 'update_project_status',
    description: 'Изменить статус проекта. Двухфазный confirm.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        newStatus: { type: 'string', enum: ['new', 'planning', 'pending_approval', 'approved', 'in_progress', 'ready_to_complete', 'completed', 'cancelled'] },
        reason: { type: 'string' },
        dry_run: { type: 'boolean' },
      },
      required: ['projectId', 'newStatus'],
    },
  },
  {
    name: 'create_task',
    description: 'Создать задачу для сотрудника. Используй когда CEO/зам.дир говорит «передай X», «скажи Y сделать Z». Двухфазный confirm.',
    input_schema: {
      type: 'object',
      properties: {
        assignedToEmployeeId: { type: 'string', description: 'employee.id кому' },
        title: { type: 'string', description: 'Краткое название задачи ≤ 100 символов' },
        description: { type: 'string', description: 'Подробности' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        relatedProjectId: { type: 'string', description: 'Опционально: ID проекта к которому привязана' },
        dueDate: { type: 'string', description: 'ISO дата дедлайна, опционально' },
        dry_run: { type: 'boolean' },
      },
      required: ['assignedToEmployeeId', 'title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Список задач (созданных через AI). Фильтр по сотруднику или статусу.',
    input_schema: {
      type: 'object',
      properties: {
        assignedTo: { type: 'string', description: 'employee.id, опционально' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'done', 'cancelled'] },
        limit: { type: 'integer' },
      },
    },
  },
  {
    name: 'start_survey',
    description: 'Запустить опрос «Кто в каком проекте участвовал». Все сотрудники увидят форму. Двухфазный confirm.',
    input_schema: {
      type: 'object',
      properties: {
        deadline: { type: 'string', description: 'ISO дата дедлайна, опционально' },
        title: { type: 'string', description: 'Опциональный заголовок' },
        description: { type: 'string', description: 'Опциональное описание для сотрудников' },
        dry_run: { type: 'boolean' },
      },
    },
  },
  {
    name: 'stop_survey',
    description: 'Остановить опрос (сотрудники больше не смогут отвечать). Двухфазный confirm.',
    input_schema: {
      type: 'object',
      properties: { dry_run: { type: 'boolean' } },
    },
  },
  {
    name: 'assign_to_project',
    description: 'Добавить сотрудника в команду проекта. Записывает в notes.team[] и notes.teamIds[]. Двухфазный confirm.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        employeeId: { type: 'string' },
        role: { type: 'string', description: 'Роль на проекте, например senior_assistant / manager / supervisor / partner' },
        dry_run: { type: 'boolean' },
      },
      required: ['projectId', 'employeeId', 'role'],
    },
  },
  {
    name: 'remove_from_project',
    description: 'Убрать сотрудника из команды проекта. Двухфазный confirm.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        employeeId: { type: 'string' },
        dry_run: { type: 'boolean' },
      },
      required: ['projectId', 'employeeId'],
    },
  },
  {
    name: 'update_employee_role',
    description: 'Изменить роль сотрудника в системе (employees.role). ОПАСНО — меняет уровень доступа. Только для ceo/admin. Двухфазный confirm.',
    input_schema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string' },
        newRole: { type: 'string', enum: ['ceo', 'deputy_director', 'partner', 'hr', 'manager', 'senior_assistant', 'assistant_1', 'assistant_2', 'admin', 'supervisor', 'employee'] },
        reason: { type: 'string' },
        dry_run: { type: 'boolean' },
      },
      required: ['employeeId', 'newRole'],
    },
  },
  {
    name: 'recall_notes',
    description: 'Достать все заметки AI про конкретного сотрудника или проект. Полезно когда юзер спрашивает «что ты знаешь про Иванова» или «что у нас по проекту X».',
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'employee:<id> | project:<id> | workspace' },
      },
      required: ['scope'],
    },
  },
];

// ─── Tool executors (server-side, read from Supabase) ──────────────────────

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// Проверка прав на write-tool. Возвращает true/false; если false — возвращаем
// в AI стандартизированную ошибку, чтобы он попросил юзера-админа.
function canWrite(ctx) {
  return WRITE_ROLES.has(ctx.serverVerifiedRole || '');
}

const WRITE_TOOLS = new Set([
  'approve_proposal',
  'reject_proposal',
  'update_project_status',
  'create_task',
  'start_survey',
  'stop_survey',
  'assign_to_project',
  'remove_from_project',
  'update_employee_role',
]);

// Особо опасные tools — только для ceo + admin (не deputy_director)
const ADMIN_ONLY_TOOLS = new Set(['update_employee_role']);
const ADMIN_ROLES = new Set(['ceo', 'admin']);

async function execTool(supabase, ctx, name, input) {
  // Сначала gate по ролям для write-tools
  if (WRITE_TOOLS.has(name) && input?.dry_run !== true && !canWrite(ctx)) {
    return {
      error: 'PERMISSION_DENIED',
      message: `У роли ${ctx.serverVerifiedRole || 'unknown'} нет прав на write-действия. Может выполнить только ceo/admin/deputy_director.`,
    };
  }
  if (ADMIN_ONLY_TOOLS.has(name) && input?.dry_run !== true && !ADMIN_ROLES.has(ctx.serverVerifiedRole || '')) {
    return {
      error: 'PERMISSION_DENIED',
      message: `Этот tool доступен только ceo/admin. Текущая роль: ${ctx.serverVerifiedRole || 'unknown'}.`,
    };
  }
  try {
    switch (name) {
      case 'list_projects': {
        // Схема: projects(id, name, status, updated_at, notes JSONB).
        // notes.ourCompany — наш бренд ("МАК", "RB IT" и т.п.).
        // notes.clientName — имя клиента.
        // notes.periodFrom / periodTo — даты периода аудита.
        // Тяжёлая фильтрация: ourCompany/clientName/periods сидят в JSONB,
        // поэтому достаём шире и фильтруем в JS. Лимит безопасности — 500.
        const fetchLimit = Math.min((input.limit || 20) * 5, 500);
        let q = supabase.from('projects').select('id, name, status, updated_at, notes').limit(fetchLimit);
        if (input.status) q = q.eq('status', input.status);
        if (input.search) q = q.ilike('name', `%${input.search}%`);
        const { data, error } = await q;
        if (error) return { error: error.message };
        const searchLower = input.search?.toLowerCase();
        const ourCompanyLower = input.ourCompany?.toLowerCase();
        const periodFrom = input.periodFrom || null;
        const periodTo = input.periodTo || null;
        const parsed = (data || []).map((p) => {
          const notes = typeof p.notes === 'string' ? safeParse(p.notes) : p.notes;
          return {
            id: p.id,
            name: p.name,
            status: p.status,
            updated_at: p.updated_at,
            clientName: notes?.clientName || notes?.client?.name || null,
            ourCompany: notes?.ourCompany || notes?.companyName || null,
            periodFrom: notes?.periodFrom || notes?.startDate || null,
            periodTo: notes?.periodTo || notes?.endDate || null,
            teamSize: Array.isArray(notes?.team) ? notes.team.length : (Array.isArray(notes?.teamIds) ? notes.teamIds.length : null),
          };
        });
        const filtered = parsed.filter((p) => {
          if (searchLower) {
            const nameOk = p.name && p.name.toLowerCase().includes(searchLower);
            const clientOk = p.clientName && p.clientName.toLowerCase().includes(searchLower);
            if (!nameOk && !clientOk) return false;
          }
          if (ourCompanyLower) {
            if (!p.ourCompany || !p.ourCompany.toLowerCase().includes(ourCompanyLower)) return false;
          }
          if (periodFrom && p.periodFrom && p.periodFrom < periodFrom) return false;
          if (periodTo && p.periodTo && p.periodTo > periodTo) return false;
          return true;
        });
        return { projects: filtered.slice(0, input.limit || 20), totalFound: filtered.length };
      }
      case 'list_companies': {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, brand_color, active')
          .eq('active', true)
          .order('name');
        if (error) return { error: error.message };
        return {
          companies: data || [],
          note: 'Это НАШИ собственные юр.лица (5 штук). Плюс в notes.ourCompany у каждого проекта есть бренд-сокращение (МАК, RB IT, и т.п.) — это другая система, см. через list_projects(ourCompany=...).',
        };
      }
      case 'get_project': {
        const [projRes, aiNotesRes] = await Promise.all([
          supabase.from('projects').select('id, name, status, updated_at, notes').eq('id', input.projectId).maybeSingle(),
          supabase.from('ai_memory').select('memory_key, content, importance').eq('scope', `project:${input.projectId}`).order('importance', { ascending: false }).limit(20),
        ]);
        if (projRes.error) return { error: projRes.error.message };
        const data = projRes.data;
        if (!data) return { error: 'Project not found' };
        const notes = typeof data.notes === 'string' ? safeParse(data.notes) : data.notes;
        const aiNotes = aiNotesRes.data || [];
        return {
          ai_notes: aiNotes,
          notes_hint: aiNotes.length > 0 ? `У AI есть ${aiNotes.length} заметок про этот проект.` : 'Заметок про проект пока нет — сохраняй важное через save_memory(scope="project:' + data.id + '").',
          project: {
            id: data.id,
            name: data.name,
            status: data.status,
            updated_at: data.updated_at,
            clientName: notes?.clientName || notes?.client?.name || null,
            ourCompany: notes?.ourCompany || notes?.companyName || null,
            periodFrom: notes?.periodFrom || notes?.startDate || null,
            periodTo: notes?.periodTo || notes?.endDate || null,
            contractNumber: notes?.contractNumber || null,
            contractDate: notes?.contractDate || null,
            team: Array.isArray(notes?.team) ? notes.team.map((m) => ({ id: m.userId || m.id, name: m.name, role: m.role })) : [],
            description: notes?.description || null,
            manager: notes?.managerName || notes?.manager || null,
            partner: notes?.partnerName || notes?.partner || null,
            budget: notes?.finances?.amountWithoutVAT || notes?.budget || null,
            currency: notes?.currency || null,
          },
        };
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
        const [emp, survey, notes] = await Promise.all([
          supabase.from('employees').select('id, name, role, email').eq('id', input.employeeId).maybeSingle().then((r) => r.data),
          supabase.from('project_survey_responses').select('user_id, status, answers, updated_at').eq('user_id', input.employeeId).maybeSingle().then((r) => r.data),
          // Подгружаем AI-заметки про этого сотрудника — это база знаний AI про каждого.
          supabase.from('ai_memory').select('memory_key, content, importance').eq('scope', `employee:${input.employeeId}`).order('importance', { ascending: false }).limit(20).then((r) => r.data),
        ]);
        if (!emp) return { error: 'Employee not found' };
        return {
          employee: emp,
          surveySubmitted: !!(survey && survey.status === 'submitted'),
          surveyUpdatedAt: survey?.updated_at || null,
          projectsCount: Array.isArray(survey?.answers) ? survey.answers.filter((a) => a.participated).length : 0,
          totalHours: Array.isArray(survey?.answers) ? survey.answers.reduce((s, a) => s + (a.totalHours || 0), 0) : 0,
          ai_notes: notes || [],  // Заметки AI про этого сотрудника
          notes_hint: (notes && notes.length > 0) ? `У AI есть ${notes.length} заметок про сотрудника — используй их в ответе.` : 'У AI пока нет заметок про этого сотрудника. Если узнал важное — сохрани через save_memory(scope=\"employee:' + emp.id + '\").',
        };
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
        // scope может быть:
        //  - 'user' → user:<ctx.userId>
        //  - 'workspace' → workspace
        //  - 'employee:<id>' → заметка про конкретного сотрудника (для AI-«картотеки»)
        //  - 'project:<id>' → заметка про конкретный проект
        let scope;
        if (input.scope === 'user') scope = `user:${ctx.userId}`;
        else if (input.scope === 'workspace') scope = 'workspace';
        else if (typeof input.scope === 'string' && (input.scope.startsWith('employee:') || input.scope.startsWith('project:'))) scope = input.scope;
        else return { error: 'Invalid scope. Use: user, workspace, employee:<id>, project:<id>' };

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
      case 'recall_notes': {
        const { data, error } = await supabase
          .from('ai_memory')
          .select('memory_key, content, importance, created_at, updated_at, created_by')
          .eq('scope', input.scope)
          .order('importance', { ascending: false })
          .limit(50);
        if (error) return { error: error.message };
        return { scope: input.scope, notes: data || [] };
      }

      // ─── DIAGNOSTIC ────────────────────────────────────────────────────
      case 'find_gaps': {
        const category = input.category || 'all';
        const gaps = {};
        const wants = (c) => category === 'all' || category === c;

        if (wants('projects_no_team')) {
          const { data } = await supabase.from('projects').select('id, name, status, notes').limit(500);
          gaps.projects_no_team = (data || [])
            .map((p) => {
              const notes = typeof p.notes === 'string' ? safeParse(p.notes) : p.notes;
              const teamSize = Array.isArray(notes?.team) ? notes.team.length : (Array.isArray(notes?.teamIds) ? notes.teamIds.length : 0);
              return { id: p.id, name: p.name, status: p.status, teamSize };
            })
            .filter((p) => p.teamSize === 0 && !['completed', 'cancelled'].includes(p.status));
        }

        if (wants('pending_proposals')) {
          const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
          const { data } = await supabase
            .from('project_survey_proposals')
            .select('project_id, project_name, status, updated_at, confidence, participants_count')
            .eq('status', 'pending')
            .lt('updated_at', cutoff)
            .order('updated_at', { ascending: true });
          gaps.stale_pending_proposals = data || [];
        }

        if (wants('employees_no_projects')) {
          const [employees, projects] = await Promise.all([
            supabase.from('employees').select('id, name, role').limit(500).then((r) => r.data || []),
            supabase.from('projects').select('id, status, notes').limit(500).then((r) => r.data || []),
          ]);
          const activeMembers = new Set();
          for (const p of projects) {
            if (['completed', 'cancelled'].includes(p.status)) continue;
            const notes = typeof p.notes === 'string' ? safeParse(p.notes) : p.notes;
            const ids = Array.isArray(notes?.teamIds) ? notes.teamIds : (Array.isArray(notes?.team) ? notes.team.map((m) => m.userId || m.id) : []);
            for (const id of ids) activeMembers.add(id);
          }
          gaps.employees_no_projects = employees
            .filter((e) => !activeMembers.has(e.id) && !['admin', 'hr'].includes(e.role))
            .map((e) => ({ id: e.id, name: e.name, role: e.role }));
        }

        if (wants('missing_surveys')) {
          const [employees, responses] = await Promise.all([
            supabase.from('employees').select('id, name, role').limit(500).then((r) => r.data || []),
            supabase.from('project_survey_responses').select('user_id, status').then((r) => r.data || []),
          ]);
          const submitted = new Set(responses.filter((r) => r.status === 'submitted').map((r) => r.user_id));
          gaps.employees_no_survey = employees
            .filter((e) => !submitted.has(e.id) && !['admin'].includes(e.role))
            .map((e) => ({ id: e.id, name: e.name, role: e.role }));
        }

        if (wants('stale_projects')) {
          const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
          const { data } = await supabase
            .from('projects')
            .select('id, name, status, updated_at')
            .in('status', ['in_progress', 'planning', 'approved'])
            .lt('updated_at', cutoff)
            .order('updated_at', { ascending: true })
            .limit(50);
          gaps.stale_projects = data || [];
        }

        return gaps;
      }

      case 'generate_report': {
        switch (input.type) {
          case 'projects_by_status': {
            const { data } = await supabase.from('projects').select('status');
            const counts = {};
            for (const p of data || []) counts[p.status || 'unknown'] = (counts[p.status || 'unknown'] || 0) + 1;
            return { type: 'projects_by_status', counts, total: (data || []).length };
          }
          case 'projects_by_our_company': {
            // Группировка по notes.ourCompany — сколько проектов в каждом нашем бренде.
            const { data } = await supabase.from('projects').select('id, status, notes').limit(2000);
            const counts = {};
            const byStatus = {};
            for (const p of data || []) {
              const notes = typeof p.notes === 'string' ? safeParse(p.notes) : p.notes;
              const oc = notes?.ourCompany || notes?.companyName || '(не указано)';
              counts[oc] = (counts[oc] || 0) + 1;
              byStatus[oc] = byStatus[oc] || {};
              byStatus[oc][p.status || 'unknown'] = (byStatus[oc][p.status || 'unknown'] || 0) + 1;
            }
            return { type: 'projects_by_our_company', counts, by_status: byStatus, total: (data || []).length };
          }
          case 'projects_started_completed': {
            const { data } = await supabase.from('projects').select('status, updated_at');
            const all = data || [];
            return {
              type: 'projects_started_completed',
              total: all.length,
              started: all.filter((p) => ['in_progress', 'planning', 'approved'].includes(p.status)).length,
              completed: all.filter((p) => p.status === 'completed').length,
              cancelled: all.filter((p) => p.status === 'cancelled').length,
              new_or_pending: all.filter((p) => ['new', 'pending_approval'].includes(p.status)).length,
              ready_to_complete: all.filter((p) => p.status === 'ready_to_complete').length,
            };
          }
          case 'survey_completion': {
            const [emps, resps] = await Promise.all([
              supabase.from('employees').select('id, role').then((r) => r.data || []),
              supabase.from('project_survey_responses').select('user_id, status').then((r) => r.data || []),
            ]);
            const submitted = resps.filter((r) => r.status === 'submitted').length;
            const drafts = resps.filter((r) => r.status === 'draft').length;
            return {
              type: 'survey_completion',
              employees_total: emps.length,
              submitted,
              drafts,
              not_started: emps.length - submitted - drafts,
              percent_submitted: emps.length === 0 ? 0 : Math.round((submitted / emps.length) * 100),
            };
          }
          case 'ai_spending': {
            const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
            const { data } = await supabase
              .from('ai_audit_log')
              .select('action, model, cost_estimate_usd, input_tokens, output_tokens, created_at, status')
              .gte('created_at', cutoff);
            const ok = (data || []).filter((r) => r.status === 'success');
            const totalUsd = ok.reduce((s, r) => s + Number(r.cost_estimate_usd || 0), 0);
            const byAction = {};
            for (const r of ok) {
              byAction[r.action] = (byAction[r.action] || 0) + Number(r.cost_estimate_usd || 0);
            }
            return {
              type: 'ai_spending',
              period_days: 30,
              total_calls: ok.length,
              total_usd: Number(totalUsd.toFixed(4)),
              by_action: byAction,
              total_input_tokens: ok.reduce((s, r) => s + (r.input_tokens || 0), 0),
              total_output_tokens: ok.reduce((s, r) => s + (r.output_tokens || 0), 0),
              errors_count: (data || []).filter((r) => r.status === 'error').length,
            };
          }
          case 'employees_workload': {
            const resps = await supabase
              .from('project_survey_responses')
              .select('user_id, user_name, user_role, answers, status')
              .eq('status', 'submitted')
              .then((r) => r.data || []);
            const rows = resps.map((r) => {
              const ans = Array.isArray(r.answers) ? r.answers : [];
              const hours = ans.reduce((s, a) => s + (a.totalHours || 0), 0);
              return {
                userId: r.user_id,
                name: r.user_name,
                role: r.user_role,
                projects: ans.filter((a) => a.participated).length,
                hours,
              };
            });
            rows.sort((a, b) => b.hours - a.hours);
            return { type: 'employees_workload', top: rows.slice(0, 30), total: rows.length };
          }
          default:
            return { error: `Unknown report type: ${input.type}` };
        }
      }

      // ─── WRITE TOOLS (dry_run flow) ────────────────────────────────────
      case 'approve_proposal': {
        const dry = input.dry_run !== false;
        const { data: prop, error } = await supabase
          .from('project_survey_proposals')
          .select('*')
          .eq('project_id', input.projectId)
          .maybeSingle();
        if (error) return { error: error.message };
        if (!prop) return { error: 'Proposal not found' };
        if (prop.status === 'approved') return { error: 'Already approved' };
        const preview = {
          dry_run: dry,
          will_change: {
            project_id: prop.project_id,
            project_name: prop.project_name,
            from_status: prop.status,
            to_status: 'approved',
            proposed_team_size: Array.isArray(prop.proposed_team) ? prop.proposed_team.length : 0,
            proposed_status: prop.proposed_status,
            confidence: prop.confidence,
          },
        };
        if (dry) return { ...preview, instruction: 'Покажи юзеру что будет сделано и спроси «подтверждаешь?». Только после явного «да» вызывай повторно с dry_run=false.' };
        const { error: updErr } = await supabase
          .from('project_survey_proposals')
          .update({
            status: 'approved',
            reviewed_by: ctx.userId,
            reviewed_by_name: ctx.userName || null,
            reviewed_at: new Date().toISOString(),
          })
          .eq('project_id', input.projectId);
        if (updErr) return { error: updErr.message };
        return { ...preview, applied: true };
      }

      case 'reject_proposal': {
        const dry = input.dry_run !== false;
        const { data: prop, error } = await supabase
          .from('project_survey_proposals')
          .select('*')
          .eq('project_id', input.projectId)
          .maybeSingle();
        if (error) return { error: error.message };
        if (!prop) return { error: 'Proposal not found' };
        const preview = {
          dry_run: dry,
          will_change: {
            project_id: prop.project_id,
            project_name: prop.project_name,
            from_status: prop.status,
            to_status: 'rejected',
            reason: input.reason,
          },
        };
        if (dry) return { ...preview, instruction: 'Покажи юзеру что будет сделано и спроси «подтверждаешь?». Только после явного «да» вызывай повторно с dry_run=false.' };
        const { error: updErr } = await supabase
          .from('project_survey_proposals')
          .update({
            status: 'rejected',
            reviewed_by: ctx.userId,
            reviewed_by_name: ctx.userName || null,
            reviewed_at: new Date().toISOString(),
            override_notes: input.reason,
          })
          .eq('project_id', input.projectId);
        if (updErr) return { error: updErr.message };
        return { ...preview, applied: true };
      }

      case 'update_project_status': {
        const dry = input.dry_run !== false;
        const { data: proj, error } = await supabase
          .from('projects')
          .select('id, name, status, notes')
          .eq('id', input.projectId)
          .maybeSingle();
        if (error) return { error: error.message };
        if (!proj) return { error: 'Project not found' };
        const preview = {
          dry_run: dry,
          will_change: {
            project_id: proj.id,
            project_name: proj.name,
            from_status: proj.status,
            to_status: input.newStatus,
            reason: input.reason || null,
          },
        };
        if (dry) return { ...preview, instruction: 'Покажи юзеру что будет сделано и спроси «подтверждаешь?». Только после явного «да» вызывай повторно с dry_run=false.' };
        // Обновляем status + дублируем в notes для UI совместимости
        const notes = typeof proj.notes === 'string' ? safeParse(proj.notes) : proj.notes;
        const nextNotes = { ...(notes || {}), status: input.newStatus, ai_status_change: { from: proj.status, to: input.newStatus, by: ctx.userId, reason: input.reason || null, at: new Date().toISOString() } };
        const { error: updErr } = await supabase
          .from('projects')
          .update({ status: input.newStatus, notes: JSON.stringify(nextNotes), updated_at: new Date().toISOString() })
          .eq('id', input.projectId);
        if (updErr) return { error: updErr.message };
        return { ...preview, applied: true };
      }

      case 'create_task': {
        const dry = input.dry_run !== false;
        const { data: emp } = await supabase
          .from('employees')
          .select('id, name, role')
          .eq('id', input.assignedToEmployeeId)
          .maybeSingle();
        if (!emp) return { error: 'Employee not found' };
        const preview = {
          dry_run: dry,
          will_create: {
            assigned_to: emp.id,
            assigned_to_name: emp.name,
            title: String(input.title).slice(0, 100),
            description: input.description || null,
            priority: input.priority || 'medium',
            due_date: input.dueDate || null,
            related_project_id: input.relatedProjectId || null,
            created_by: ctx.userId,
            created_by_name: ctx.userName || null,
          },
        };
        if (dry) return { ...preview, instruction: 'Покажи юзеру что будет создано и спроси «подтверждаешь?». Только после явного «да» вызывай повторно с dry_run=false. Напомни юзеру что канал доставки (Telegram/email) пока не подключён — задача создастся, но автоматическое уведомление не уйдёт.' };
        const { data, error } = await supabase
          .from('ai_tasks')
          .insert({
            assigned_to: preview.will_create.assigned_to,
            assigned_to_name: preview.will_create.assigned_to_name,
            title: preview.will_create.title,
            description: preview.will_create.description,
            priority: preview.will_create.priority,
            related_project_id: preview.will_create.related_project_id,
            due_date: preview.will_create.due_date,
            created_by: preview.will_create.created_by,
            created_by_name: preview.will_create.created_by_name,
            created_via: 'ai_chat',
          })
          .select('id, created_at')
          .single();
        if (error) return { error: error.message };
        return { ...preview, applied: true, task_id: data.id, created_at: data.created_at };
      }

      case 'start_survey': {
        const dry = input.dry_run !== false;
        const { data: cur } = await supabase
          .from('project_survey_config')
          .select('*')
          .eq('id', 'default')
          .maybeSingle();
        const preview = {
          dry_run: dry,
          will_change: {
            from_enabled: !!(cur?.enabled),
            to_enabled: true,
            title: input.title || cur?.title || 'Опрос по участию в проектах',
            deadline: input.deadline || null,
            description: input.description || null,
            started_by: ctx.userName || ctx.userId,
          },
        };
        if (dry) return { ...preview, instruction: 'Покажи юзеру и спроси «подтверждаешь?». Только после явного «да» — повторно с dry_run=false. Напомни что после старта все сотрудники увидят форму на /project-survey.' };
        const payload = {
          id: 'default',
          enabled: true,
          title: preview.will_change.title,
          description: preview.will_change.description,
          deadline: preview.will_change.deadline,
          started_at: new Date().toISOString(),
          started_by: ctx.userId,
          started_by_name: ctx.userName || null,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('project_survey_config').upsert(payload, { onConflict: 'id' });
        if (error) return { error: error.message };
        return { ...preview, applied: true };
      }

      case 'stop_survey': {
        const dry = input.dry_run !== false;
        const { data: cur } = await supabase
          .from('project_survey_config')
          .select('*')
          .eq('id', 'default')
          .maybeSingle();
        const preview = {
          dry_run: dry,
          will_change: { from_enabled: !!(cur?.enabled), to_enabled: false },
        };
        if (dry) return { ...preview, instruction: 'Покажи юзеру что опрос будет остановлен и спроси «подтверждаешь?». Сотрудники больше не смогут отвечать.' };
        const { error } = await supabase
          .from('project_survey_config')
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq('id', 'default');
        if (error) return { error: error.message };
        return { ...preview, applied: true };
      }

      case 'assign_to_project': {
        const dry = input.dry_run !== false;
        const [proj, emp] = await Promise.all([
          supabase.from('projects').select('id, name, notes').eq('id', input.projectId).maybeSingle().then((r) => r.data),
          supabase.from('employees').select('id, name, role').eq('id', input.employeeId).maybeSingle().then((r) => r.data),
        ]);
        if (!proj) return { error: 'Project not found' };
        if (!emp) return { error: 'Employee not found' };
        const notes = typeof proj.notes === 'string' ? safeParse(proj.notes) : proj.notes;
        const existingTeam = Array.isArray(notes?.team) ? notes.team : [];
        const existingIds = new Set(existingTeam.map((m) => m.userId || m.id));
        if (existingIds.has(emp.id)) {
          return { error: `Сотрудник ${emp.name} уже в команде проекта.` };
        }
        const preview = {
          dry_run: dry,
          will_change: {
            project_id: proj.id,
            project_name: proj.name,
            add_employee: { id: emp.id, name: emp.name, role: input.role },
            team_size_before: existingTeam.length,
            team_size_after: existingTeam.length + 1,
          },
        };
        if (dry) return { ...preview, instruction: 'Покажи юзеру и спроси «подтверждаешь?». Только после явного «да» — повторно с dry_run=false.' };
        const newMember = { userId: emp.id, id: emp.id, name: emp.name, role: input.role, assignedAt: new Date().toISOString() };
        const nextTeam = [...existingTeam, newMember];
        const nextTeamIds = Array.from(new Set([...(notes?.teamIds || []), emp.id]));
        const nextNotes = { ...(notes || {}), team: nextTeam, teamIds: nextTeamIds };
        const { error } = await supabase
          .from('projects')
          .update({ notes: JSON.stringify(nextNotes), updated_at: new Date().toISOString() })
          .eq('id', proj.id);
        if (error) return { error: error.message };
        return { ...preview, applied: true };
      }

      case 'remove_from_project': {
        const dry = input.dry_run !== false;
        const [proj, emp] = await Promise.all([
          supabase.from('projects').select('id, name, notes').eq('id', input.projectId).maybeSingle().then((r) => r.data),
          supabase.from('employees').select('id, name').eq('id', input.employeeId).maybeSingle().then((r) => r.data),
        ]);
        if (!proj) return { error: 'Project not found' };
        if (!emp) return { error: 'Employee not found' };
        const notes = typeof proj.notes === 'string' ? safeParse(proj.notes) : proj.notes;
        const existingTeam = Array.isArray(notes?.team) ? notes.team : [];
        const present = existingTeam.some((m) => (m.userId || m.id) === emp.id);
        if (!present) return { error: `Сотрудник ${emp.name} не в команде этого проекта.` };
        const preview = {
          dry_run: dry,
          will_change: {
            project_id: proj.id,
            project_name: proj.name,
            remove_employee: { id: emp.id, name: emp.name },
            team_size_before: existingTeam.length,
            team_size_after: existingTeam.length - 1,
          },
        };
        if (dry) return { ...preview, instruction: 'Покажи юзеру что сотрудник будет удалён из команды и спроси «подтверждаешь?».' };
        const nextTeam = existingTeam.filter((m) => (m.userId || m.id) !== emp.id);
        const nextTeamIds = (notes?.teamIds || []).filter((id) => id !== emp.id);
        const nextNotes = { ...(notes || {}), team: nextTeam, teamIds: nextTeamIds };
        const { error } = await supabase
          .from('projects')
          .update({ notes: JSON.stringify(nextNotes), updated_at: new Date().toISOString() })
          .eq('id', proj.id);
        if (error) return { error: error.message };
        return { ...preview, applied: true };
      }

      case 'update_employee_role': {
        const dry = input.dry_run !== false;
        const { data: emp, error } = await supabase
          .from('employees')
          .select('id, name, role')
          .eq('id', input.employeeId)
          .maybeSingle();
        if (error) return { error: error.message };
        if (!emp) return { error: 'Employee not found' };
        if (emp.role === input.newRole) return { error: `У сотрудника уже роль ${input.newRole}.` };
        const preview = {
          dry_run: dry,
          will_change: {
            employee_id: emp.id,
            employee_name: emp.name,
            from_role: emp.role,
            to_role: input.newRole,
            reason: input.reason || null,
          },
        };
        if (dry) return { ...preview, instruction: 'ОСТОРОЖНО — это меняет уровень доступа сотрудника. Объясни юзеру что будет сделано, попроси убедиться что это намеренно, и только после явного «да» — повторно с dry_run=false.' };
        const { error: updErr } = await supabase
          .from('employees')
          .update({ role: input.newRole, updated_at: new Date().toISOString() })
          .eq('id', emp.id);
        if (updErr) return { error: updErr.message };
        return { ...preview, applied: true };
      }

      case 'list_tasks': {
        let q = supabase
          .from('ai_tasks')
          .select('id, title, assigned_to, assigned_to_name, status, priority, due_date, created_at, related_project_id')
          .order('created_at', { ascending: false })
          .limit(Math.min(input.limit || 30, 100));
        if (input.assignedTo) q = q.eq('assigned_to', input.assignedTo);
        if (input.status) q = q.eq('status', input.status);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { tasks: data || [] };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: String(err?.message || err) };
  }
}

// ─── System prompt (стабильный, для prompt caching) ────────────────────────

function buildSystemPrompt(memorySnippets, verifiedRole) {
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

0. **НАШИ КОМПАНИИ И БРЕНДЫ (важно для поиска):**
   - В фирме 5 собственных юр.лиц (таблица companies): RB Partners IT Audit, Russell Bedford A+ Partners, Parker Russell, Fin Consulting, Andersonkz.
   - Дополнительно у каждого проекта есть **бренд-сокращение** в notes.ourCompany. Известные бренды: «МАК», «RB IT», «RB», «Parker Russell», «Fin Consulting», «Andersonkz». Это короткие обозначения, которые используют сотрудники в речи. ВНИМАНИЕ: «МАК» — это НАШ бренд, не клиент, не аббревиатура даты!
   - Если юзер пишет «проекты в МАК», «сколько у МАК», «команда МАК» — это **наш бренд ourCompany**. Вызывай list_projects(ourCompany='МАК'). НЕ ищи по дате! НЕ ищи в клиентах!
   - Если юзер пишет название известного клиента (ТОО ..., АО ...) — это клиент, ищи через list_projects(search='...').
   - Если не уверен, что юзер имеет в виду (наш бренд или клиент) — переспроси.

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
ЧТЕНИЕ (доступно всегда):
- list_projects(status?, search?, ourCompany?, periodFrom?, periodTo?, limit?): список проектов с фильтрами. **ourCompany** = наш бренд (МАК/RB IT/Parker Russell/Fin Consulting/Andersonkz). periodFrom/periodTo — фильтр по диапазону аудиторского периода.
- get_project: детали проекта (команда, клиент, период, бюджет).
- list_companies: 5 наших юр.лиц.
- list_employees: список сотрудников.
- get_employee_workload: загрузка сотрудника.
- list_survey_responses: статистика по опросу.
- list_survey_proposals: авто-предложения по командам.
- list_tasks: задачи в системе.
- recent_ai_activity: твой audit log.
- save_memory: запись в долговременную память.

ДИАГНОСТИКА (read-only):
- find_gaps(category): «дыры» в данных — проекты без команды, протухшие proposals (>7 дней), сотрудники без активных проектов, неподанные опросы, проекты без обновлений >30 дней. category='all' = всё сразу.
- generate_report(type): сводные отчёты — projects_by_status, projects_started_completed, survey_completion, employees_workload, ai_spending.

ЗАПИСЬ (только для роли ceo/admin/deputy_director — текущая роль: ${verifiedRole || '???'}):
- approve_proposal(projectId): утвердить состав команды из опроса.
- reject_proposal(projectId, reason): отклонить предложение.
- update_project_status(projectId, newStatus, reason): изменить статус проекта.
- create_task(assignedToEmployeeId, title, description, priority, dueDate, relatedProjectId): создать задачу сотруднику.
- start_survey(deadline?, title?, description?): запустить опрос «кто в каком проекте».
- stop_survey(): остановить опрос.
- assign_to_project(projectId, employeeId, role): добавить сотрудника в команду проекта.
- remove_from_project(projectId, employeeId): убрать сотрудника из команды.
- update_employee_role(employeeId, newRole, reason): сменить роль сотрудника (ТОЛЬКО ceo/admin, не deputy_director).

«КАРТОТЕКА» — заметки AI про сотрудников и проекты:
У тебя есть структурированная база знаний «кто что делает / что у нас по проекту X». Реализована через ai_memory с разными scope:
- save_memory(key, content, scope='employee:<employee_id>', importance) — заметка про сотрудника
- save_memory(key, content, scope='project:<project_id>', importance) — заметка про проект
- save_memory(key, content, scope='workspace', importance) — общее правило фирмы
- save_memory(key, content, scope='user', importance) — личное предпочтение юзера
- recall_notes(scope) — достать ВСЕ заметки данного scope

ВАЖНО: при вызове get_employee_workload или get_project — ты АВТОМАТИЧЕСКИ получаешь ai_notes по этому объекту в ответе. Не игнорируй их — они твои собственные знания. Когда юзер тебе что-то рассказывает про сотрудника / проект — сохраняй это как заметку с подходящим importance.

КРИТИЧНЫЕ ПРАВИЛА WRITE-FLOW (обязательны!):
1. ВСЕ write-tools (approve_proposal, reject_proposal, update_project_status, create_task) обязаны вызываться ДВАЖДЫ:
   - Первый раз: с dry_run=true (default). Tool вернёт will_change/will_create — что БУДЕТ сделано.
   - Покажи юзеру в чате что именно изменится: «Я собираюсь: <описание>. Подтверждаешь? (да/нет)»
   - Жди явного подтверждения пользователя в следующем сообщении.
   - Только после явного «да», «yes», «ок», «давай», «утверждаю» — вызови tool ПОВТОРНО с dry_run=false.
2. Если юзер сказал «отмени», «нет», «не надо», «стоп» — НЕ вызывай tool второй раз. Подтверди отмену.
3. Если ты не уверен в намерении — переспроси, не делай.
4. Один write per turn. Не пакуй несколько изменений в одно сообщение AI — пользователь должен видеть каждое.
5. Никогда не вызывай write-tool сразу с dry_run=false без предварительного dry_run=true в том же диалоге.

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
- У тебя ЕСТЬ права менять данные (если роль пользователя ceo/admin/deputy_director), но ТОЛЬКО через двухфазный confirm-flow (см. правила выше).
- Если у пользователя другая роль — write-tools вернут PERMISSION_DENIED. Скажи юзеру что это сделает только ceo/admin/зам.дир.
- Канал доставки уведомлений (Telegram/email) пока НЕ подключён. Когда создаёшь задачу через create_task — задача появится в БД, но автоматическое уведомление сотруднику не уйдёт. Предупреди юзера об этом.
- При диагностике (find_gaps) или отчётах НЕ вызывай больше 1-2 tools — find_gaps уже агрегирует.

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

  // ─── 0. Server-side проверка роли (не доверяем клиенту) ────────────────
  // Клиент шлёт userRole, но мы ВЕРИФИЦИРУЕМ его по employees.role в БД.
  // Если расходится — берём роль из БД. Если юзера в employees нет —
  // отказываем в чате (для smoke-тестов разрешим через env флаг).
  const { data: empRow } = await supabase
    .from('employees')
    .select('id, name, role')
    .eq('id', userId)
    .maybeSingle();
  const verifiedRole = empRow?.role || null;
  const allowSmokeTest = process.env.AI_CHAT_ALLOW_UNKNOWN_USER === 'true';
  if (!empRow && !allowSmokeTest) {
    return res.status(403).json({
      error: 'USER_NOT_FOUND',
      message: 'Пользователь не найден в системе. Чат доступен только зарегистрированным сотрудникам.',
    });
  }
  // verifiedRole может быть null для smoke-теста — тогда write-tools будут отказывать.

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
  const systemPrompt = buildSystemPrompt(memoryRows || [], verifiedRole);
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
      const out = await execTool(supabase, { userId, userName, userRole, serverVerifiedRole: verifiedRole }, block.name, block.input);
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
