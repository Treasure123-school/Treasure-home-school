require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: 'require', max: 1 });
(async () => {
  // 1. Revert side effects of batch #1's 3 success records (users.status changes)
  const rev = await pool.query(`UPDATE users u SET status='active', is_active=true
    FROM promotion_records r
    WHERE r.batch_id = 1 AND r.status = 'success' AND r.student_id = u.id
      AND r.outcome IN ('graduated','withdrawn')`);
  console.log('reverted user statuses for', rev.rowCount, 'students');

  // 2. Wipe promotion data (batch was poisoned by the bad seed — re-run needed)
  const d1 = await pool.query('DELETE FROM promotion_records');
  const d2 = await pool.query('DELETE FROM promotion_batches');
  console.log('deleted records:', d1.rowCount, 'batches:', d2.rowCount);

  // 3. Remove all session-3 enrollments (my bad seed + 3 created by the batch)
  const d3 = await pool.query("DELETE FROM student_enrollments WHERE session_id = (SELECT id FROM academic_sessions WHERE status='active' LIMIT 1)");
  console.log('deleted session-3 enrollments:', d3.rowCount);

  // 4. Seed the real pre-promotion state: students enrolled in session 2 (source)
  const s = await pool.query(`INSERT INTO student_enrollments (student_id, session_id, class_id, status)
    SELECT s.id, (SELECT id FROM academic_sessions WHERE year='2025/2026'), s.class_id, 'active'
    FROM students s WHERE s.class_id IS NOT NULL`);
  console.log('seeded session-2 enrollments:', s.rowCount);

  const v = await pool.query(`SELECT
    (SELECT COUNT(*) FROM student_enrollments WHERE session_id=(SELECT id FROM academic_sessions WHERE year='2025/2026')) src,
    (SELECT COUNT(*) FROM student_enrollments WHERE session_id=(SELECT id FROM academic_sessions WHERE status='active' LIMIT 1)) dst,
    (SELECT COUNT(*) FROM promotion_batches) b, (SELECT COUNT(*) FROM promotion_records) r`);
  console.log('VERIFY {source, dest, batches, records}:', JSON.stringify(v.rows[0]));
  await pool.end();
})().catch(e => { console.log('ERR:', e.message.slice(0, 200)); process.exit(1); });
