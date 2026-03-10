const Payment = require('../models/Payment');

/**
 * POST /api/add-money/v6/trxn-status-enquiry
 * Specific status enquiry endpoint as per banking document
 */
exports.trxnStatusEnquiry = async (req, res) => {
    try {
        const { client_id, txn_date } = req.body;

        // 1. Basic validation
        if (!client_id) {
            return res.status(422).json({ status: 'failure', message: 'client_id is required' });
        }

        if (!txn_date) {
            return res.status(422).json({ status: 'failure', message: 'txn_date is required' });
        }

        // 2. Date format validation (YYYY-MM-DD or Y-m-d)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(txn_date)) {
            return res.status(200).json({
                status: 'failure',
                message: 'The txn date field must match the format Y-m-d.'
            });
        }

        // 3. Find payment
        // We match order_id with client_id
        const startOfDay = new Date(txn_date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(txn_date);
        endOfDay.setHours(23, 59, 59, 999);

        const payment = await Payment.findOne({
            merchant_id: req.merchant._id,
            order_id: client_id,
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        // 4. Handle results
        if (!payment) {
            return res.status(200).json({
                status: 'success',
                message: 'No transaction record found'
            });
        }

        // 5. Success Response
        return res.status(200).json({
            status: 'success',
            message: 'Success',
            data: {
                results: [
                    {
                        status: payment.status,
                        txnAmount: payment.amount
                    }
                ]
            }
        });

    } catch (error) {
        console.error('Status Enquiry Error:', error.message);
        return res.status(500).json({ status: 'failure', message: 'Internal server error' });
    }
};
