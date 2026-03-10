/**
 * Dummy Razorpay Provider Adapter
 * Simulates Razorpay UPI payment flow for development/testing.
 * Replace with real Razorpay SDK calls in production.
 */

const crypto = require('crypto');

/**
 * Create a simulated UPI payment
 * @param {Object} options
 * @param {number} options.amount - Amount in INR
 * @param {string} options.order_id - Merchant's order ID
 * @param {string} options.customer_name
 * @param {string} options.customer_email
 * @param {string} options.customer_mobile
 * @param {string} options.upi_id - Merchant's UPI ID from MID config
 * @param {string} options.merchant_name - Merchant display name from MID
 * @param {string} options.api_key - Provider API key from MID
 * @returns {Object} Simulated provider response
 */
const createPayment = async (options) => {
  const {
    amount,
    order_id,
    customer_name,
    customer_email,
    customer_mobile,
    upi_id,
    merchant_name,
    api_key,
  } = options;

  // Simulate network delay
  await _simulateDelay(200, 600);

  // Simulate occasional provider errors (5% chance) for realism
  if (Math.random() < 0.05) {
    throw new Error('Provider temporarily unavailable. Please retry.');
  }

  const provider_payment_id = `rzp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // Build UPI deep link
  const upiParams = new URLSearchParams({
    pa: upi_id,
    pn: merchant_name,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: `Payment for order ${order_id}`,
    tr: provider_payment_id,
  });

  const upi_link = `upi://pay?${upiParams.toString()}`;

  // QR string is the same as UPI link (apps scan it to open UPI intent)
  const qr_string = upi_link;

  return {
    success: true,
    provider_payment_id,
    upi_link,
    qr_string,
    raw_response: {
      id: provider_payment_id,
      entity: 'payment_link',
      amount: amount * 100, // Razorpay sends paise
      currency: 'INR',
      status: 'created',
      upi_link,
      customer: {
        name: customer_name,
        email: customer_email,
        contact: customer_mobile,
      },
      created_at: Math.floor(Date.now() / 1000),
    },
  };
};

/**
 * Verify incoming webhook signature from Razorpay
 * Razorpay uses HMAC-SHA256 with webhook_secret
 * @param {string|Buffer} rawBody - Raw request body
 * @param {string} signature - X-Razorpay-Signature header
 * @param {string} webhookSecret - MID webhook secret
 * @returns {boolean}
 */
const verifyWebhook = (rawBody, signature, webhookSecret) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch (err) {
    return false;
  }
};

/**
 * Check payment status via provider API
 * @param {string} provider_payment_id
 * @param {string} api_key
 * @param {string} api_secret
 * @returns {Object}
 */
const checkPaymentStatus = async (provider_payment_id, api_key, api_secret) => {
  // Simulate network delay
  await _simulateDelay(100, 400);

  // Simulate status: 70% success, 20% pending, 10% failed
  const rand = Math.random();
  let status, utr;

  if (rand < 0.7) {
    status = 'captured';
    utr = `UTR${Date.now()}${Math.floor(Math.random() * 10000)}`;
  } else if (rand < 0.9) {
    status = 'created';
    utr = null;
  } else {
    status = 'failed';
    utr = null;
  }

  return {
    provider_payment_id,
    status,
    utr,
    raw_response: {
      id: provider_payment_id,
      status,
      utr,
      checked_at: Math.floor(Date.now() / 1000),
    },
  };
};

/**
 * Parse incoming webhook payload into normalized format
 * @param {Object} body - Parsed webhook body from Razorpay
 * @returns {Object} Normalized event
 */
const parseWebhookEvent = (body) => {
  const event = body.event || '';
  const paymentEntity = body?.payload?.payment?.entity || {};

  let status = 'PENDING';
  let utr = null;

  if (event === 'payment.captured') {
    status = 'SUCCESS';
    utr = paymentEntity.acquirer_data?.upi_transaction_id || null;
  } else if (event === 'payment.failed') {
    status = 'FAILED';
  }

  return {
    event,
    provider_payment_id: paymentEntity.id || null,
    status,
    utr,
    raw: body,
  };
};

// --- Helpers ---

const _simulateDelay = (minMs, maxMs) => {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
};

module.exports = {
  createPayment,
  verifyWebhook,
  checkPaymentStatus,
  parseWebhookEvent,
};
