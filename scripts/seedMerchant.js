require('dotenv').config();
const mongoose = require('mongoose');
const Merchant = require('../src/models/Merchant');
const MID = require('../src/models/MID');

const seedMerchant = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const email = 'testmerchant@example.com';
    const password = 'Password@123';

    let merchant = await Merchant.findOne({ email });
    if (!merchant) {
        merchant = await Merchant.create({
            name: 'Test Merchant',
            email,
            password,
            status: 'active'
        });
        console.log('✅ Merchant created:', email);
    } else {
        console.log('Merchant already exists:', email);
    }

    // Create an MID for this merchant
    const midCode = 'MID_RF_TEST_001';
    let mid = await MID.findOne({ mid_code: midCode });
    if (!mid) {
        mid = await MID.create({
            merchant_id: merchant._id,
            mid_code: midCode,
            provider: 'rupeeflow',
            api_key: process.env.RUPEEFLOW_API_TOKEN,
            upi_id: process.env.RUPEEFLOW_VPA,
            merchant_name: 'Test Store',
            status: 'active'
        });
        console.log('✅ MID created:', midCode);

        // Associate MID with merchant
        await Merchant.findByIdAndUpdate(merchant._id, { $addToSet: { mids: mid._id } });
    } else {
        console.log('MID already exists:', midCode);
    }

    process.exit(0);
};

seedMerchant().catch((err) => {
    console.error('Seed error:', err.message);
    process.exit(1);
});
