// A tiny JSON file store: reads and writes an array of records in a local
// .json file with Node's fs module. Used for data that doesn't need MongoDB,
// such as site feedback.
const fs = require('fs/promises');
const path = require('path');

function createStore(filePath) {
  let queue = Promise.resolve(); // writes run one after another, never at the same time

  // Read the whole file; a missing file just means "no records yet"
  async function readAll() {
    try {
      const text = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(text);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  // Write to a temporary file first, then rename it over the real one,
  // so a crash halfway through never leaves a broken JSON file
  async function writeAll(records) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = filePath + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(records, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, filePath);
  }

  // Add one record (read → push → write), queued so two requests can't overwrite each other
  function add(record) {
    const job = queue.then(async () => {
      const records = await readAll();
      records.push(record);
      await writeAll(records);
      return record;
    });
    queue = job.catch(() => {});
    return job;
  }

  return { readAll, writeAll, add, filePath };
}

module.exports = { createStore };
