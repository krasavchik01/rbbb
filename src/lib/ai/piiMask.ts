/**
 * PII-маскировка для безопасной отправки данных в LLM.
 *
 * Идея: перед отправкой промпта в Claude API заменяем реальные ФИО, названия
 * клиентов и сотрудников на синтетические идентификаторы (User_a1b2, Client_c3d4).
 * LLM возвращает структурированный ответ, в котором используются те же
 * идентификаторы, а на бэкенде мы подменяем их обратно перед отдачей фронту.
 *
 * Юридическая страховка для аудиторской фирмы: даже если LLM-провайдер залоггирует
 * запрос (по умолчанию Anthropic этого не делает на API), реальные данные клиентов
 * туда не попадут.
 *
 * Маска живёт в памяти процесса (Vercel Function) на время одного запроса и не
 * сохраняется ни в БД, ни в audit log в исходной форме.
 */

export interface PiiMask {
  /** Маскированный → реальный */
  unmask: Map<string, string>;
  /** Реальный → маскированный (для замены в тексте) */
  mask: Map<string, string>;
}

export function createMask(): PiiMask {
  return { unmask: new Map(), mask: new Map() };
}

/**
 * Детерминированный токен на основе исходного значения и префикса.
 * Один и тот же реальный текст в рамках одной сессии даёт один и тот же токен,
 * что важно для дедупликации в промпте.
 */
function makeToken(prefix: string, value: string, counter: number): string {
  // Простой short-hash: первые 4 символа base36 от длины+counter+первой буквы.
  // Не криптография — просто стабильный читаемый идентификатор для LLM.
  const seed = (value.length * 31 + counter + (value.charCodeAt(0) || 0)) >>> 0;
  return `${prefix}_${seed.toString(36).padStart(4, '0').slice(0, 6)}_${counter}`;
}

/**
 * Регистрирует значение в маске. Если уже есть — возвращает существующий токен.
 * Если нет — создаёт новый и заполняет обе мапы.
 */
export function maskValue(
  mask: PiiMask,
  prefix: 'User' | 'Client' | 'Manager' | 'Partner',
  value: string,
): string {
  const trimmed = value.trim();
  if (!trimmed) return value; // не маскируем пустоту
  const existing = mask.mask.get(trimmed);
  if (existing) return existing;
  const token = makeToken(prefix, trimmed, mask.mask.size);
  mask.mask.set(trimmed, token);
  mask.unmask.set(token, trimmed);
  return token;
}

/**
 * Заменяет все вхождения зарегистрированных реальных значений на токены в
 * произвольном тексте. Использует один проход, отсортированный по длине строки
 * (длинные сначала), чтобы «Иванов Иван Иванович» не был частично заменён
 * по подстроке «Иванов».
 */
export function maskText(mask: PiiMask, text: string): string {
  if (!text) return text;
  // Сортируем по убыванию длины, чтобы более специфичные имена шли первыми
  const entries = Array.from(mask.mask.entries()).sort(
    (a, b) => b[0].length - a[0].length,
  );
  let result = text;
  for (const [real, token] of entries) {
    if (!real) continue;
    // Делаем замену с экранированием regex-метасимволов
    const escaped = real.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), token);
  }
  return result;
}

/**
 * Обратная операция: заменяет все известные токены обратно на реальные значения.
 * Применяется к ответу LLM перед отдачей фронту.
 */
export function unmaskText(mask: PiiMask, text: string): string {
  if (!text) return text;
  // Сортируем по убыванию длины токена тоже — у нас все токены одинаковой длины
  // по prefix, но на всякий случай.
  const entries = Array.from(mask.unmask.entries()).sort(
    (a, b) => b[0].length - a[0].length,
  );
  let result = text;
  for (const [token, real] of entries) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), real);
  }
  return result;
}

/**
 * Применяет unmaskText ко всем строковым полям объекта (рекурсивно).
 * Полезно для размаскировки ответа Claude: он возвращает JSON, в котором
 * нужно подменить все токены обратно.
 */
export function unmaskDeep<T>(mask: PiiMask, obj: T): T {
  if (obj == null) return obj;
  if (typeof obj === 'string') return unmaskText(mask, obj) as unknown as T;
  if (Array.isArray(obj)) return obj.map((v) => unmaskDeep(mask, v)) as unknown as T;
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = unmaskDeep(mask, v);
    }
    return out as unknown as T;
  }
  return obj;
}

/**
 * Стат для audit log — сколько уникальных PII было замаскировано.
 */
export function maskStats(mask: PiiMask): { users: number; clients: number; managers: number; partners: number; total: number } {
  let users = 0, clients = 0, managers = 0, partners = 0;
  for (const token of mask.unmask.keys()) {
    if (token.startsWith('User_')) users++;
    else if (token.startsWith('Client_')) clients++;
    else if (token.startsWith('Manager_')) managers++;
    else if (token.startsWith('Partner_')) partners++;
  }
  return { users, clients, managers, partners, total: mask.unmask.size };
}
