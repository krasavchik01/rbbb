import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, refreshSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession, refreshSession },
  },
}));

import { apiGet } from './api';

describe('apiRequest session recovery', () => {
  beforeEach(() => {
    getSession.mockReset();
    refreshSession.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes an expired Supabase session and retries one protected request', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'old-token', refresh_token: 'refresh-token' } } });
    refreshSession.mockResolvedValue({ data: { session: { access_token: 'new-token', refresh_token: 'refresh-token' } } });
    const seenAuthorization: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      seenAuthorization.push(String((init.headers as Record<string, string>).Authorization || ''));
      return seenAuthorization.length === 1
        ? new Response(JSON.stringify({ error: 'Для доступа нужна актуальная сессия' }), { status: 401 })
        : new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGet('/api/1c/sync')).resolves.toEqual({ data: { success: true }, status: 200 });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(seenAuthorization).toEqual(['Bearer old-token', 'Bearer new-token']);
  });

  it('does not loop when there is no refreshable session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Для доступа нужна актуальная сессия' }), { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGet('/api/1c/sync')).resolves.toEqual({
      error: 'Для доступа нужна актуальная сессия',
      status: 401,
    });
    expect(refreshSession).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
