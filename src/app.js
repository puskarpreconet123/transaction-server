const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const dotenv = require('dotenv');
const helmet = require('helmet');

dotenv.config();

// DB connection
const connectDB = require('./config/database');
connectDB();

const app = express();

// Security
app.use(helmet());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));

// Request Logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

/*
===========================
ROUTES
===========================
*/

// Admin routes (for provider, merchant, MID management)
const adminRoutes = require('./routes/adminRoutes');

// Merchant dashboard routes
const merchantRoutes = require('./routes/merchantRoutes');

// Payment routes (CORE FUNCTION)
const paymentRoutes = require('./routes/paymentRoutes');

//Rupeflow Callback routes(recive status from rupeeflow about payment)

const callBackRoutes = require("./routes/callbackRoutes")

// RupeeFlow webhook routes
// const webhookRoutes = require('./routes/webhookRoutes');

// Status enquiry
// const enquiryRoutes = require('./routes/enquiryRoutes');

// Enable these
app.use('/api/admin', adminRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/rupeeflow', callBackRoutes)
// app.use('/api/add-money', enquiryRoutes);
// app.use('/webhooks', webhookRoutes);

/*
Future Providers (Disabled for now)

app.use('/api/providers/razorpay', razorpayRoutes);
app.use('/api/providers/paypal', paypalRoutes);

*/

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Paynexa API',
    timestamp: new Date()
  });
});

/*
===========================
CRON JOBS
===========================
*/

const { expireStalePayments } = require('./services/paymentService');
// const { processRetryQueue } = require('./services/webhookService'); // Disabled for now

cron.schedule('* * * * *', async () => {
  try {
    await expireStalePayments();
    // await processRetryQueue();
  } catch (error) {
    console.error('Cron error:', error.message);
  }
});

/*
===========================
ERROR HANDLER
===========================
*/

app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;