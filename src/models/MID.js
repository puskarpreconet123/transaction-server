const mongoose = require('mongoose');

const midSchema = new mongoose.Schema(
  {
    mid_code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    provider: {
      type: String,
      required: [true, 'Provider name is required'],
      enum: ['razorpay', 'paytm', 'phonepe', 'dummy'],
      default: 'dummy',
    },
    api_key: {
      type: String,
      required: [true, 'Provider API key is required'],
      select: false,
    },
    api_secret: {
      type: String,
      required: [true, 'Provider API secret is required'],
      select: false,
    },
    webhook_secret: {
      type: String,
      required: [true, 'Webhook secret is required'],
      select: false,
    },
    upi_id: {
      type: String,
      trim: true,
      default: 'merchant@upi',
    },
    merchant_name: {
      type: String,
      trim: true,
      default: 'Paynexa Merchant',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MID', midSchema);
