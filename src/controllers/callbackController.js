// controllers/callbackController.js
const Payment = require('../models/Payment');
const { updatePaymentStatus } = require('../services/paymentService');
const TransactionLog = require('../models/TransactionLog');
const axios = require('axios');

// RupeeFlow calls this endpoint
exports.rupeeFlowCallback = async (req, res) => {
  try {
    const { status, amount, client_id, order_id, utr } = req.body;

    console.log('RupeeFlow Callback:', req.body);

    // Find payment record
    const payment = await Payment.findOne({ order_id });

    if (!payment) {
      return res.json({ status: 'error', message: 'Order not found' });
    }

    // Prevent duplicate callback processing
    if (payment.status === 'SUCCESS') {
      return res.json({ status: 'success', message: 'Already processed' });
    }

    // Update status based on callback
    const newStatus = status === 'credit' ? 'SUCCESS' : 'FAILED';

    await updatePaymentStatus(payment, newStatus, { utr, provider_response: req.body });

    // Use centralized webhook service for merchant notification
    const { sendWebhook } = require('../services/webhookService');
    setImmediate(() => sendWebhook(payment, 1));

    res.json({ status: 'success', message: 'Callback processed' });

  } catch (error) {
    console.error('Callback error', error);
    res.json({ status: 'error', message: 'Failed to process callback' });
  }
};