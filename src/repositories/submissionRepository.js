const { pool } = require('../db/pool');

function mapSubmission(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    widget_id: row.widget_id,
    widget_title: row.widget_title,
    idempotency_key: row.idempotency_key,
    submitted_data: row.submitted_data,
    ip_address: row.ip_address,
    country: row.country,
    city: row.city,
    geo_provider: row.geo_provider,
    created_at: row.created_at
  };
}

async function createSubmission(data) {
  const result = await pool.query(
    `
      INSERT INTO submissions (
        tenant_id, widget_id, idempotency_key, submitted_data,
        ip_address, country, city, geo_provider
      )
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
      ON CONFLICT (widget_id, idempotency_key) DO NOTHING
      RETURNING *
    `,
    [
      data.tenantId,
      data.widgetId,
      data.idempotencyKey,
      JSON.stringify(data.submittedData),
      data.ipAddress,
      data.country,
      data.city,
      data.geoProvider
    ]
  );

  if (result.rowCount > 0) {
    return {
      submission: mapSubmission(result.rows[0]),
      created: true
    };
  }

  const existing = await pool.query(
    `
      SELECT *
      FROM submissions
      WHERE widget_id = $1
      AND idempotency_key = $2
    `,
    [data.widgetId, data.idempotencyKey]
  );

  return {
    submission: mapSubmission(existing.rows[0]),
    created: false
  };
}

async function countForWidget(widgetId) {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS count FROM submissions WHERE widget_id = $1',
    [widgetId]
  );

  return result.rows[0].count;
}

async function listForTenant(tenantId, filters) {
  const values = [tenantId];
  const where = ['s.tenant_id = $1'];

  if (filters.widget_id) {
    values.push(filters.widget_id);
    where.push(`s.widget_id = $${values.length}`);
  }

  if (filters.from) {
    values.push(filters.from);
    where.push(`s.created_at >= $${values.length}`);
  }

  if (filters.to) {
    values.push(filters.to);
    where.push(`s.created_at <= $${values.length}`);
  }

  values.push(filters.limit);
  const limitParam = values.length;
  values.push(filters.offset);
  const offsetParam = values.length;

  const result = await pool.query(
    `
      SELECT s.*, w.title AS widget_title
      FROM submissions s
      JOIN widgets w ON w.id = s.widget_id
      WHERE ${where.join(' AND ')}
      ORDER BY s.created_at DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values
  );

  return result.rows.map(mapSubmission);
}

async function statsForTenant(tenantId) {
  const total = await pool.query(
    'SELECT COUNT(*)::int AS total FROM submissions WHERE tenant_id = $1',
    [tenantId]
  );

  const byWidget = await pool.query(
    `
      SELECT w.id AS widget_id, w.title, COUNT(s.id)::int AS count
      FROM widgets w
      LEFT JOIN submissions s ON s.widget_id = w.id AND s.tenant_id = $1
      WHERE w.tenant_id = $1
      GROUP BY w.id, w.title
      ORDER BY count DESC, w.title ASC
    `,
    [tenantId]
  );

  const overTime = await pool.query(
    `
      SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS count
      FROM submissions
      WHERE tenant_id = $1
      GROUP BY day
      ORDER BY day ASC
    `,
    [tenantId]
  );

  const byCountry = await pool.query(
    `
      SELECT COALESCE(country, 'Unknown') AS country, COUNT(*)::int AS count
      FROM submissions
      WHERE tenant_id = $1
      GROUP BY COALESCE(country, 'Unknown')
      ORDER BY count DESC, country ASC
    `,
    [tenantId]
  );

  return {
    total_submissions: total.rows[0].total,
    submissions_by_widget: byWidget.rows,
    submissions_over_time: overTime.rows,
    country_breakdown: byCountry.rows
  };
}

module.exports = {
  createSubmission,
  countForWidget,
  listForTenant,
  statsForTenant
};

