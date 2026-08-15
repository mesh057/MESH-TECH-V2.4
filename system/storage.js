const fs = require('fs');
const path = require('path');

const configuredFile = process.env.DATA_FILE || process.env.MESH_DATA_FILE;
const dbFile = path.resolve(configuredFile || path.join(process.env.MESH_MULTI_USER_SESSION_DIR || __dirname, 'database.json'));

function loadDB() {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({}));
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    const quarantine = `${dbFile}.corrupt-${Date.now()}`;
    try { fs.renameSync(dbFile, quarantine); } catch (_) {}
    fs.writeFileSync(dbFile, JSON.stringify({}));
    return {};
  }
}

function saveDB(data) {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const temporary = `${dbFile}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2));
  fs.renameSync(temporary, dbFile);
}

function getValue(key) {
  const db = loadDB();
  return db[key];
}

function setValue(key, value) {
  const db = loadDB();
  db[key] = value;
  saveDB(db);
}

function deleteKey(key) {
  const db = loadDB();
  delete db[key];
  saveDB(db);
}

module.exports = {
  getValue,
  setValue,
  deleteKey,
  loadDB,
  saveDB,
  dbFile,
};
