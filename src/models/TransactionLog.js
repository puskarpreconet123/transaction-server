const mongoose = require('mongoose');

const transactionLogSchema = new mongoose.Schema(
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
    event_type: {
      type: String,
      required: true,
      enum: [
        'PAYMENT_CREATED',
        'PAYMENT_PENDING',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILED',
        'PAYMENT_EXPIRED',
        'PAYMENT_CANCELLED',
        'WEBHOOK_RECEIVED',
        'WEBHOOK_SENT',
        'WEBHOOK_RETRY',
        'WEBHOOK_FAILED',
        'STATUS_CHECK',
      ],
    },
    provider_event: {
      type: String,
    },
    status_from: {
      type: String,
    },
    status_to: {
      type: String,
    },
    raw_data: {
      type: mongoose.Schema.Types.Mixed,
    },
    ip_address: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TransactionLog', transactionLogSchema);
