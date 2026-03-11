const axios = require('axios');
const Merchant = require('../models/Merchant');
const Payment = require('../models/Payment');
const WebhookLog = require('../models/WebhookLog');
const TransactionLog = require('../models/TransactionLog');

// Retry schedule in minutes
const RETRY_SCHEDULE = [1, 5, 15];

/**
 * Build the merchant webhook payload
 */
const buildPayload = (payment) => ({
  payment_id: payment.payment_id,
  order_id: payment.order_id,
  status: payment.status,
  amount: payment.amount,
  currency: payment.currency || 'INR',
  utr: payment.utr || null,
  customer_name: payment.customer_name,
  timestamp: new Date().toISOString(),
});

/**
 * Send webhook to merchant and log the result
 */
const sendWebhook = async (payment, attemptNumber = 1) => {
  const merchant = await Merchant.findById(payment.merchant_id);
  const webhookUrl = payment.webhook_url || merchant?.webhook_url;

  if (!webhookUrl) {
    console.warn(`⚠️  No webhook URL for payment ${payment.payment_id}`);
    return;
  }

  const payload = buildPayload(payment);
  const webhookLog = await WebhookLog.create({
    payment_id: payment.payment_id,
    merchant_id: payment.merchant_id,
    webhook_url: webhookUrl,
    payload,
    attempt_number: attemptNumber,
    status: 'pending',
  });

  try {
    const response = await axios.post(webhookUrl, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-RupeeFlow-Event': `payment.${payment.status.toLowerCase()}`,
        'X-RupeeFlow-PaymentId': payment.payment_id,
      },
    });

    webhookLog.status = 'success';
    webhookLog.response_status = response.status;
    webhookLog.response_body = JSON.stringify(response.data).substring(0, 500);
    await webhookLog.save();

    // Mark payment webhook as delivered
    payment.webhook_delivered = true;
    payment.webhook_attempts = attemptNumber;
    await payment.save();

    await TransactionLog.create({
      payment_id: payment.payment_id,
      merchant_id: merchant._id,
      event_type: 'WEBHOOK_SENT',
      raw_data: { attempt: attemptNumber, status: response.status },
    });

    console.log(`✅ Webhook delivered for ${payment.payment_id} (attempt ${attemptNumber})`);
  } catch (error) {
    const isExhausted = attemptNumber > RETRY_SCHEDULE.length;

    webhookLog.status = isExhausted ? 'exhausted' : 'failed';
    webhookLog.error_message = error.message;
    webhookLog.response_status = error.response?.status;

    if (!isExhausted) {
      const delayMinutes = RETRY_SCHEDULE[attemptNumber - 1] || 15;
      const nextRetry = new Date(Date.now() + delayMinutes * 60 * 1000);
      webhookLog.next_retry_at = nextRetry;
      payment.next_webhook_retry = nextRetry;
      payment.webhook_attempts = attemptNumber;
      await payment.save();
    }

    await webhookLog.save();

    await TransactionLog.create({
      payment_id: payment.payment_id,
      merchant_id: merchant._id,
      event_type: isExhausted ? 'WEBHOOK_FAILED' : 'WEBHOOK_RETRY',
      raw_data: { attempt: attemptNumber, error: error.message },
    });

    console.error(
      `❌ Webhook failed for ${payment.payment_id} (attempt ${attemptNumber}): ${error.message}`
    );
  }
};

/**
 * Process retry queue - called by cron job
 * Finds payments with pending webhook retries
 */
const processRetryQueue = async () => {
  const now = new Date();

  const pendingPayments = await Payment.find({
    webhook_delivered: false,
    status: { $in: ['SUCCESS', 'FAILED'] },
    webhook_attempts: { $lte: RETRY_SCHEDULE.length },
    next_webhook_retry: { $lte: now },
  });

  for (const payment of pendingPayments) {
    const nextAttempt = payment.webhook_attempts + 1;
    await sendWebhook(payment, nextAttempt);
  }

  if (pendingPayments.length > 0) {
    console.log(`🔄 Processed ${pendingPayments.length} webhook retry(s)`);
  }
};

module.exports = { sendWebhook, processRetryQueue, buildPayload };
