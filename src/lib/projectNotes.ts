import type {
  CanonicalProjectFinances,
  CanonicalProjectNotes,
  ProjectNotesParseResult,
} from '@/types/project-domain';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export class InvalidProjectNotesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProjectNotesError';
  }
}

export function parseProjectNotes(raw: unknown): ProjectNotesParseResult {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: {}, raw };
  }
  if (isRecord(raw)) {
    return { ok: true, value: raw as CanonicalProjectNotes, raw };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: `Unsupported notes type: ${typeof raw}`, raw };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed)
      ? { ok: true, value: parsed as CanonicalProjectNotes, raw }
      : { ok: false, error: 'Project notes JSON must contain an object', raw };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      raw,
    };
  }
}

export function getProjectNotes(
  project: ({ notes?: unknown } & Record<string, unknown>) | null | undefined,
): CanonicalProjectNotes {
  const result = parseProjectNotes(project?.notes);
  return result.ok ? result.value : {};
}

export function mergeProjectNotes(
  raw: unknown,
  patch: Partial<CanonicalProjectNotes>,
): CanonicalProjectNotes {
  const parsed = parseProjectNotes(raw);
  if (!parsed.ok) {
    throw new InvalidProjectNotesError(parsed.error);
  }

  const oldFinances = isRecord(parsed.value.finances) ? parsed.value.finances : {};
  const patchFinances = isRecord(patch.finances) ? patch.finances : undefined;
  const finances = patchFinances
    ? ({ ...oldFinances, ...patchFinances } as CanonicalProjectFinances)
    : parsed.value.finances;

  return {
    ...parsed.value,
    ...patch,
    ...(finances ? { finances } : {}),
  };
}

export function serializeProjectNotes(notes: CanonicalProjectNotes): string {
  return JSON.stringify(notes);
}
