import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dataStoreSource = fs.readFileSync(new URL('../src/lib/supabaseDataStore.ts', import.meta.url), 'utf8');
const fileManagerSource = fs.readFileSync(new URL('../src/components/projects/ProjectFileManager.tsx', import.meta.url), 'utf8');
const contractEditorSource = fs.readFileSync(new URL('../src/components/projects/ContractEditor.tsx', import.meta.url), 'utf8');

test('project file upload fails loudly if Seafile metadata cannot be persisted to project notes', () => {
  assert.match(dataStoreSource, /await this\.updateProject\(projectId, \{/);
  assert.match(dataStoreSource, /files: updatedFiles/);
  assert.match(dataStoreSource, /category === 'contract' \? \{ contract: updatedContract \}/);
  assert.match(dataStoreSource, /catch \(metadataError\) \{\s*console\.error\('Could not sync uploaded file metadata to project notes:', metadataError\);\s*throw new Error\('Файл загружен в Seafile, но не закрепился в карточке проекта\./s);
  assert.doesNotMatch(dataStoreSource, /catch \(metadataError\) \{\s*console\.warn\('Could not sync uploaded file metadata to project notes:', metadataError\);\s*\}/s);
});

test('project file manager opens Seafile files through backend download-url proxy', () => {
  assert.match(fileManagerSource, /getSeafileDownloadUrl\(file\.storagePath\)/);
  assert.match(dataStoreSource, /\/api\/seafile\/download-url\?path=\$\{encodeURIComponent\(storagePath\)\}/);
});

test('contract tab opens Seafile contract and amendment links through backend download-url proxy', () => {
  assert.match(contractEditorSource, /supabaseDataStore\.getSeafileDownloadUrl\(storagePath\)/);
  assert.match(contractEditorSource, /openAmendmentFile/);
  assert.match(contractEditorSource, /openProjectFile\(file, label\)/);
});
