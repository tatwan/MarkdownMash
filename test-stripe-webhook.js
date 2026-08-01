const assert = require('node:assert/strict');
const net = require('node:net');
const { spawn } = require('node:child_process');
const Stripe = require('stripe');

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
      throw new Error(`Stripe webhook test server exited early:\n${output.join('')}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/admin/auth/config`);
      if (response.ok) return;
    } catch (error) {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Stripe webhook test server did not start:\n${output.join('')}`);
}

async function run() {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const webhookSecret = 'whsec_markdown_mash_test_secret';
  const output = [];
  const child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      APP_BASE_URL: baseUrl,
      DATABASE_URL: 'postgresql://localhost/markdown_mash_stripe_test',
      GUEST_TRIAL_JWT_SECRET: 'b'.repeat(64),
      HOSTED_MODE: 'true',
      JWT_SECRET: 'a'.repeat(64),
      NODE_ENV: 'development',
      PORT: String(port),
      SKIP_DATABASE_INIT: 'true',
      STRIPE_BILLING_ENABLED: 'true',
      STRIPE_PRICE_ID: 'price_markdown_mash_yearly',
      STRIPE_SECRET_KEY: 'sk_test_markdown_mash',
      STRIPE_WEBHOOK_SECRET: webhookSecret
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', chunk => output.push(chunk.toString()));
  child.stderr.on('data', chunk => output.push(chunk.toString()));

  try {
    await waitForServer(baseUrl, child, output);
    const config = await fetch(`${baseUrl}/api/admin/auth/config`).then(response => response.json());
    assert.equal(config.billingEnabled, true);

    const payload = JSON.stringify({
      id: 'evt_unhandled_test',
      object: 'event',
      created: Math.floor(Date.now() / 1000),
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test' } }
    });

    const invalid = await fetch(`${baseUrl}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'invalid'
      },
      body: payload
    });
    assert.equal(invalid.status, 400, 'invalid webhook signatures must be rejected');

    const stripe = new Stripe('sk_test_markdown_mash');
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret
    });
    const valid = await fetch(`${baseUrl}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature
      },
      body: payload
    });
    const result = await valid.json();
    assert.equal(valid.status, 200, `signed webhook failed: ${result.error || ''}`);
    assert.equal(result.received, true);

    console.log('Stripe webhook signature and raw-body tests passed');
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise(resolve => child.once('exit', resolve));
    }
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
