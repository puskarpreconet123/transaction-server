const Payment = require('../models/Payment');
const TransactionLog = require('../models/TransactionLog');
const { generatePaymentId } = require('../utils/generatePaymentId');
const { selectMid } = require('./midService');
const axios = require('axios');

// const { getProvider } = require('../providers'); // FUTURE MULTI PROVIDER

const EXPIRY_MINUTES = parseInt(process.env.PAYMENT_EXPIRY_MINUTES || '5');


/*
────────────────────────────────
CALL RUPEEFLOW API
────────────────────────────────
*/

const callRupeeFlow = async ({
  amount,
  payment_id,
  customer_name,
  customer_email,
  customer_mobile
}) => {

  const response = await axios.post(
    "https://banking.rupeeflow.co/api/add-money/v6/createOrder",
    {
      api_token: process.env.RUPEEFLOW_API_TOKEN,

      amount: amount,

      callback_url: process.env.RUPEEFLOW_CALLBACK_URL,

      client_id: payment_id,

      customer_name: customer_name,

      customer_mobile: customer_mobile,

      customer_email: customer_email,

      payeeVPA: process.env.RUPEEFLOW_VPA
    },
    {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 8000
    }
  );

  const data = response.data;

  if (data.status !== "success") {
    throw new Error(data.message || "RupeeFlow API error");
  }

  return {

    provider_payment_id: data.data?.order_id,

    qr_string: data.data?.qrString,

    upi_link: data.data?.qrString,

    raw_response: data

  };
};

/*
────────────────────────────────
CREATE PAYMENT ORDER
────────────────────────────────
*/

const createPaymentOrder = async ({ merchant, orderData }) => {

  const { amount, order_id, customer_name, customer_email, customer_mobile } = orderData;

  /*
  ────────────────────────────────
  IDEMPOTENCY CHECK
  ────────────────────────────────
  */

  const existing = await Payment.findOne({
    merchant_id: merchant._id,
    order_id,
    status: { $in: ['CREATED','PENDING','SUCCESS'] }
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
  CALL RUPEEFLOW
  ────────────────────────────────
  */

  const providerResponse = await callRupeeFlow({
    amount,
    payment_id,
    customer_name,
    customer_email,
    customer_mobile,
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

    status: { $in: ['CREATED','PENDING'] },

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

module.exports = {

  createPaymentOrder,

  updatePaymentStatus,

  expireStalePayments

};