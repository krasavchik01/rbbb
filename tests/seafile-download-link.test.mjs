import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import {
  getSeafileDownloadUrl,
  toSeafileBrowserUrl,
} from '../api/_seafile-utils.mjs';

test('Seafile download link is reusable for PDF range requests', async () => {
  let seenReuse = '';
  let seenPath = '';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    seenReuse = url.searchParams.get('reuse') || '';
    seenPath = url.searchParams.get('p') || '';
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('"https://cloud.rbpartners.kz/seafhttp/files/reusable-token/contract.pdf"');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const { port } = server.address();
    const url = await getSeafileDownloadUrl({
      seafileUrl: `http://127.0.0.1:${port}`,
      seafileToken: 'server-token',
      repoId: 'repo-1',
    }, '/project-a/contract.pdf');

    assert.equal(seenReuse, '1');
    assert.equal(seenPath, '/project-a/contract.pdf');
    assert.equal(url, 'https://cloud.rbpartners.kz/seafhttp/files/reusable-token/contract.pdf');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('official Seafile download URL is returned through the same-origin streaming proxy', () => {
  const url = toSeafileBrowserUrl(
    { seafileUrl: 'https://cloud.rbpartners.kz' },
    'https://cloud.rbpartners.kz/seafhttp/files/reusable-token/contract.pdf?dl=1',
  );

  assert.equal(url, '/seafile-proxy/seafhttp/files/reusable-token/contract.pdf?dl=1');
});

test('custom Seafile installations keep their direct download URL', () => {
  const direct = 'https://files.example.kz/seafhttp/files/token/contract.pdf';
  assert.equal(
    toSeafileBrowserUrl({ seafileUrl: 'https://files.example.kz' }, direct),
    direct,
  );
});
