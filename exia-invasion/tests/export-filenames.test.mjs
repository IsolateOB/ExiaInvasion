import test from 'node:test';
import assert from 'node:assert/strict';

import { createUniqueExportFileName } from '../src/utils/exportFilenames.js';

test('createUniqueExportFileName uses account name and uid to avoid same-name collisions', () => {
  const usedNames = new Set();

  const first = createUniqueExportFileName({
    accountName: 'Alice',
    gameUid: '1001',
    extension: 'xlsx',
    usedNames,
  });
  const second = createUniqueExportFileName({
    accountName: 'Alice',
    gameUid: '1002',
    extension: 'xlsx',
    usedNames,
  });

  assert.equal(first, 'Alice_1001.xlsx');
  assert.equal(second, 'Alice_1002.xlsx');
});

test('createUniqueExportFileName keeps filenames unique even when name and uid both repeat', () => {
  const usedNames = new Set();

  const first = createUniqueExportFileName({
    accountName: 'Alice',
    gameUid: '1001',
    extension: 'json',
    usedNames,
  });
  const second = createUniqueExportFileName({
    accountName: 'Alice',
    gameUid: '1001',
    extension: 'json',
    usedNames,
  });

  assert.equal(first, 'Alice_1001.json');
  assert.equal(second, 'Alice_1001 (2).json');
});

test('createUniqueExportFileName falls back to account name when uid is missing', () => {
  const usedNames = new Set();

  const first = createUniqueExportFileName({
    accountName: 'Alice',
    gameUid: '',
    extension: 'xlsx',
    usedNames,
  });
  const second = createUniqueExportFileName({
    accountName: 'Alice',
    gameUid: null,
    extension: 'xlsx',
    usedNames,
  });

  assert.equal(first, 'Alice.xlsx');
  assert.equal(second, 'Alice (2).xlsx');
});
