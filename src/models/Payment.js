const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    payment_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    merchant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    mid_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MID',
      required: true,
    },
    order_id: {
      type: String,
      required: [true, 'Order ID is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be at least 1'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    customer_name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customer_email: {
      type: String,
      required: [true, 'Customer email is required'],
      lowercase: true,
      trim: true,
    },
    customer_mobile: {
      type: String,
      required: [true, 'Customer mobile is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'],
      default: 'CREATED',
      index: true,
    },
    upi_link: {
      type: String,
    },
    qr_string: {
      type: String,
    },
    utr: {
      type: String,
      trim: true,
    },
    provider_payment_id: {
      type: String,
    },
    provider_response: {
      type: mongoose.Schema.Types.Mixed,
    },
    expiry_time: {
      type: Date,
      required: true,
      index: true,
    },
    webhook_delivered: {
      type: Boolean,
      default: false,
    },
    webhook_attempts: {
      type: Number,
      default: 0,
    },
    next_webhook_retry: {
      type: Date,
    },
    idempotency_key: {
      type: String,
      sparse: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for idempotency
paymentSchema.index({ merchant_id: 1, order_id: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
