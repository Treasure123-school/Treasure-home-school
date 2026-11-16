require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: 'require', max: 1 });
(async () => {
  // Reset the 3 leftover source enrollments to pre-promotion state
  const u = await pool.query(`UPDATE student_enrollments
    SET status='active', promotion_outcome=NULL, promoted_to_class_id=NULL, updated_at=NOW()
    WHERE session_id=2`);
  console.log('reset source enrollments:', u.rowCount);

  // Insert the other 83
  const s = await pool.query(`INSERT INTO student_enrollments (student_id, session_id, class_id, status)
    SELECT s.id, 2, s.class_id, 'active'
    FROM students s
    WHERE s.class_id IS NOT NULL
    ON CONFLICT (student_id, session_id) DO NOTHING`);
  console.log('inserted:', s.rowCount);

  const v = await pool.query(`SELECT
    (SELECT COUNT(*) FROM student_enrollments WHERE session_id=2 AND status='active') active_src,
    (SELECT COUNT(*) FROM student_enrollments WHERE session_id=3) dst,
    (SELECT COUNT(*) FROM promotion_batches) b, (SELECT COUNT(*) FROM promotion_records) r,
    (SELECT COUNT(*) FROM users WHERE status='active' AND role_id=4) active_students`);
  console.log('VERIFY {active_src, dest, batches, records, active_students}:', JSON.stringify(v.rows[0]));
  await pool.end();
})().catch(e => { console.log('ERR:', e.message.slice(0, 200)); process.exit(1); });
