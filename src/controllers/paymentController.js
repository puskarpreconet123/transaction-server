const Payment = require('../models/Payment');
const { createPaymentOrder } = require('../services/paymentService');
const { successResponse, errorResponse } = require('../utils/response');
const { validationResult } = require('express-validator');

/**
 * POST /api/payments/create
 * Create a new payment order
 */
exports.createPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return errorResponse(res, 'Validation failed', 422, errors.array());

    const { amount, order_id, customer_name, customer_email, customer_mobile, webhook_url, redirect_url, mid_id } = req.body;

    const result = await createPaymentOrder({
      merchant: req.merchant,
      orderData: { amount, order_id, customer_name, customer_email, customer_mobile, webhook_url, redirect_url, mid_id },
    });

    const message = result.idempotent
      ? 'Existing payment returned (idempotent request)'
      : 'Payment created successfully';

    return successResponse(res, result, message, result.idempotent ? 200 : 201);
  } catch (err) {
    console.error('Payment creation error:', err);
    return errorResponse(res, err.message, 500);
  }
};

/**
 * GET /api/payments/:payment_id
 * Get payment status with proactive sync
 */
exports.getPaymentStatus = async (req, res) => {
  try {
    const { getPaymentStatusWithSync } = require('../services/paymentService');
    const payment = await getPaymentStatusWithSync(req.params.payment_id, req.merchant._id);

    if (!payment) return errorResponse(res, 'Payment not found', 404);

    return successResponse(res, payment);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

/**
 * GET /api/payments
 * List payments for the authenticated merchant
 */
exports.listPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { merchant_id: req.merchant._id };
    if (status) filter.status = status;

    const payments = await Payment.find(filter)
      .select('payment_id order_id amount status utr expiry_time createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(filter);

    return successResponse(res, { payments, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

/**
 * POST /api/payments/:payment_id/confirm
 * Manually confirm a payment via REST API
 */
exports.confirmPayment = async (req, res) => {
  try {
    const { utr } = req.body;
    if (!utr) return errorResponse(res, 'UTR is required for confirmation', 400);

    const payment = await Payment.findOne({
      payment_id: req.params.payment_id,
      merchant_id: req.merchant._id,
    });

    if (!payment) return errorResponse(res, 'Payment not found', 404);
    if (['SUCCESS', 'CANCELLED', 'EXPIRED'].includes(payment.status)) {
      return errorResponse(res, `Cannot confirm payment with status ${payment.status}`, 400);
    }

    const { updatePaymentStatus } = require('../services/paymentService');
    const { sendWebhook } = require('../services/webhookService');

    const updatedPayment = await updatePaymentStatus(payment, 'SUCCESS', {
      utr,
      provider_response: { method: 'REST_API', confirmed_at: new Date() },
    });

    // Trigger merchant webhook
    setImmediate(() => sendWebhook(updatedPayment, 1));

    return successResponse(res, updatedPayment, 'Payment confirmed successfully');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

/**
 * POST /api/payments/:payment_id/cancel
 * Cancel a payment
 */
exports.cancelPayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      payment_id: req.params.payment_id,
      merchant_id: req.merchant._id,
    });

    if (!payment) return errorResponse(res, 'Payment not found', 404);
    if (['SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(payment.status)) {
      return errorResponse(res, `Cannot cancel payment with status ${payment.status}`, 400);
    }

    const { updatePaymentStatus } = require('../services/paymentService');
    await updatePaymentStatus(payment, 'CANCELLED', {
      reason: 'Cancelled by user/merchant via API',
    });

    return successResponse(res, null, 'Payment cancelled successfully');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};
