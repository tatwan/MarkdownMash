const assert = require('node:assert/strict');
const {
  getHostedBillingFailure,
  hasHostedRoomEntitlement,
  invoiceSubscriptionId,
  normalizeStripeSubscription,
  subscriptionAccountStatus
} = require('./billing');
const {
  BillingRequestError,
  createStripeBillingService,
  eventSubscriptionId
} = require('./stripe-billing');

const priceId = 'price_markdown_mash_yearly';
const account = {
  id: 42,
  role: 'admin',
  auth_source: 'hosted',
  email: 'teacher@example.com',
  email_verified_at: new Date(),
  display_name: 'Teacher'
};

function stripeSubscription(overrides = {}) {
  return {
    id: 'sub_markdown_mash',
    status: 'active',
    customer: 'cus_markdown_mash',
    cancel_at_period_end: false,
    metadata: { app: 'markdown_mash', account_id: '42' },
    items: {
      data: [{
        price: { id: priceId },
        quantity: 1,
        current_period_end: 1810000000
      }]
    },
    ...overrides
  };
}

assert.equal(hasHostedRoomEntitlement({ status: 'active' }), true);
assert.equal(hasHostedRoomEntitlement({ status: 'past_due' }), true);
assert.equal(hasHostedRoomEntitlement({ status: 'canceled' }), false);
assert.equal(subscriptionAccountStatus('active'), 'active');
assert.equal(subscriptionAccountStatus('past_due'), 'past_due');
assert.equal(
  subscriptionAccountStatus('unpaid'),
  'active',
  'billing lapse should keep sign-in available for history and resubscription'
);
assert.equal(
  getHostedBillingFailure({
    billingEnabled: true,
    hostedMode: true,
    admin: { role: 'admin', authSource: 'hosted' },
    subscription: null
  }).code,
  'SUBSCRIPTION_REQUIRED'
);
assert.equal(
  getHostedBillingFailure({
    billingEnabled: true,
    hostedMode: true,
    admin: { role: 'master', authSource: 'deployment' },
    subscription: null
  }),
  null,
  'the deployment master remains exempt from billing guardrails'
);

const normalized = normalizeStripeSubscription(stripeSubscription(), priceId);
assert.equal(normalized.accountId, 42);
assert.equal(normalized.providerCustomerId, 'cus_markdown_mash');
assert.equal(normalized.currentPeriodEnd.toISOString(), '2027-05-11T01:46:40.000Z');
assert.equal(
  normalizeStripeSubscription(
    stripeSubscription({ metadata: { app: 'atollo_scout', account_id: '42' } }),
    priceId
  ),
  null,
  'another product in the shared Stripe account must not grant access'
);
assert.equal(
  normalizeStripeSubscription(stripeSubscription(), 'price_other'),
  null,
  'an unexpected Stripe price must not grant access'
);

assert.equal(
  invoiceSubscriptionId({ parent: { subscription_details: { subscription: 'sub_parent' } } }),
  'sub_parent'
);
assert.equal(
  eventSubscriptionId({
    type: 'invoice.paid',
    data: { object: { parent: { subscription_details: { subscription: 'sub_invoice' } } } }
  }),
  'sub_invoice'
);

async function run() {
  const calls = [];
  let storedSubscription = null;
  const appliedEvents = [];
  const db = {
    async getSubscriptionByAccountId() {
      return storedSubscription;
    },
    async upsertStripeCustomer(accountId, customerId) {
      storedSubscription = {
        account_id: accountId,
        provider_customer_id: customerId,
        status: 'checkout_pending'
      };
      return storedSubscription;
    },
    async applyStripeBillingEvent(event) {
      appliedEvents.push(event);
      return { duplicate: false, outcome: event.subscription ? 'processed' : 'ignored' };
    }
  };
  const stripe = {
    customers: {
      async create(params, options) {
        calls.push({ type: 'customer', params, options });
        return { id: 'cus_markdown_mash' };
      }
    },
    checkout: {
      sessions: {
        async create(params) {
          calls.push({ type: 'checkout', params });
          return { id: 'cs_test_mash', url: 'https://checkout.stripe.test/session' };
        }
      }
    },
    billingPortal: {
      sessions: {
        async create(params) {
          calls.push({ type: 'portal', params });
          return { url: 'https://billing.stripe.test/session' };
        }
      }
    },
    subscriptions: {
      async retrieve(id) {
        calls.push({ type: 'retrieve', id });
        return stripeSubscription({ id });
      }
    }
  };
  const service = createStripeBillingService({
    stripe,
    db,
    priceId,
    appBaseUrl: 'https://mash.example/'
  });

  const checkout = await service.createCheckoutSession(account);
  assert.equal(checkout.url, 'https://checkout.stripe.test/session');
  assert.equal(calls[0].options.idempotencyKey, 'markdown_mash:customer:42');
  assert.deepEqual(calls[1].params.line_items, [{ price: priceId, quantity: 1 }]);
  assert.deepEqual(calls[1].params.subscription_data.metadata, {
    app: 'markdown_mash',
    account_id: '42'
  });
  assert.equal(calls[1].params.success_url, 'https://mash.example/admin.html?billing=success');

  storedSubscription.status = 'active';
  await assert.rejects(
    () => service.createCheckoutSession(account),
    error => error instanceof BillingRequestError && error.code === 'SUBSCRIPTION_ALREADY_ACTIVE'
  );

  const portal = await service.createPortalSession(account);
  assert.equal(portal.url, 'https://billing.stripe.test/session');
  assert.equal(calls.at(-1).params.customer, 'cus_markdown_mash');

  await service.processEvent({
    id: 'evt_checkout',
    type: 'checkout.session.completed',
    created: 1800000000,
    data: {
      object: {
        mode: 'subscription',
        subscription: 'sub_checkout',
        client_reference_id: '42',
        metadata: { app: 'markdown_mash', account_id: '42' }
      }
    }
  }, 'digest-checkout');
  assert.equal(appliedEvents[0].subscription.accountId, 42);
  assert.equal(appliedEvents[0].subscription.providerSubscriptionId, 'sub_checkout');

  await service.processEvent({
    id: 'evt_other_product',
    type: 'customer.subscription.deleted',
    created: 1800000001,
    data: {
      object: stripeSubscription({
        status: 'canceled',
        metadata: { app: 'atollo_scout', account_id: '42' }
      })
    }
  }, 'digest-other');
  assert.equal(appliedEvents[1].subscription, null);

  console.log('Stripe billing tests passed');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
