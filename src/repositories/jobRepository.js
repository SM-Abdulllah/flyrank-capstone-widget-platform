const { pool } = require('../db/pool');

async function enqueueNotification({ tenantId, submissionId, payload }) {
  const result = await pool.query(
    `
      INSERT INTO jobs (tenant_id, submission_id, type, payload)
      VALUES ($1, $2, 'notification', $3::jsonb)
      RETURNING *
    `,
    [tenantId, submissionId, JSON.stringify(payload)]
  );

  return result.rows[0];
}

async function claimNextJob() {
  const result = await pool.query(
    `
      UPDATE jobs
      SET status = 'processing',
          attempts = attempts + 1,
          locked_at = now()
      WHERE id = (
        SELECT id
        FROM jobs
        WHERE status = 'pending'
        AND run_at <= now()
        AND attempts < max_attempts
        ORDER BY run_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING *
    `
  );

  return result.rows[0] || null;
}

async function markCompleted(id) {
  await pool.query(
    `
      UPDATE jobs
      SET status = 'completed',
          locked_at = NULL,
          last_error = NULL
      WHERE id = $1
    `,
    [id]
  );
}

async function markFailed(job, errorMessage) {
  const exhausted = job.attempts >= job.max_attempts;
  const nextStatus = exhausted ? 'failed' : 'pending';
  const retryDelaySeconds = Math.min(job.attempts * 2, 10);

  await pool.query(
    `
      UPDATE jobs
      SET status = $2,
          locked_at = NULL,
          last_error = $3,
          run_at = CASE WHEN $2 = 'pending'
            THEN now() + ($4 || ' seconds')::interval
            ELSE run_at
          END
      WHERE id = $1
    `,
    [job.id, nextStatus, errorMessage.slice(0, 500), retryDelaySeconds]
  );

  return exhausted;
}

async function listRecentJobs(limit = 20) {
  const result = await pool.query(
    `
      SELECT *
      FROM jobs
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

module.exports = {
  enqueueNotification,
  claimNextJob,
  markCompleted,
  markFailed,
  listRecentJobs
};

