/**
 * Серверная копия src/lib/ai/piiMask.ts — нужна потому что Vercel Node Function
 * (`.mjs`) не импортирует TypeScript напрямую.
 *
 * Логика 1:1 с TS-версией. Юнит-тесты на src/lib/ai/piiMask.test.ts покрывают
 * этот же алгоритм. Если меняешь — синхронизируй оба файла.
 */

export function createMask() {
  return { unmask: new Map(), mask: new Map() };
}

function makeToken(prefix, value, counter) {
  const seed = ((value.length * 31 + counter + (value.charCodeAt(0) || 0)) >>> 0);
  return `${prefix}_${seed.toString(36).padStart(4, '0').slice(0, 6)}_${counter}`;
}

export function maskValue(mask, prefix, value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return value;
  const existing = mask.mask.get(trimmed);
  if (existing) return existing;
  const token = makeToken(prefix, trimmed, mask.mask.size);
  mask.mask.set(trimmed, token);
  mask.unmask.set(token, trimmed);
  return token;
}

export function maskText(mask, text) {
  if (!text) return text;
  const entries = Array.from(mask.mask.entries()).sort((a, b) => b[0].length - a[0].length);
  let result = text;
  for (const [real, token] of entries) {
    if (!real) continue;
    const escaped = real.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), token);
  }
  return result;
}

export function unmaskText(mask, text) {
  if (!text) return text;
  const entries = Array.from(mask.unmask.entries()).sort((a, b) => b[0].length - a[0].length);
  let result = text;
  for (const [token, real] of entries) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), real);
  }
  return result;
}

export function unmaskDeep(mask, obj) {
  if (obj == null) return obj;
  if (typeof obj === 'string') return unmaskText(mask, obj);
  if (Array.isArray(obj)) return obj.map((v) => unmaskDeep(mask, v));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = unmaskDeep(mask, v);
    return out;
  }
  return obj;
}

export function maskStats(mask) {
  let users = 0, clients = 0, managers = 0, partners = 0;
  for (const token of mask.unmask.keys()) {
    if (token.startsWith('User_')) users++;
    else if (token.startsWith('Client_')) clients++;
    else if (token.startsWith('Manager_')) managers++;
    else if (token.startsWith('Partner_')) partners++;
  }
  return { users, clients, managers, partners, total: mask.unmask.size };
}
