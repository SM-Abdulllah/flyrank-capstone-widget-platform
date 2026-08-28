const { pool } = require('../db/pool');

async function findByEmail(email) {
  const result = await pool.query(
    `
      SELECT id, tenant_id, email, password_hash
      FROM users
      WHERE email = $1
    `,
    [email.toLowerCase()]
  );

  return result.rows[0] || null;
}

module.exports = {
  findByEmail
};

