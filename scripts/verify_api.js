
const axios = require('axios');

async function testApi() {
    const baseUrl = 'http://localhost:3000';

    try {
        console.log('1. Logging in as merchant...');
        const loginRes = await axios.post(`${baseUrl}/api/merchant/login`, {
            email: 'testmerchant@example.com',
            password: 'Password@123'
        });

        const token = loginRes.data.data.token;
        console.log('✅ Logged in successfully');

        console.log('\n2. Creating payment with redirect_url and webhook_url...');
        const paymentRes = await axios.post(`${baseUrl}/api/payments/create`, {
            amount: 12.50,
            order_id: 'TEST_API_V4_99',
            customer_name: 'API Tester',
            customer_email: 'tester@example.com',
            customer_mobile: '8888888888',
            webhook_url: 'https://webhook.site/tester_v4',
            redirect_url: 'https://example.com/success'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const paymentData = paymentRes.data.data;
        console.log('✅ Payment created:', paymentData.payment_id);
        console.log('   Checkout URL:', paymentData.checkout_url);

        console.log('\n3. Verifying payment status and saved fields...');
        const statusRes = await axios.get(`${baseUrl}/api/payments/${paymentData.payment_id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const savedPayment = statusRes.data.data;
        console.log('   Status:', savedPayment.status);
        console.log('   Redirect URL in DB:', savedPayment.redirect_url);

        if (savedPayment.redirect_url === 'https://example.com/success') {
            console.log('✅ SUCCESS: redirect_url verified in database');
        } else {
            console.error('❌ ERROR: redirect_url mismatch!');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed');
        console.error(err.response?.data || err.message);
        process.exit(1);
    }
}

testApi();
