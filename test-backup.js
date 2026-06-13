const Database = require('better-sqlite3');
const db = new Database(':memory:');
db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY); INSERT INTO test VALUES (1);');
db.backup('test-backup.db').then(() => {
  console.log("Backup successful");
  const db2 = new Database('test-backup.db');
  console.log(db2.prepare('SELECT * FROM test').all());
});
