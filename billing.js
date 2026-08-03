const BILLING_APP = 'markdown_mash';
const BILLING_PROVIDER = 'stripe';
const ROOM_ENTITLED_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);

function stripeObjectId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return typeof value.id === 'string' ? value.id : null;
}

function stripeTimestamp(value) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000);
}

function subscriptionAccountStatus(status) {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due') return 'past_due';
  // Billing access is enforced from the subscription row. Keep the account
  // sign-in available so an instructor can view history and resubscribe.
  return 'active';
}

function hasHostedRoomEntitlement(subscription) {
  return Boolean(
    subscription
    && ROOM_ENTITLED_SUBSCRIPTION_STATUSES.has(subscription.status)
  );
}

function hasComplimentaryRoomEntitlement(admin, now = Date.now()) {
  if (admin?.accessOverride !== 'complimentary') return false;
  if (!admin.complimentaryAccessUntil) return true;
  const expiresAt = new Date(admin.complimentaryAccessUntil).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

function getHostedBillingFailure({ billingEnabled, hostedMode, admin, subscription }) {
  if (!billingEnabled
    || !hostedMode
    || admin?.role === 'master'
    || admin?.authSource !== 'hosted') {
    return null;
  }

  if (hasHostedRoomEntitlement(subscription) || hasComplimentaryRoomEntitlement(admin)) return null;

  return {
    code: 'SUBSCRIPTION_REQUIRED',
    message: 'An active Markdown Mash Hosted subscription is required to open a room.'
  };
}

function normalizeStripeSubscription(subscription, expectedPriceId) {
  const items = subscription?.items?.data || [];
  const item = items[0];
  const accountId = Number.parseInt(subscription?.metadata?.account_id, 10);
  const app = subscription?.metadata?.app;
  const priceId = stripeObjectId(item?.price);
  const customerId = stripeObjectId(subscription?.customer);
  const cancelAt = stripeTimestamp(subscription?.cancel_at);

  if (app !== BILLING_APP
    || !Number.isInteger(accountId)
    || accountId <= 0
    || !customerId
    || !subscription?.id
    || items.length !== 1
    || item?.quantity !== 1
    || priceId !== expectedPriceId) {
    return null;
  }

  return {
    accountId,
    accountStatus: subscriptionAccountStatus(subscription.status),
    // Stripe may represent a future cancellation either with the legacy
    // period-end flag or with a concrete cancel_at timestamp.
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end || cancelAt),
    currentPeriodEnd: stripeTimestamp(
      subscription.current_period_end || item.current_period_end
    ),
    priceId,
    provider: BILLING_PROVIDER,
    providerCustomerId: customerId,
    providerSubscriptionId: subscription.id,
    status: subscription.status
  };
}

function invoiceSubscriptionId(invoice) {
  return stripeObjectId(invoice?.subscription)
    || stripeObjectId(invoice?.parent?.subscription_details?.subscription);
}

module.exports = {
  BILLING_APP,
  BILLING_PROVIDER,
  ROOM_ENTITLED_SUBSCRIPTION_STATUSES,
  getHostedBillingFailure,
  hasComplimentaryRoomEntitlement,
  hasHostedRoomEntitlement,
  invoiceSubscriptionId,
  normalizeStripeSubscription,
  stripeObjectId,
  stripeTimestamp,
  subscriptionAccountStatus
};
