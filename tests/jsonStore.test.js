const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../utils/jsonStore');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nivasa-store-'));
  return path.join(dir, 'sub', 'items.json');
}

test('a missing file reads as an empty list', async () => {
  const store = createStore(tempFile());
  assert.deepStrictEqual(await store.readAll(), []);
});

test('add saves records to the JSON file and readAll returns them', async () => {
  const file = tempFile();
  const store = createStore(file);
  await store.add({ id: 1, message: 'first' });
  await store.add({ id: 2, message: 'second' });
  assert.deepStrictEqual((await store.readAll()).map((r) => r.id), [1, 2]);
  const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(onDisk.length, 2);
});

test('many adds at the same time all survive (writes are queued)', async () => {
  const store = createStore(tempFile());
  await Promise.all(Array.from({ length: 20 }, (_, i) => store.add({ id: i })));
  assert.strictEqual((await store.readAll()).length, 20);
});
