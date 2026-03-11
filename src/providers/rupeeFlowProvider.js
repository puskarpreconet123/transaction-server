const axios = require('axios');

/**
 * RupeeFlow Provider Adapter
 */
const createPayment = async (options) => {
    const {
        amount,
        payment_id,
        customer_name,
        customer_email,
        customer_mobile,
        api_key, // Mapping MID.api_key to RupeeFlow api_token
        upi_id,  // Mapping MID.upi_id to RupeeFlow payeeVPA
    } = options;

    console.log("RupeeFlow Provider: Creating order...");

    const response = await axios.post(
        "https://banking.rupeeflow.co/api/add-money/v6/createOrder",
        {
            api_token: api_key,
            amount: amount,
            callback_url: process.env.SERVER_URL
                ? `${process.env.SERVER_URL.replace(/\/$/, '')}/api/rupeeflow/callback`
                : process.env.RUPEEFLOW_CALLBACK_URL,
            client_id: payment_id,
            customer_name: customer_name,
            customer_mobile: customer_mobile,
            customer_email: customer_email,
            payeeVPA: upi_id
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
        success: true,
        provider_payment_id: data.data?.order_id,
        qr_string: data.data?.qrString,
        upi_link: data.data?.qrString,
        raw_response: data
    };
};

/**
 * Check payment status via RupeeFlow Transaction Status Enquiry API
 * @param {string} provider_payment_id - Optional for RupeeFlow (uses client_id)
 * @param {string} api_key - RupeeFlow API Token
 * @param {string} api_secret - (Unused for RupeeFlow)
 * @param {Object} extras - Additional fields (payment record)
 * @returns {Object} Normalized status
 */
const checkPaymentStatus = async (provider_payment_id, api_key, api_secret, extras = {}) => {
    const { payment_id, createdAt } = extras;

    if (!payment_id || !createdAt) {
        throw new Error("Payment ID and Creation Date are required for status enquiry");
    }

    const txn_date = new Date(createdAt).toISOString().split('T')[0];

    console.log(`RupeeFlow Provider: Checking status for ${payment_id} on ${txn_date}...`);

    const response = await axios.post(
        "https://banking.rupeeflow.co/api/add-money/v6/trxn-status-enquiry",
        {
            api_token: api_key,
            client_id: payment_id,
            txn_date: txn_date
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
        // If "No transaction record found", it's still pending
        if (data.message === "No transaction record found") {
            return { status: 'PENDING', utr: null, raw_response: data };
        }
        throw new Error(data.message || "RupeeFlow Status Enquiry error");
    }

    const result = data.data?.results?.[0];
    if (!result) {
        return { status: 'PENDING', utr: null, raw_response: data };
    }

    // RupeeFlow status mapping (SUCCESS, etc.)
    let status = 'PENDING';
    if (result.status === 'SUCCESS') {
        status = 'SUCCESS';
    } else if (result.status === 'FAILED') {
        status = 'FAILED';
    }

    return {
        provider_payment_id,
        status,
        utr: result.utr || null, // Note: documentation doesn't show UTR in success response, but it's usually there
        raw_response: data
    };
};

module.exports = {
    createPayment,
    checkPaymentStatus,
};
