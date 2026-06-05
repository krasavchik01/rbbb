import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import test from 'node:test';

function startFakeSupabaseAuth({ token = 'valid-token', user = {} } = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    requests.push({ method: req.method, path: url.pathname, authorization: req.headers.authorization || '', apikey: req.headers.apikey || '' });
    if (req.method === 'GET' && url.pathname === '/auth/v1/user' && req.headers.authorization === `Bearer ${token}`) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'jwt-user-1',
        email: 'jwt-user@example.com',
        app_metadata: { role: 'admin', ...(user.app_metadata || {}) },
        user_metadata: { name: 'JWT User', ...(user.user_metadata || {}) },
        ...user,
      }));
      return;
    }
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid token' }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        requests,
        async stop() {
          await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
        },
      });
    });
  });
}

function jwtAuthHeaders(token = 'valid-token') {
  return { Authorization: `Bearer ${token}` };
}

let nextServerOffset = 0;

async function startServer(extraEnv = {}) {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rbbb-file-auth-'));
  const projectDir = path.join(storageDir, 'project-a');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'secret.txt'), 'classified project file', 'utf8');

  const port = 32000 + (process.pid % 5000) + nextServerOffset++;
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      NAS_STORAGE_PATH: storageDir,
      ALLOWED_ORIGINS: 'http://localhost',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  server.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server did not start. Output:\n${output}`)), 8000);
    server.stdout.on('data', () => {
      if (output.includes(`Server running on port ${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`server exited early with code ${code}. Output:\n${output}`));
    });
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    storageDir,
    server,
    async stop() {
      if (server.exitCode !== null || server.signalCode !== null) {
        fs.rmSync(storageDir, { recursive: true, force: true });
        return;
      }
      server.kill('SIGTERM');
      const exited = await Promise.race([
        once(server, 'exit').then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 1000)),
      ]);
      if (!exited) {
        server.kill('SIGKILL');
        await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 1000))]);
      }
      fs.rmSync(storageDir, { recursive: true, force: true });
    },
  };
}

test('local project files require authenticated user context', async () => {
  const ctx = await startServer();
  try {
    const response = await fetch(`${ctx.baseUrl}/api/files/project-a/secret.txt`);
    assert.equal(response.status, 401);
  } finally {
    await ctx.stop();
  }
});

