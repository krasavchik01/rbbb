import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';

async function startServer() {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rbbb-file-auth-'));
  const projectDir = path.join(storageDir, 'project-a');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'secret.txt'), 'classified project file', 'utf8');

  const port = 32000 + (process.pid % 10000);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      NAS_STORAGE_PATH: storageDir,
      ALLOWED_ORIGINS: 'http://localhost',
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
      server.kill('SIGTERM');
      await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 1000))]);
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
