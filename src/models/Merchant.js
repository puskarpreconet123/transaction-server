const mongoose = require('mongoose');
const crypto = require('crypto');

const merchantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Merchant name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    api_token: {
      type: String,
      unique: true,
      sparse: true,
    },
    webhook_url: {
      type: String,
      trim: true,
    },
    mids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MID',
      },
    ],
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

const bcrypt = require('bcryptjs');

merchantSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

merchantSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

merchantSchema.methods.generateApiToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.api_token = token;
  return token;
};

module.exports = mongoose.model('Merchant', merchantSchema);
