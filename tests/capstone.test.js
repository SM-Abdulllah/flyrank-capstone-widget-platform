process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-local-development-secret';
process.env.GEO_PROVIDER_A_MODE = 'success';
process.env.GEO_PROVIDER_B_MODE = 'success';
process.env.SIDE_EFFECT_MODE = 'success';
process.env.RATE_LIMIT_WINDOW_MS = '1000';
process.env.RATE_LIMIT_MAX = '4';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.BODY_LIMIT = '16kb';

const assert = require('node:assert/strict');
const { before, beforeEach, after, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { pool } = require('../src/db/pool');
const { runMigrations } = require('../src/db/migrate');
const publicRoutes = require('../src/routes/publicRoutes');
const { processOneJob } = require('../src/workers/notificationWorker');
const {
  seed,
  WIDGET_A_ID,
  WIDGET_B_ID
} = require('../scripts/seed');

const app = createApp();
const http = request(app);

let tokenA;
let tokenB;

async function login(email) {
  const response = await http
    .post('/auth/login')
    .send({ email, password: 'Password123!' })
    .expect(200);
  return response.body.token;
}

async function resetMutableData() {
  publicRoutes.resetSubmissionRateLimit();
  await pool.query('DELETE FROM jobs');
  await pool.query('DELETE FROM submissions');
  await pool.query(
    'DELETE FROM widgets WHERE id <> $1 AND id <> $2',
    [WIDGET_A_ID, WIDGET_B_ID]
  );
  process.env.GEO_PROVIDER_A_MODE = 'success';
  process.env.GEO_PROVIDER_B_MODE = 'success';
  process.env.SIDE_EFFECT_MODE = 'success';
}

async function countSubmissionsForWidget(widgetId = WIDGET_A_ID) {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS count FROM submissions WHERE widget_id = $1',
    [widgetId]
  );
  return result.rows[0].count;
}

function validSubmission(publicId, idempotencyKey) {
  return {
    public_id: publicId,
    idempotency_key: idempotencyKey,
    submitted_data: {
      name: 'Ada Lovelace',
      email: 'ada@example.com'
    }
  };
}

before(async () => {
  await runMigrations();
  await seed();
  tokenA = await login('owner-a@example.com');
  tokenB = await login('owner-b@example.com');
});

beforeEach(async () => {
  await resetMutableData();
});

after(async () => {
  await resetMutableData();
  await pool.end();
});

test('widget API rejects unauthenticated requests and supports authenticated CRUD', async () => {
  await http.get('/api/widgets').expect(401);

  const createResponse = await http
    .post('/api/widgets')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      type: 'signup',
      title: 'Newsletter',
      description: 'Get launch updates',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 80 },
        { name: 'email', label: 'Email', type: 'email', required: true, maxLength: 120 }
      ],
      button_text: 'Subscribe',
      display_options: { theme: 'light', placement: 'inline' }
    })
    .expect(201);

  const widget = createResponse.body.widget;
  assert.match(widget.embed_snippet, /widget\.v1\.js\?id=/);

  const listResponse = await http
    .get('/api/widgets')
    .set('Authorization', `Bearer ${tokenA}`)
    .expect(200);
  assert.ok(listResponse.body.widgets.some((item) => item.id === widget.id));

  await http
    .get(`/api/widgets/${widget.id}`)
    .set('Authorization', `Bearer ${tokenA}`)
    .expect(200);

  const updateResponse = await http
    .put(`/api/widgets/${widget.id}`)
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      type: 'signup',
      title: 'Updated newsletter',
      description: 'Updated description',
      fields: [
        { name: 'email', label: 'Email', type: 'email', required: true, maxLength: 120 }
      ],
      button_text: 'Join',
      display_options: { theme: 'dark', placement: 'inline' }
    })
    .expect(200);
  assert.equal(updateResponse.body.widget.title, 'Updated newsletter');

  await http
    .delete(`/api/widgets/${widget.id}`)
    .set('Authorization', `Bearer ${tokenA}`)
    .expect(204);

  await http
    .get(`/api/widgets/${widget.id}`)
    .set('Authorization', `Bearer ${tokenA}`)
    .expect(404);
});

