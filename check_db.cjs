const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the database.');
});

db.serialize(() => {
  db.all(`SELECT id, student_id, started_at, submitted_at, time_remaining, is_completed, status, metadata FROM exam_sessions LIMIT 5;`, (err, rows) => {
    if (err) {
      console.error(err.message);
    }
    console.log(rows);
  });
});

db.close();
