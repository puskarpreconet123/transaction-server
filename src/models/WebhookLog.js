const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema(
  {
    payment_id: {
      type: String,
      required: true,
      index: true,
    },
    merchant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
    },
    webhook_url: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
    },
    attempt_number: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'exhausted'],
      default: 'pending',
    },
    response_status: {
      type: Number,
    },
    response_body: {
      type: String,
    },
    error_message: {
      type: String,
    },
    next_retry_at: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WebhookLog', webhookLogSchema);