test('system routes expose service metadata and protect hosted cron processing', async () => {
  const rootResponse = await http.get('/').expect(200);
  assert.equal(rootResponse.body.status, 'ok');
  assert.equal(rootResponse.body.health, '/health');

  process.env.CRON_SECRET = 'test-cron-secret';
  try {
    await http.get('/api/cron/process-jobs').expect(401);

    const cronResponse = await http
      .get('/api/cron/process-jobs')
      .set('Authorization', 'Bearer test-cron-secret')
      .expect(200);

    assert.equal(cronResponse.body.ok, true);
    assert.equal(cronResponse.body.processed, 0);
  } finally {
    delete process.env.CRON_SECRET;
  }
});

test('tenant isolation prevents cross-tenant widget and dashboard access', async () => {
  const createResponse = await http
    .post('/api/widgets')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      type: 'signup',
      title: 'Tenant A private widget',
      description: 'Isolation proof',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 80 },
        { name: 'email', label: 'Email', type: 'email', required: true, maxLength: 120 }
      ],
      button_text: 'Send',
      display_options: { theme: 'light', placement: 'inline' }
    })
    .expect(201);

  const widget = createResponse.body.widget;

  await http
    .get(`/api/widgets/${widget.id}`)
    .set('Authorization', `Bearer ${tokenB}`)
    .expect(404);

  await http
    .put(`/api/widgets/${widget.id}`)
    .set('Authorization', `Bearer ${tokenB}`)
    .send({
      type: 'signup',
      title: 'Tenant B should not edit this',
      description: 'Nope',
      fields: [
        { name: 'email', label: 'Email', type: 'email', required: true, maxLength: 120 }
      ],
      button_text: 'Send',
      display_options: { theme: 'light', placement: 'inline' }
    })
    .expect(404);

  await http
    .delete(`/api/widgets/${widget.id}`)
    .set('Authorization', `Bearer ${tokenB}`)
    .expect(404);

  await http
    .post('/submissions')
    .send(validSubmission(widget.public_id, 'tenant-isolation-1'))
    .expect(201);

  const tenantAResponses = await http
    .get('/api/dashboard/submissions')
    .set('Authorization', `Bearer ${tokenA}`)
    .expect(200);
  assert.equal(tenantAResponses.body.submissions.length, 1);

  const tenantBResponses = await http
    .get('/api/dashboard/submissions')
    .set('Authorization', `Bearer ${tokenB}`)
    .expect(200);
  assert.equal(tenantBResponses.body.submissions.length, 0);

  const tenantBStats = await http
    .get('/api/dashboard/stats')
    .set('Authorization', `Bearer ${tokenB}`)
    .expect(200);
  assert.equal(tenantBStats.body.stats.total_submissions, 0);
});

test('public config and versioned bundle expose safe cacheable responses', async () => {
  const scriptResponse = await http
    .get('/widget.v1.js?id=tenant-a-demo-signup')
    .set('Origin', 'http://localhost:5500')
    .expect(200);

  assert.match(scriptResponse.headers['cache-control'], /max-age=31536000/);
  assert.match(scriptResponse.headers['cache-control'], /immutable/);
  assert.equal(scriptResponse.headers['access-control-allow-origin'], '*');

  const configResponse = await http
    .get('/widgets/tenant-a-demo-signup/config')
    .set('Origin', 'http://localhost:5500')
    .expect(200);

  assert.match(configResponse.headers['cache-control'], /max-age=60/);
  assert.equal(configResponse.headers['access-control-allow-origin'], '*');
  assert.equal(configResponse.body.id, 'tenant-a-demo-signup');
  assert.equal(configResponse.body.tenant_id, undefined);
  assert.equal(configResponse.body.owner_email, undefined);
  assert.equal(configResponse.body.password_hash, undefined);
});

test('submission endpoint handles CORS preflight, malformed JSON, and oversized payloads', async () => {
  const optionsResponse = await http
    .options('/submissions')
    .set('Origin', 'http://localhost:5500')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'Content-Type')
    .expect(204);

  assert.equal(optionsResponse.headers['access-control-allow-origin'], '*');

  const malformedResponse = await http
    .post('/submissions')
    .set('Content-Type', 'application/json')
    .send('{"public_id":')
    .expect(400);
  assert.equal(malformedResponse.body.error.code, 'invalid_json');

  const invalidResponse = await http
    .post('/submissions')
    .send({ public_id: 'tenant-a-demo-signup', submitted_data: { email: 'not-an-email' } })
    .expect(400);
  assert.equal(invalidResponse.body.error.code, 'invalid_submission');

  const oversized = {
    public_id: 'tenant-a-demo-signup',
    idempotency_key: 'oversized',
    submitted_data: {
      name: 'A'.repeat(20000),
      email: 'ada@example.com'
    }
  };

  const oversizedResponse = await http.post('/submissions').send(oversized).expect(413);
  assert.equal(oversizedResponse.body.error.code, 'payload_too_large');
});

