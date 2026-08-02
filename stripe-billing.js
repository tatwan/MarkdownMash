const {
  BILLING_APP,
  normalizeStripeSubscription,
  invoiceSubscriptionId,
  stripeObjectId
} = require('./billing');

const HANDLED_STRIPE_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required'
]);

class BillingConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BillingConfigurationError';
    this.code = 'BILLING_CONFIGURATION_ERROR';
  }
}

class BillingRequestError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'BillingRequestError';
    this.code = code;
    this.status = status;
  }
}

function assertHostedInstructor(account) {
  if (!account
    || account.role === 'master'
    || account.auth_source !== 'hosted'
    || !account.email
    || !account.email_verified_at) {
    throw new BillingRequestError(
      'BILLING_ACCOUNT_INELIGIBLE',
      'Billing is available only for verified hosted accounts.',
      403
    );
  }
}

function eventSubscriptionObject(event) {
  if (event.type.startsWith('customer.subscription.')) {
    return event.data.object;
  }
  return null;
}

function eventSubscriptionId(event) {
  const object = event.data.object;
  if (event.type === 'checkout.session.completed') {
    return stripeObjectId(object.subscription);
  }
  if (event.type.startsWith('customer.subscription.')) {
    return stripeObjectId(object);
  }
  if (event.type.startsWith('invoice.')) {
    return invoiceSubscriptionId(object);
  }
  return null;
}

function createStripeBillingService({ stripe, db, priceId, appBaseUrl }) {
  if (!stripe || !db || !priceId || !appBaseUrl) {
    throw new BillingConfigurationError('Stripe billing requires a client, database, price, and app URL.');
  }

  const baseUrl = appBaseUrl.replace(/\/$/, '');

  async function createCheckoutSession(account) {
    assertHostedInstructor(account);

    const existing = await db.getSubscriptionByAccountId(account.id);
    if (['active', 'trialing', 'past_due'].includes(existing?.status)) {
      throw new BillingRequestError(
        'SUBSCRIPTION_ALREADY_ACTIVE',
        'This account already has a subscription. Use Manage billing instead.',
        409
      );
    }

    let customerId = existing?.provider_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: account.email,
          name: account.display_name || undefined,
          metadata: {
            app: BILLING_APP,
            account_id: String(account.id)
          }
        },
        { idempotencyKey: `${BILLING_APP}:customer:${account.id}` }
      );
      customerId = customer.id;
      await db.upsertStripeCustomer(account.id, customerId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: String(account.id),
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      payment_method_collection: 'always',
      success_url: `${baseUrl}/admin.html?billing=success`,
      cancel_url: `${baseUrl}/admin.html?billing=cancelled`,
      metadata: {
        app: BILLING_APP,
        account_id: String(account.id)
      },
      subscription_data: {
        metadata: {
          app: BILLING_APP,
          account_id: String(account.id)
        }
      }
    });

    return { id: session.id, url: session.url };
  }

  async function createPortalSession(account) {
    assertHostedInstructor(account);
    const subscription = await db.getSubscriptionByAccountId(account.id);
    if (!subscription?.provider_customer_id) {
      throw new BillingRequestError(
        'BILLING_CUSTOMER_NOT_FOUND',
        'Start a subscription before opening the billing portal.',
        404
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.provider_customer_id,
      return_url: `${baseUrl}/admin.html`
    });
    return { url: session.url };
  }

  async function refreshSubscription(account) {
    assertHostedInstructor(account);
    const existing = await db.getSubscriptionByAccountId(account.id);
    if (!existing?.provider_subscription_id) return existing;

    const stripeSubscription = await stripe.subscriptions.retrieve(
      existing.provider_subscription_id
    );
    const normalized = normalizeStripeSubscription(stripeSubscription, priceId);
    if (!normalized || normalized.accountId !== account.id) {
      throw new BillingRequestError(
        'BILLING_SUBSCRIPTION_MISMATCH',
        'Stripe returned billing data that does not match this hosted account.',
        409
      );
    }

    const stored = await db.syncStripeSubscription(normalized);
    if (!stored) {
      throw new BillingRequestError(
        'BILLING_SUBSCRIPTION_MISMATCH',
        'Stripe billing data no longer matches this hosted account.',
        409
      );
    }
    return stored;
  }

  async function processEvent(event, payloadDigest) {
    if (!HANDLED_STRIPE_EVENTS.has(event.type)) {
      return { ignored: true, reason: 'event_type' };
    }

    const object = event.data.object;
    if (event.type === 'checkout.session.completed'
      && (object.mode !== 'subscription'
        || object.metadata?.app !== BILLING_APP
        || object.client_reference_id !== object.metadata?.account_id)) {
      return db.applyStripeBillingEvent({
        eventId: event.id,
        eventType: event.type,
        eventCreatedAt: event.created,
        payloadDigest,
        subscription: null
      });
    }

    const subscriptionId = eventSubscriptionId(event);
    if (!subscriptionId) {
      return db.applyStripeBillingEvent({
        eventId: event.id,
        eventType: event.type,
        eventCreatedAt: event.created,
        payloadDigest,
        subscription: null
      });
    }

    let subscription = eventSubscriptionObject(event);
    if (!subscription || event.type !== 'customer.subscription.deleted') {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    }

    const normalized = normalizeStripeSubscription(subscription, priceId);
    return db.applyStripeBillingEvent({
      eventId: event.id,
      eventType: event.type,
      eventCreatedAt: event.created,
      payloadDigest,
      subscription: normalized
    });
  }

  return {
    createCheckoutSession,
    createPortalSession,
    processEvent,
    refreshSubscription
  };
}

module.exports = {
  BillingConfigurationError,
  BillingRequestError,
  HANDLED_STRIPE_EVENTS,
  createStripeBillingService,
  eventSubscriptionId
};
