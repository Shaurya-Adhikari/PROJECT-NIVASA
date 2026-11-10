// MongoDB connection. Uses MONGO_URI when set (Atlas or a local mongod).
// In development without MONGO_URI, starts an embedded MongoDB that keeps
// its data in .data/ so accounts survive restarts.
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

let embedded = null;

async function connectDB() {
  let uri = process.env.MONGO_URI;

  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MONGO_URI is not set. Add it to your environment before starting in production.');
    }
    // Pin the binary cache so starting from another folder doesn't download it again
    process.env.MONGOMS_DOWNLOAD_DIR = process.env.MONGOMS_DOWNLOAD_DIR
      || path.join(__dirname, '..', 'node_modules', '.cache', 'mongodb-memory-server');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const dbPath = path.join(__dirname, '..', '.data', 'db');
    fs.mkdirSync(dbPath, { recursive: true });
    embedded = await MongoMemoryServer.create({
      instance: { dbPath, storageEngine: 'wiredTiger', port: Number(process.env.EMBEDDED_DB_PORT) || 27027 },
    });
    uri = embedded.getUri('nivasa');
    console.log('[db] MONGO_URI not set, using embedded MongoDB at .data/db');
  }

  await mongoose.connect(uri);
  console.log('[db] connected');
  return mongoose.connection;
}

async function disconnectDB() {
  if (embedded && mongoose.connection.readyState === 1) {
    // Flush recent writes to disk before the embedded server is stopped
    await mongoose.connection.db.admin().command({ fsync: 1 }).catch(() => {});
  }
  await mongoose.disconnect();
  if (embedded) await embedded.stop({ doCleanup: false });
}

module.exports = { connectDB, disconnectDB };
