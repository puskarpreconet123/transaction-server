const Payment = require('../models/Payment');
const TransactionLog = require('../models/TransactionLog');
const { generatePaymentId } = require('../utils/generatePaymentId');
const { selectMid } = require('./midService');
const axios = require('axios');

const { getProvider } = require('../providers');

const EXPIRY_MINUTES = parseInt(process.env.PAYMENT_EXPIRY_MINUTES || '5');



/*
────────────────────────────────
CREATE PAYMENT ORDER
────────────────────────────────
*/

const createPaymentOrder = async ({ merchant, orderData }) => {
  console.log("inside paymentorder")

  const { amount, order_id, customer_name, customer_email, customer_mobile, webhook_url } = orderData;

  /*
  ────────────────────────────────
  IDEMPOTENCY CHECK
  ────────────────────────────────
  */

  const existing = await Payment.findOne({
    merchant_id: merchant._id,
    order_id,
    status: { $in: ['CREATED', 'PENDING', 'SUCCESS'] }
  }).lean();

  if (existing) {
    return {
      payment_id: existing.payment_id,
      order_id: existing.order_id,
      qr_string: existing.qr_string,
      upi_link: existing.upi_link,
      expiry_time: existing.expiry_time,
      status: existing.status,
      idempotent: true
    };
  }


  /*
  ────────────────────────────────
  SELECT MID
  ────────────────────────────────
  */

  const mid = await selectMid(merchant.mids);

  /*
  ────────────────────────────────
  CREATE PAYMENT RECORD
  ────────────────────────────────
  */

  const payment_id = generatePaymentId();

  /*
  ────────────────────────────────
  CALL PROVIDER
  ────────────────────────────────
  */

  const provider = getProvider(mid.provider);

  const providerResponse = await provider.createPayment({
    amount,
    payment_id,
    customer_name,
    customer_email,
    customer_mobile,
    api_key: mid.api_key,
    api_secret: mid.api_secret,
    webhook_secret: mid.webhook_secret,
    upi_id: mid.upi_id,
    merchant_name: mid.merchant_name,
  });

  const expiry_time = new Date(
    Date.now() + EXPIRY_MINUTES * 60 * 1000
  );

  const payment = await Payment.create({

    payment_id,

    merchant_id: merchant._id,

    mid_id: mid._id,

    order_id,

    amount,

    customer_name,

    customer_email,

    customer_mobile,

    status: 'CREATED',

    upi_link: providerResponse.upi_link,

    qr_string: providerResponse.qr_string,

    provider_payment_id: providerResponse.provider_payment_id,

    provider_response: providerResponse.raw_response,

    webhook_url,

    redirect_url: orderData.redirect_url,

    expiry_time

  });


  /*
  ────────────────────────────────
  LOG TRANSACTION
  ────────────────────────────────
  */

  await TransactionLog.create({

    payment_id,

    merchant_id: merchant._id,

    event_type: 'PAYMENT_CREATED',

    status_from: null,

    status_to: 'CREATED',

    raw_data: {
      mid_id: mid._id,
      mid_code: mid.mid_code,
      provider: mid.provider
    }

  });


  /*
  ────────────────────────────────
  RETURN RESPONSE
  ────────────────────────────────
  */

  return {

    payment_id: payment.payment_id,

    order_id: payment.order_id,

    qr_string: payment.qr_string,

    upi_link: payment.upi_link,

    expiry_time: payment.expiry_time,

    status: payment.status,

    checkout_url:
      `${process.env.FRONTEND_URL || 'http://localhost:5174'}/checkout/${payment.payment_id}`,

    idempotent: false

  };

};



/*
────────────────────────────────
UPDATE PAYMENT STATUS
────────────────────────────────
*/

const updatePaymentStatus = async (payment, newStatus, extras = {}) => {

  const oldStatus = payment.status;

  payment.status = newStatus;

  if (extras.utr) payment.utr = extras.utr;

  if (extras.provider_response)
    payment.provider_response = extras.provider_response;

  await payment.save();

  await TransactionLog.create({

    payment_id: payment.payment_id,

    merchant_id: payment.merchant_id,

    event_type: `PAYMENT_${newStatus}`,

    status_from: oldStatus,

    status_to: newStatus,

    raw_data: extras

  });

  return payment;

};



/*
────────────────────────────────
EXPIRE STALE PAYMENTS
────────────────────────────────
*/

const expireStalePayments = async () => {

  const now = new Date();

  const stale = await Payment.find({

    status: { $in: ['CREATED', 'PENDING'] },

    expiry_time: { $lt: now }

  });

  for (const payment of stale) {

    await updatePaymentStatus(
      payment,
      'EXPIRED',
      { reason: 'Payment expired due to timeout' }
    );

  }

};

/**
 * Get payment status with proactive provider sync
 * Useful for frontend polling to ensure real-time updates
 */
const getPaymentStatusWithSync = async (payment_id, merchant_id) => {
  const payment = await Payment.findOne({ payment_id, merchant_id })
    .populate('mid_id', '+api_key +api_secret +webhook_secret');

  if (!payment) return null;

  // Proactively check status if not terminal
  if (['CREATED', 'PENDING'].includes(payment.status)) {
    try {
      const mid = payment.mid_id;
      const provider = getProvider(mid.provider);

      if (provider.checkPaymentStatus) {
        const result = await provider.checkPaymentStatus(
          payment.provider_payment_id,
          mid.api_key,
          mid.api_secret,
          { payment_id: payment.payment_id, createdAt: payment.createdAt }
        );

        if (result.status !== payment.status && result.status !== 'PENDING') {
          await updatePaymentStatus(payment, result.status, {
            utr: result.utr,
            provider_response: result.raw_response
          });

          // Trigger webhook if status changed to SUCCESS or FAILED
          if (['SUCCESS', 'FAILED'].includes(result.status)) {
            const { sendWebhook } = require('./webhookService');
            setImmediate(() => sendWebhook(payment, 1));
          }
        }
      }
    } catch (err) {
      console.error('Proactive status sync failed:', err.message);
    }
  }

  return payment;
};

module.exports = {

  createPaymentOrder,

  updatePaymentStatus,

  expireStalePayments,
  getPaymentStatusWithSync

};