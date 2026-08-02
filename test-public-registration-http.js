const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the public registration HTTP integration test');
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl, child, output) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) {
      throw new Error(`Registration test server exited early:\n${output.join('')}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/admin/auth/config`);
      if (response.ok) return;
    } catch (error) {
      // The child process is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Registration test server did not start:\n${output.join('')}`);
}

async function request(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  return { response, data: await response.json() };
}

async function run() {
  const [emailPort, appPort] = await Promise.all([getFreePort(), getFreePort()]);
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const delivered = [];
  const emailServer = http.createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      delivered.push({ headers: req.headers, body: JSON.parse(body) });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: `email_${delivered.length}` }));
    });
  });
  await new Promise((resolve, reject) => {
    emailServer.once('error', reject);
    emailServer.listen(emailPort, '127.0.0.1', resolve);
  });

  const output = [];
  const child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      ADMIN_PASSWORD: 'registration-test-master',
      APP_BASE_URL: baseUrl,
      EMAIL_FROM: 'Markdown Mash <info@mail.markdownmash.test>',
      EMAIL_REPLY_TO: 'info@markdownmash.test',
      GUEST_TRIAL_JWT_SECRET: 'b'.repeat(64),
      HOSTED_MODE: 'true',
      JWT_SECRET: 'a'.repeat(64),
      NODE_ENV: 'development',
      PORT: String(appPort),
      PUBLIC_SIGNUP_ENABLED: 'true',
      RESEND_API_KEY: 're_registration_test',
      RESEND_API_URL: `http://127.0.0.1:${emailPort}/emails`,
      STRIPE_BILLING_ENABLED: 'true',
      STRIPE_PRICE_ID: 'price_registration_test',
      STRIPE_SECRET_KEY: 'sk_test_registration',
      STRIPE_WEBHOOK_SECRET: 'whsec_registration_test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', chunk => output.push(chunk.toString()));
  child.stderr.on('data', chunk => output.push(chunk.toString()));

  try {
    await waitForServer(baseUrl, child, output);
    const config = await request(baseUrl, '/api/admin/auth/config');
    assert.equal(config.data.publicSignup, true);
    assert.equal(config.data.publicRegistration, true);

    const suffix = Date.now().toString(36);
    const email = `registration-${suffix}@example.com`;
    const registered = await request(baseUrl, '/api/admin/register', {
      email,
      displayName: 'Registration Teacher'
    });
    assert.equal(registered.response.status, 202);
    assert.equal(delivered.length, 1);
    assert.deepEqual(delivered[0].body.to, [email]);
    assert.equal(delivered[0].body.reply_to, 'info@markdownmash.test');
    assert.match(delivered[0].headers['idempotency-key'], /^markdown-mash-verification-/);

    const inviteUrl = delivered[0].body.text.match(/https?:\/\/\S+#invite=[A-Za-z0-9_-]+/)[0];
    const token = new URLSearchParams(new URL(inviteUrl).hash.slice(1)).get('invite');
    assert.ok(token);
    const inspected = await request(baseUrl, '/api/admin/invite/inspect', { token });
    assert.equal(inspected.response.status, 200);
    assert.notEqual(inspected.data.invitation.maskedEmail, email);

    const password = 'registration test password';
    const activated = await request(baseUrl, '/api/admin/invite/activate', { token, password });
    assert.equal(activated.response.status, 200);
    assert.equal(activated.data.checkoutAfterActivation, true);
    const login = await request(baseUrl, '/api/admin/login', { email, password });
    assert.equal(login.response.status, 200);

    const duplicate = await request(baseUrl, '/api/admin/register', {
      email,
      displayName: 'Enumeration Attempt'
    });
    assert.equal(duplicate.response.status, 202);
    assert.equal(duplicate.data.message, registered.data.message);
    assert.equal(delivered.length, 1);

    console.log('Public registration HTTP integration tests passed');
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise(resolve => child.once('exit', resolve));
    }
    await new Promise(resolve => emailServer.close(resolve));
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
