import { describe, expect, it } from 'vitest';
import {
  InvalidProjectNotesError,
  getProjectNotes,
  mergeProjectNotes,
  parseProjectNotes,
  serializeProjectNotes,
} from './projectNotes';
import { mapSupabaseProjectRow } from './supabaseDataStore';

describe('projectNotes', () => {
  it('parses string, object and empty notes', () => {
    expect(parseProjectNotes('{"team":[]}')).toMatchObject({ ok: true, value: { team: [] } });
    expect(parseProjectNotes({ finances: { bonusPercent: 10 } })).toMatchObject({
      ok: true,
      value: { finances: { bonusPercent: 10 } },
    });
    expect(parseProjectNotes(null)).toMatchObject({ ok: true, value: {} });
  });

  it('reports invalid JSON and refuses a write merge', () => {
    const parsed = parseProjectNotes('{broken');
    expect(parsed.ok).toBe(false);
    expect(() => mergeProjectNotes('{broken', { team: [] })).toThrow(InvalidProjectNotesError);
  });

  it('preserves unknown metadata and nested finance fields', () => {
    const raw = JSON.stringify({
      rbiEnrichment: { marker: 'auto:rbi-project-enrichment-2026-07-02' },
      contract: { number: 'A-1' },
      finances: { bonusPercent: 10, customLedgerField: 'keep' },
      team: [{ userId: 'old', role: 'assistant_1' }],
    });
    const next = mergeProjectNotes(raw, {
      finances: {
        teamBonuses: {
          u1: { role: 'assistant_1', percent: 2, amount: 100 },
        },
      },
      team: [{ userId: 'u1', userName: 'User', role: 'assistant_1', bonusPercent: 2 }],
    });

    expect(next.rbiEnrichment).toEqual({ marker: 'auto:rbi-project-enrichment-2026-07-02' });
    expect(next.contract).toEqual({ number: 'A-1' });
    expect(next.finances?.bonusPercent).toBe(10);
    expect(next.finances?.customLedgerField).toBe('keep');
    expect(next.team?.[0].userId).toBe('u1');
    expect(JSON.parse(serializeProjectNotes(next))).toEqual(next);
  });

  it('reads notes without trusting a top-level team alias', () => {
    const notes = getProjectNotes({
      team: [{ userId: 'wrong' }],
      notes: '{"team":[{"userId":"right"}]}',
    });

    expect(notes.team?.[0].userId).toBe('right');
  });

  it('maps invalid DB notes without inventing a team and exposes the parse error', () => {
    const mapped = mapSupabaseProjectRow({
      id: 'p1',
      name: 'DB name',
      notes: '{broken',
      status: 'active',
      start_date: '2026-01-01',
      deadline: '2026-12-31',
      partner_id: null,
      manager_id: null,
      kpi_percentage: 0,
      created_at: null,
      updated_at: null,
    });

    expect(mapped.team).toEqual([]);
    expect(mapped.notesParseError).toBeTruthy();
  });
});
