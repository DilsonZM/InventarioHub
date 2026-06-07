const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../db.json');

function read() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function write(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function generateId(prefix) {
  return `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 5)}`;
}

module.exports = { read, write, generateId };
