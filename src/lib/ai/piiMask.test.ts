/**
 * Тесты PII-маскировки. Главные инварианты:
 *  1. Один и тот же реальный текст → один и тот же токен в рамках одной маски.
 *  2. mask → unmask возвращает исходный текст 1:1.
 *  3. Длинные имена не разбиваются неаккуратной заменой по подстроке.
 *  4. Spec символы внутри значения (точки, скобки) не ломают regex.
 *  5. Размаскировка работает рекурсивно для вложенных JSON-объектов
 *     (это нужно для ответа Claude).
 */

import { describe, it, expect } from 'vitest';
import {
  createMask,
  maskValue,
  maskText,
  unmaskText,
  unmaskDeep,
  maskStats,
} from './piiMask';

describe('maskValue', () => {
  it('возвращает тот же токен при повторной маскировке того же значения', () => {
    const m = createMask();
    const a = maskValue(m, 'User', 'Иванов Иван');
    const b = maskValue(m, 'User', 'Иванов Иван');
    expect(a).toBe(b);
  });

  it('генерирует разные токены для разных значений', () => {
    const m = createMask();
    const a = maskValue(m, 'User', 'Иванов Иван');
    const b = maskValue(m, 'User', 'Петров Пётр');
    expect(a).not.toBe(b);
  });

  it('пустое значение не маскируется', () => {
    const m = createMask();
    expect(maskValue(m, 'User', '')).toBe('');
    expect(m.unmask.size).toBe(0);
  });

  it('каждый префикс даёт читаемый токен', () => {
    const m = createMask();
    expect(maskValue(m, 'User', 'Иванов')).toMatch(/^User_/);
    expect(maskValue(m, 'Client', 'ТОО X')).toMatch(/^Client_/);
    expect(maskValue(m, 'Manager', 'Mgr')).toMatch(/^Manager_/);
    expect(maskValue(m, 'Partner', 'Partner Y')).toMatch(/^Partner_/);
  });
});

describe('maskText', () => {
  it('заменяет все вхождения зарегистрированного значения', () => {
    const m = createMask();
    const token = maskValue(m, 'User', 'Иванов Иван');
    const text = 'Иванов Иван работал с Иванов Иван на проекте';
    const masked = maskText(m, text);
    expect(masked).not.toContain('Иванов Иван');
    expect(masked.split(token).length - 1).toBe(2);
  });

  it('длинные имена заменяются полностью, а не по подстроке', () => {
    // Регистрируем И длинное «Иванов Иван Иванович», И короткое «Иванов».
    // Длинное должно матчиться первым — иначе «Иванов» съест начало.
    const m = createMask();
    const long = maskValue(m, 'User', 'Иванов Иван Иванович');
    const short = maskValue(m, 'User', 'Иванов');
    const text = 'Иванов Иван Иванович и Иванов работали вместе';
    const masked = maskText(m, text);
    expect(masked).toContain(long);
    expect(masked).toContain(short);
    expect(masked).not.toContain('Иванов Иван Иванович');
    // У нас 1 long и 1 standalone short → ровно по одному
    expect((masked.match(new RegExp(long, 'g')) || []).length).toBe(1);
    expect((masked.match(new RegExp(short, 'g')) || []).length).toBe(1);
  });

  it('обрабатывает regex-метасимволы внутри значений', () => {
    const m = createMask();
    const token = maskValue(m, 'Client', 'АО "Co., Ltd. (test)"');
    const text = 'Работали с АО "Co., Ltd. (test)" в марте';
    const masked = maskText(m, text);
    expect(masked).toContain(token);
    expect(masked).not.toContain('Co., Ltd.');
  });
});

describe('unmaskText', () => {
  it('mask → unmask = identity', () => {
    const m = createMask();
    maskValue(m, 'User', 'Иванов Иван');
    maskValue(m, 'Client', 'ТОО Karaton');
    const original = 'Иванов Иван работал на ТОО Karaton 8 часов';
    const masked = maskText(m, original);
    const restored = unmaskText(m, masked);
    expect(restored).toBe(original);
  });

  it('не трогает текст без токенов', () => {
    const m = createMask();
    maskValue(m, 'User', 'Иванов');
    expect(unmaskText(m, 'обычный текст без масок')).toBe('обычный текст без масок');
  });
});

describe('unmaskDeep', () => {
  it('заменяет токены во вложенных строках объекта', () => {
    const m = createMask();
    const userTok = maskValue(m, 'User', 'Иванов Иван');
    const clientTok = maskValue(m, 'Client', 'ТОО Karaton');

    const llmResponse = {
      summary: `${userTok} работал на ${clientTok}`,
      answers: [
        { projectName: clientTok, role: 'assistant', comment: `обсуждал с ${userTok}` },
      ],
      meta: { user: userTok, count: 5, ok: true },
    };

    const unmasked = unmaskDeep(m, llmResponse);
    expect(unmasked.summary).toBe('Иванов Иван работал на ТОО Karaton');
    expect(unmasked.answers[0].projectName).toBe('ТОО Karaton');
    expect(unmasked.answers[0].comment).toBe('обсуждал с Иванов Иван');
    expect(unmasked.meta.user).toBe('Иванов Иван');
    // Числа и булевы не меняются
    expect(unmasked.meta.count).toBe(5);
    expect(unmasked.meta.ok).toBe(true);
  });

  it('null и undefined проходят без ошибок', () => {
    const m = createMask();
    expect(unmaskDeep(m, null)).toBeNull();
    expect(unmaskDeep(m, undefined)).toBeUndefined();
  });
});

describe('maskStats', () => {
  it('считает количество замаскированных значений по типу', () => {
    const m = createMask();
    maskValue(m, 'User', 'A');
    maskValue(m, 'User', 'B');
    maskValue(m, 'Client', 'C1');
    maskValue(m, 'Client', 'C2');
    maskValue(m, 'Client', 'C3');
    maskValue(m, 'Manager', 'M');
    const s = maskStats(m);
    expect(s.users).toBe(2);
    expect(s.clients).toBe(3);
    expect(s.managers).toBe(1);
    expect(s.partners).toBe(0);
    expect(s.total).toBe(6);
  });
});
