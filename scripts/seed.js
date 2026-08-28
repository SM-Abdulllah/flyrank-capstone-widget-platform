const bcrypt = require('bcryptjs');
const { pool } = require('../src/db/pool');
const { runMigrations } = require('../src/db/migrate');

const TENANT_A_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_B_ID = '22222222-2222-4222-8222-222222222222';
const USER_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WIDGET_A_ID = 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa';
const WIDGET_B_ID = 'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb';
const DEMO_PASSWORD = 'Password123!';

const signupFields = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    required: true,
    maxLength: 80
  },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    required: true,
    maxLength: 120
  }
];

const contactFields = [
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    required: true,
    maxLength: 120
  },
  {
    name: 'message',
    label: 'Message',
    type: 'textarea',
    required: true,
    maxLength: 500
  }
];

async function seed() {
  await runMigrations();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await pool.query(
    `
      INSERT INTO tenants (id, name)
      VALUES ($1, 'Tenant A'), ($2, 'Tenant B')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `,
    [TENANT_A_ID, TENANT_B_ID]
  );

  await pool.query(
    `
      INSERT INTO users (id, tenant_id, email, password_hash)
      VALUES
        ($1, $2, 'owner-a@example.com', $3),
        ($4, $5, 'owner-b@example.com', $3)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `,
    [USER_A_ID, TENANT_A_ID, passwordHash, USER_B_ID, TENANT_B_ID]
  );

  await pool.query(
    `
      INSERT INTO widgets (
        id, tenant_id, public_id, type, title, description,
        fields, button_text, display_options
      )
      VALUES
        ($1, $2, 'tenant-a-demo-signup', 'signup', 'Join Tenant A',
          'A demo signup widget for the FlyRank capstone.',
          $3::jsonb, 'Join now', $4::jsonb),
        ($5, $6, 'tenant-b-demo-contact', 'contact', 'Contact Tenant B',
          'A demo contact widget for proving tenant isolation.',
          $7::jsonb, 'Send message', $8::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET title = EXCLUDED.title,
          description = EXCLUDED.description,
          fields = EXCLUDED.fields,
          button_text = EXCLUDED.button_text,
          display_options = EXCLUDED.display_options
    `,
    [
      WIDGET_A_ID,
      TENANT_A_ID,
      JSON.stringify(signupFields),
      JSON.stringify({ theme: 'light', placement: 'inline' }),
      WIDGET_B_ID,
      TENANT_B_ID,
      JSON.stringify(contactFields),
      JSON.stringify({ theme: 'light', placement: 'inline' })
    ]
  );

  console.log('Seed complete');
  console.log('Tenant A: owner-a@example.com / Password123!');
  console.log('Tenant B: owner-b@example.com / Password123!');
  console.log('Tenant A widget public id: tenant-a-demo-signup');
  console.log('Tenant B widget public id: tenant-b-demo-contact');
}

if (require.main === module) {
  seed()
    .catch((error) => {
      console.error('Seed failed', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = {
  seed,
  TENANT_A_ID,
  TENANT_B_ID,
  WIDGET_A_ID,
  WIDGET_B_ID,
  DEMO_PASSWORD
};

