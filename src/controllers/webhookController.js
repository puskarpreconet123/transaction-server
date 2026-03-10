// controllers/callbackController.js
const Payment = require('../models/Payment');
const { updatePaymentStatus } = require('../services/paymentService');
const TransactionLog = require('../models/TransactionLog');
const axios = require('axios');
const crypto = require('crypto');

// Optional: Verify signature (if provider sends HMAC signature)
function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return true; // skip if not configured
  const computed = crypto.createHmac('sha256', secret)
                         .update(JSON.stringify(rawBody))
                         .digest('hex');
  return computed === signature;
}

// RupeeFlow calls this endpoint
exports.rupeeFlowCallback = async (req, res) => {
  try {
    const rawBody = req.body; // callback payload
    const signature = req.headers['x-rupeeflow-signature'];

    // Optional signature verification
    if (!verifySignature(rawBody, signature, process.env.RUPEEFLOW_SECRET)) {
      return res.status(400).json({ status: 'error', message: 'Invalid signature' });
    }

    const { status, amount, client_id, order_id, utr } = rawBody;
    console.log('RupeeFlow Callback:', rawBody);

    // Find payment record
    const payment = await Payment.findOne({ order_id });
    if (!payment) {
      console.warn('Payment not found for order:', order_id);
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    // Prevent duplicate processing
    const FINAL_STATUSES = ['SUCCESS', 'FAILED', 'EXPIRED'];
    if (FINAL_STATUSES.includes(payment.status)) {
      return res.json({ status: 'success', message: 'Already processed' });
    }

    // Optional: Verify amount
    if (Number(amount) !== payment.amount) {
      console.warn('Amount mismatch for order:', order_id, 'Expected:', payment.amount, 'Received:', amount);
      // You can choose to reject, flag, or continue processing
    }

    // Map provider status to internal status
    const newStatus = status === 'credit' ? 'SUCCESS' : 'FAILED';

    // Log raw callback payload
    await TransactionLog.create({
      payment_id: payment.payment_id,
      merchant_id: payment.merchant_id,
      event_type: 'CALLBACK_RECEIVED',
      status_from: payment.status,
      status_to: 'RECEIVED',
      raw_data: rawBody
    });

    // Update payment status
    await updatePaymentStatus(payment, newStatus, { utr, provider_response: rawBody });

    // Trigger merchant webhook asynchronously (fire-and-forget)
    if (payment.callbackUrl) {
      axios.post(payment.callbackUrl, {
        order_id: payment.order_id,
        payment_id: payment.payment_id,
        amount: payment.amount,
        status: newStatus,
        utr
      }).catch(err => console.error('Merchant webhook failed', err.message));
    }

    res.json({ status: 'success', message: 'Callback processed' });

  } catch (error) {
    console.error('Callback error', error);
    res.status(500).json({ status: 'error', message: 'Failed to process callback' });
  }
};