test('admin can download an existing local project file', async () => {
  const ctx = await startServer();
  try {
    const response = await fetch(`${ctx.baseUrl}/api/files/project-a/secret.txt`, {
      headers: {
        'x-user-id': 'admin-1',
        'x-user-role': 'admin',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'classified project file');
  } finally {
    await ctx.stop();
  }
});

test('plain employees cannot delete local project files', async () => {
  const ctx = await startServer();
  try {
    const response = await fetch(`${ctx.baseUrl}/api/files/project-a/secret.txt`, {
      method: 'DELETE',
      headers: {
        'x-user-id': 'employee-1',
        'x-user-role': 'employee',
      },
    });
    assert.equal(response.status, 403);
    assert.equal(fs.existsSync(path.join(ctx.storageDir, 'project-a', 'secret.txt')), true);
  } finally {
    await ctx.stop();
  }
});

test('seafile download-url proxy requires authenticated user context', async () => {
  const ctx = await startServer({
    SEAFILE_URL: 'http://127.0.0.1:9',
    SEAFILE_TOKEN: 'server-only-token',
    SEAFILE_REPO_ID: 'repo-1',
  });
  try {
    const response = await fetch(`${ctx.baseUrl}/api/seafile/download-url?path=${encodeURIComponent('/project-a/secret.txt')}`);
    assert.equal(response.status, 401);
  } finally {
    await ctx.stop();
  }
});

test('seafile download-url proxy calls Seafile with server-side token', async () => {
  let seenAuthorization = '';
  let seenPath = '';

  const fakeSeafile = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    seenAuthorization = req.headers.authorization || '';
    seenPath = url.searchParams.get('p') || '';
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('"https://files.example/download/secret.txt"');
  });
  await new Promise((resolve) => fakeSeafile.listen(0, '127.0.0.1', resolve));
  const { port } = fakeSeafile.address();

  const ctx = await startServer({
    SEAFILE_URL: `http://127.0.0.1:${port}`,
    SEAFILE_TOKEN: 'server-only-token',
    SEAFILE_REPO_ID: 'repo-1',
  });

  try {
    const response = await fetch(`${ctx.baseUrl}/api/seafile/download-url?path=${encodeURIComponent('/project-a/secret.txt')}`, {
      headers: {
        'x-user-id': 'admin-1',
        'x-user-role': 'admin',
      },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { url: 'https://files.example/download/secret.txt' });
    assert.equal(seenAuthorization, 'Token server-only-token');
    assert.equal(seenPath, '/project-a/secret.txt');
  } finally {
    await ctx.stop();
    await new Promise((resolve, reject) => {
      fakeSeafile.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('seafile list proxy calls Seafile with server-side token', async () => {
  let seenAuthorization = '';
  let seenPath = '';

  const fakeSeafile = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    seenAuthorization = req.headers.authorization || '';
    seenPath = url.searchParams.get('p') || '';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([{ id: 'file-1', type: 'file', name: 'contract.pdf', size: 123, mtime: 1700000000 }]));
  });
  await new Promise((resolve) => fakeSeafile.listen(0, '127.0.0.1', resolve));
  const { port } = fakeSeafile.address();

  const ctx = await startServer({
    SEAFILE_URL: `http://127.0.0.1:${port}`,
    SEAFILE_TOKEN: 'server-only-token',
    SEAFILE_REPO_ID: 'repo-1',
  });

  try {
    const response = await fetch(`${ctx.baseUrl}/api/seafile/list?path=${encodeURIComponent('/project-a')}`, {
      headers: {
        'x-user-id': 'admin-1',
        'x-user-role': 'admin',
      },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      entries: [{ id: 'file-1', type: 'file', name: 'contract.pdf', size: 123, mtime: 1700000000 }],
    });
    assert.equal(seenAuthorization, 'Token server-only-token');
    assert.equal(seenPath, '/project-a');
  } finally {
    await ctx.stop();
    await new Promise((resolve, reject) => {
      fakeSeafile.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('seafile delete proxy requires privileged role and calls Seafile with server-side token', async () => {
  let deleteAuthorization = '';
  let deletePath = '';

  const fakeSeafile = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'DELETE') {
      deleteAuthorization = req.headers.authorization || '';
      deletePath = url.searchParams.get('p') || '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => fakeSeafile.listen(0, '127.0.0.1', resolve));
  const { port } = fakeSeafile.address();

  const ctx = await startServer({
    SEAFILE_URL: `http://127.0.0.1:${port}`,
    SEAFILE_TOKEN: 'server-only-token',
    SEAFILE_REPO_ID: 'repo-1',
  });

  try {
    const denied = await fetch(`${ctx.baseUrl}/api/seafile/file?path=${encodeURIComponent('/project-a/secret.txt')}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': 'employee-1',
        'x-user-role': 'employee',
      },
    });
    assert.equal(denied.status, 403);

    const allowed = await fetch(`${ctx.baseUrl}/api/seafile/file?path=${encodeURIComponent('/project-a/secret.txt')}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': 'manager-1',
        'x-user-role': 'manager',
      },
    });
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), { success: true });
    assert.equal(deleteAuthorization, 'Token server-only-token');
    assert.equal(deletePath, '/project-a/secret.txt');
  } finally {
    await ctx.stop();
    await new Promise((resolve, reject) => {
      fakeSeafile.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('seafile upload proxy uploads through server-side token', async () => {
  const seen = [];

  const fakeSeafile = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    seen.push({ method: req.method, path: url.pathname, queryPath: url.searchParams.get('p') || '', auth: req.headers.authorization || '' });

    if (req.method === 'GET' && url.pathname === '/api2/repos/repo-1/upload-link/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`"http://127.0.0.1:${fakeSeafile.address().port}/upload-target"`);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/upload-target') {
      let body = Buffer.alloc(0);
      req.on('data', (chunk) => { body = Buffer.concat([body, chunk]); });
      req.on('end', () => {
        assert.match(body.toString('latin1'), /hello from upload/);
        assert.match(body.toString('latin1'), /relative_path/);
        assert.match(body.toString('latin1'), /project-a/);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });
      return;
    }

    res.writeHead(404).end();
  });
  await new Promise((resolve) => fakeSeafile.listen(0, '127.0.0.1', resolve));
  const { port } = fakeSeafile.address();

  const ctx = await startServer({
    SEAFILE_URL: `http://127.0.0.1:${port}`,
    SEAFILE_TOKEN: 'server-only-token',
    SEAFILE_REPO_ID: 'repo-1',
  });

  try {
    const form = new FormData();
    form.append('file', new Blob(['hello from upload'], { type: 'text/plain' }), 'note.txt');
    form.append('projectId', 'project-a');
    form.append('category', 'document');
    form.append('uploadedBy', 'manager-1');

    const response = await fetch(`${ctx.baseUrl}/api/seafile/upload`, {
      method: 'POST',
      headers: {
        'x-user-id': 'manager-1',
        'x-user-role': 'manager',
      },
      body: form,
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.file.fileName, 'note.txt');
    assert.equal(payload.file.storagePath, '/project-a/note.txt');
    assert.equal(payload.file.isSeafile, true);
    assert.equal(payload.file.publicUrl, 'seafile:///project-a/note.txt');
    assert.equal(seen[0].auth, 'Token server-only-token');
    assert.equal(seen[1].auth, 'Token server-only-token');
  } finally {
    await ctx.stop();
    await new Promise((resolve, reject) => {
      fakeSeafile.close((error) => error ? reject(error) : resolve());
    });
  }
});



test('strict JWT mode rejects spoofed x-user headers without bearer token', async () => {
  const fakeAuth = await startFakeSupabaseAuth();
  const ctx = await startServer({
    REQUIRE_SUPABASE_JWT: 'true',
    SUPABASE_URL: fakeAuth.url,
    SUPABASE_ANON_KEY: 'test-anon-key',
  });

  try {
    const response = await fetch(`${ctx.baseUrl}/api/files/project-a/secret.txt`, {
      headers: {
        'x-user-id': 'admin-1',
        'x-user-role': 'admin',
      },
    });
    assert.equal(response.status, 401);
    assert.equal(fakeAuth.requests.length, 0);
  } finally {
    await ctx.stop();
    await fakeAuth.stop();
  }
});

test('strict JWT mode derives user and role from validated Supabase JWT', async () => {
  const fakeAuth = await startFakeSupabaseAuth({ token: 'valid-token' });
  const ctx = await startServer({
    REQUIRE_SUPABASE_JWT: 'true',
    SUPABASE_URL: fakeAuth.url,
    SUPABASE_ANON_KEY: 'test-anon-key',
  });

  try {
    const response = await fetch(`${ctx.baseUrl}/api/files/project-a/secret.txt`, {
      headers: jwtAuthHeaders('valid-token'),
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'classified project file');
    assert.equal(fakeAuth.requests[0].authorization, 'Bearer valid-token');
    assert.equal(fakeAuth.requests[0].apikey, 'test-anon-key');
  } finally {
    await ctx.stop();
    await fakeAuth.stop();
  }
});

test('strict JWT mode ignores spoofed x-user-role when checking privileges', async () => {
  const fakeAuth = await startFakeSupabaseAuth({
    token: 'employee-token',
    user: { app_metadata: { role: 'employee' } },
  });
  const ctx = await startServer({
    REQUIRE_SUPABASE_JWT: 'true',
    SUPABASE_URL: fakeAuth.url,
    SUPABASE_ANON_KEY: 'test-anon-key',
  });

  try {
    const response = await fetch(`${ctx.baseUrl}/api/files/project-a/secret.txt`, {
      method: 'DELETE',
      headers: {
        ...jwtAuthHeaders('employee-token'),
        'x-user-role': 'admin',
      },
    });
    assert.equal(response.status, 403);
    assert.equal(fs.existsSync(path.join(ctx.storageDir, 'project-a', 'secret.txt')), true);
  } finally {
    await ctx.stop();
    await fakeAuth.stop();
  }
});
