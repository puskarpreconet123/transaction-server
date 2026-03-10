require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const email = process.env.ADMIN_EMAIL || 'admin@rupeeflow.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';

  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log('Admin already exists:', email);
    process.exit(0);
  }

  await Admin.create({ name: 'Super Admin', email, password, role: 'superadmin' });
  console.log('✅ Admin created:', email);
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed error:', err.message);
  process.exit(1);
});