test('honeypot blocks storage and idempotency prevents duplicate rows', async () => {
  assert.equal(await countSubmissionsForWidget(), 0);

  await http
    .post('/submissions')
    .send({
      ...validSubmission('tenant-a-demo-signup', 'honeypot-1'),
      website: 'https://spam.example'
    })
    .expect(202);

  assert.equal(await countSubmissionsForWidget(), 0);

  await http.post('/submissions').send(validSubmission('tenant-a-demo-signup', 'same-key')).expect(201);
  const duplicate = await http
    .post('/submissions')
    .send(validSubmission('tenant-a-demo-signup', 'same-key'))
    .expect(200);

  assert.equal(duplicate.body.duplicate, true);
  assert.equal(await countSubmissionsForWidget(), 1);
});

test('geo enrichment stores provider A data, falls back to B, and degrades to null', async () => {
  process.env.GEO_PROVIDER_A_MODE = 'success';
  process.env.GEO_PROVIDER_B_MODE = 'fail';

  const providerAResponse = await http
    .post('/submissions')
    .send(validSubmission('tenant-a-demo-signup', 'geo-provider-a'))
    .expect(201);

  assert.equal(providerAResponse.body.submission.geo_provider, 'provider_a');
  assert.equal(providerAResponse.body.submission.country, 'Pakistan');

  publicRoutes.resetSubmissionRateLimit();
  process.env.GEO_PROVIDER_A_MODE = 'fail';
  process.env.GEO_PROVIDER_B_MODE = 'success';

  const fallbackResponse = await http
    .post('/submissions')
    .send(validSubmission('tenant-a-demo-signup', 'geo-provider-b'))
    .expect(201);

  assert.equal(fallbackResponse.body.submission.geo_provider, 'provider_b');
  assert.equal(fallbackResponse.body.submission.country, 'United States');

  process.env.GEO_PROVIDER_B_MODE = 'fail';

  const nullGeoResponse = await http
    .post('/submissions')
    .send(validSubmission('tenant-a-demo-signup', 'geo-null'))
    .expect(201);

  assert.equal(nullGeoResponse.body.submission.geo_provider, null);
  assert.equal(nullGeoResponse.body.submission.country, null);
});

test('public submission rate limit returns 429 and service remains healthy afterward', async () => {
  const responses = [];
  for (let index = 0; index < 5; index += 1) {
    responses.push(
      await http.post('/submissions').send(validSubmission('tenant-a-demo-signup', `burst-${index}`))
    );
  }

  assert.ok(responses.some((response) => response.status === 429));
  await http.get('/health').expect(200);

  await new Promise((resolve) => setTimeout(resolve, 1100));
  publicRoutes.resetSubmissionRateLimit();

  await http
    .post('/submissions')
    .send(validSubmission('tenant-a-demo-signup', 'after-rate-limit'))
    .expect(201);
});

test('side-effect failure does not roll back submission and worker records retries', async () => {
  process.env.SIDE_EFFECT_MODE = 'fail';

  await http
    .post('/submissions')
    .send(validSubmission('tenant-a-demo-signup', 'side-effect-fail'))
    .expect(201);

  assert.equal(await countSubmissionsForWidget(), 1);

  let failedJob = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await processOneJob();
    await pool.query("UPDATE jobs SET run_at = now() WHERE status = 'pending'");
    const current = await pool.query('SELECT status, attempts, last_error FROM jobs ORDER BY created_at DESC');
    if (current.rows[0] && current.rows[0].status === 'failed') {
      failedJob = current.rows[0];
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  assert.equal(failedJob.status, 'failed');
  assert.equal(failedJob.attempts, 3);
  assert.match(failedJob.last_error, /forced to fail/);
});
