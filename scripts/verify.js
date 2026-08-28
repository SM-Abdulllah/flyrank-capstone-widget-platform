const assert = require('node:assert/strict');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const origin = process.env.VERIFY_ORIGIN || 'http://localhost:5500';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return {
    response,
    body
  };
}

async function login(email) {
  const { response, body } = await request('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password: 'Password123!'
    })
  });

  assert.equal(response.status, 200);
  assert.ok(body.token);
  return body.token;
}

async function main() {
  const tenantAToken = await login('owner-a@example.com');
  await login('owner-b@example.com');

  const bundle = await request('/widget.v1.js?id=tenant-a-demo-signup', {
    headers: {
      Origin: origin
    }
  });
  assert.equal(bundle.response.status, 200);
  assert.match(bundle.response.headers.get('cache-control'), /max-age=31536000/);
  assert.match(bundle.response.headers.get('cache-control'), /immutable/);

  const config = await request('/widgets/tenant-a-demo-signup/config', {
    headers: {
      Origin: origin
    }
  });
  assert.equal(config.response.status, 200);
  assert.match(config.response.headers.get('cache-control'), /max-age=60/);
  assert.equal(config.response.headers.get('access-control-allow-origin'), '*');

  const preflight = await fetch(`${baseUrl}/submissions`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type'
    }
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');

  const idempotencyKey = `verify-${Date.now()}`;
  const submission = await request('/submissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin
    },
    body: JSON.stringify({
      public_id: 'tenant-a-demo-signup',
      idempotency_key: idempotencyKey,
      submitted_data: {
        name: 'Verify User',
        email: 'verify@example.com'
      }
    })
  });
  assert.ok([200, 201].includes(submission.response.status));
  assert.equal(submission.body.accepted, true);
  assert.equal(submission.body.stored, true);

  const dashboard = await request('/api/dashboard/submissions', {
    headers: {
      Authorization: `Bearer ${tenantAToken}`
    }
  });
  assert.equal(dashboard.response.status, 200);
  assert.ok(
    dashboard.body.submissions.some((item) => item.idempotency_key === idempotencyKey)
  );

  console.log('Verify smoke checks passed');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Origin tested: ${origin}`);
}

main().catch((error) => {
  console.error('Verify smoke checks failed:', error.message);
  process.exitCode = 1;
});

