import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import test from 'node:test';

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
