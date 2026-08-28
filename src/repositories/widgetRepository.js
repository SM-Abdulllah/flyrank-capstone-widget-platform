const { pool } = require('../db/pool');

function mapWidget(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    public_id: row.public_id,
    type: row.type,
    title: row.title,
    description: row.description,
    fields: row.fields,
    button_text: row.button_text,
    display_options: row.display_options,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function createWidget(tenantId, data) {
  const result = await pool.query(
    `
      INSERT INTO widgets (
        tenant_id, public_id, type, title, description, fields, button_text, display_options
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb)
      RETURNING *
    `,
    [
      tenantId,
      data.public_id,
      data.type,
      data.title,
      data.description,
      JSON.stringify(data.fields),
      data.button_text,
      JSON.stringify(data.display_options)
    ]
  );

  return mapWidget(result.rows[0]);
}

async function listWidgets(tenantId) {
  const result = await pool.query(
    `
      SELECT *
      FROM widgets
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `,
    [tenantId]
  );

  return result.rows.map(mapWidget);
}

async function getWidgetById(tenantId, id) {
  const result = await pool.query(
    `
      SELECT *
      FROM widgets
      WHERE id = $1
      AND tenant_id = $2
    `,
    [id, tenantId]
  );

  return mapWidget(result.rows[0]);
}

async function updateWidget(tenantId, id, data) {
  const result = await pool.query(
    `
      UPDATE widgets
      SET type = $3,
          title = $4,
          description = $5,
          fields = $6::jsonb,
          button_text = $7,
          display_options = $8::jsonb
      WHERE id = $1
      AND tenant_id = $2
      RETURNING *
    `,
    [
      id,
      tenantId,
      data.type,
      data.title,
      data.description,
      JSON.stringify(data.fields),
      data.button_text,
      JSON.stringify(data.display_options)
    ]
  );

  return mapWidget(result.rows[0]);
}

async function deleteWidget(tenantId, id) {
  const result = await pool.query(
    `
      DELETE FROM widgets
      WHERE id = $1
      AND tenant_id = $2
    `,
    [id, tenantId]
  );

  return result.rowCount > 0;
}

async function findByPublicId(publicId) {
  const result = await pool.query(
    `
      SELECT *
      FROM widgets
      WHERE public_id = $1
    `,
    [publicId]
  );

  return mapWidget(result.rows[0]);
}

module.exports = {
  createWidget,
  listWidgets,
  getWidgetById,
  updateWidget,
  deleteWidget,
  findByPublicId
};

