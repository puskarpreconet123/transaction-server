# 💳 RupeeFlow — Payment Orchestration Platform

A production-ready payment gateway middleware built with Node.js, Express, and MongoDB. Supports multi-merchant, multi-MID architecture with a pluggable payment provider adapter pattern.

---

## 📁 Project Structure

```
rupeeflow/
├── scripts/
│   └── seedAdmin.js            # Seed initial admin account
├── src/
│   ├── app.js                  # Express app + cron jobs
│   ├── config/
│   │   └── database.js         # MongoDB connection
│   ├── models/
│   │   ├── Admin.js
│   │   ├── Merchant.js
│   │   ├── MID.js
│   │   ├── Payment.js
│   │   ├── TransactionLog.js
│   │   └── WebhookLog.js
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── merchantController.js
│   │   ├── paymentController.js
│   │   └── webhookController.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── merchantRoutes.js
│   │   ├── paymentRoutes.js
│   │   └── webhookRoutes.js
│   ├── providers/
│   │   ├── index.js            # Provider factory
│   │   └── razorpayProvider.js # Dummy Razorpay adapter
│   ├── services/
│   │   ├── paymentService.js   # Payment lifecycle
│   │   ├── midService.js       # MID selection logic
│   │   └── webhookService.js   # Webhook delivery + retry
│   ├── middlewares/
│   │   ├── adminAuthMiddleware.js  # JWT auth for admin
│   │   └── authMiddleware.js       # API token auth for merchants
│   └── utils/
│       ├── generateToken.js    # JWT helpers
│       ├── generatePaymentId.js
│       └── response.js         # Standardized API responses
├── .env.example
├── .gitignore
└── package.json
```

---

## ⚙️ Setup

### 1. Clone & Install

```bash
git clone <repo>
cd rupeeflow
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/rupeeflow
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@rupeeflow.com
ADMIN_PASSWORD=Admin@123
PAYMENT_EXPIRY_MINUTES=5
NODE_ENV=development
```

### 3. Seed Admin

```bash
npm run seed:admin
```

### 4. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs at: `http://localhost:3000`

---

## 🔐 Authentication

| Role     | Method     | Header                              |
|----------|------------|-------------------------------------|
| Admin    | JWT        | `Authorization: Bearer <jwt_token>` |
| Merchant | API Token  | `Authorization: Bearer <api_token>` |

---

## 📡 API Reference

### Health Check

```
GET /health
```

---

### Admin APIs

#### Login
```
POST /api/admin/login
```
```json
{
  "email": "admin@rupeeflow.com",
  "password": "Admin@123"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "admin": { "id": "...", "name": "Super Admin", "email": "..." }
  }
}
```

---

#### Create Merchant
```
POST /api/admin/merchants
Authorization: Bearer <admin_jwt>
```
```json
{
  "name": "Acme Corp",
  "email": "merchant@acme.com",
  "password": "Merchant@123",
  "webhook_url": "https://acme.com/payment/callback"
}
```

---

#### List Merchants
```
GET /api/admin/merchants?page=1&limit=20&status=active
Authorization: Bearer <admin_jwt>
```

---

#### Enable / Disable Merchant
```
PATCH /api/admin/merchants/:id/status
Authorization: Bearer <admin_jwt>
```
```json
{ "status": "inactive" }
```
Status values: `active`, `inactive`, `suspended`

---

#### Create MID
```
POST /api/admin/mids
Authorization: Bearer <admin_jwt>
```
```json
{
  "mid_code": "MID_001",
  "provider": "razorpay",
  "api_key": "rzp_test_abc123",
  "api_secret": "secret_xyz",
  "webhook_secret": "whsec_abc",
  "upi_id": "acme@razorpay",
  "merchant_name": "Acme Payments"
}
```

---

#### Assign MIDs to Merchant
```
POST /api/admin/merchants/:merchant_id/mids
Authorization: Bearer <admin_jwt>
```
```json
{
  "mid_ids": ["<MID ObjectId 1>", "<MID ObjectId 2>"]
}
```

---

#### View All Transactions
```
GET /api/admin/transactions?page=1&limit=50&status=SUCCESS&from=2024-01-01&to=2024-12-31
Authorization: Bearer <admin_jwt>
```

---

#### View Webhook Logs
```
GET /api/admin/webhook-logs?payment_id=PAY_xxx&status=failed
Authorization: Bearer <admin_jwt>
```

---

### Merchant APIs

#### Login
```
POST /api/merchant/login
```
```json
{
  "email": "merchant@acme.com",
  "password": "Merchant@123"
}
```

---

#### Get Profile
```
GET /api/merchant/profile
Authorization: Bearer <api_token>
```

---

#### Set Webhook URL
```
PATCH /api/merchant/webhook-url
Authorization: Bearer <api_token>
```
```json
{ "webhook_url": "https://mysite.com/payment/callback" }
```

---

#### Generate / Regenerate API Token
```
POST /api/merchant/token/generate
POST /api/merchant/token/regenerate
Authorization: Bearer <current_api_token>
```

---

#### View Assigned MIDs
```
GET /api/merchant/mids
Authorization: Bearer <api_token>
```

---

#### View Transactions
```
GET /api/merchant/transactions?status=SUCCESS&order_id=ORD_001
Authorization: Bearer <api_token>
```

---

### Payment APIs

#### Create Payment ⭐
```
POST /api/payments/create
Authorization: Bearer <api_token>
```
```json
{
  "amount": 500,
  "order_id": "ORD_20240601_001",
  "customer_name": "Rahul Sharma",
  "customer_email": "rahul@example.com",
  "customer_mobile": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment created successfully",
  "data": {
    "payment_id": "PAY_M5X3K1_A2B3",
    "order_id": "ORD_20240601_001",
    "qr_string": "upi://pay?pa=acme@razorpay&pn=Acme+Payments&am=500.00&cu=INR&tn=...",
    "upi_link": "upi://pay?pa=acme@razorpay&pn=Acme+Payments&am=500.00&cu=INR&tn=...",
    "expiry_time": "2024-06-01T10:05:00.000Z",
    "status": "CREATED"
  }
}
```

> **Idempotency:** Calling with the same `order_id` returns the existing payment instead of creating a duplicate.

---

#### Get Payment Status
```
GET /api/payments/:payment_id
Authorization: Bearer <api_token>
```

---

#### List Payments
```
GET /api/payments?status=PENDING&page=1&limit=20
Authorization: Bearer <api_token>
```

---

### Webhook Endpoints

#### Provider Webhook (Razorpay simulation)
```
POST /webhooks/provider
X-Razorpay-Signature: <hmac_sha256>
X-MID-Code: MID_001
```

Expected Razorpay-format body:
```json
{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "rzp_1234567890_abc",
        "status": "captured",
        "acquirer_data": {
          "upi_transaction_id": "UTR123456789"
        }
      }
    }
  }
}
```

#### Simulate Webhook (Dev Only)
```
POST /webhooks/simulate
```
```json
{
  "payment_id": "PAY_M5X3K1_A2B3",
  "status": "SUCCESS",
  "utr": "UTR987654321"
}
```

---

## 🔄 Payment Flow

```
Merchant → POST /api/payments/create
         ↓
    Validate API Token
         ↓
    Select Active MID (round-robin)
         ↓
    Call Provider Adapter (Razorpay simulation)
         ↓
    Generate UPI Link + QR String
         ↓
    Return payment_id, upi_link, expiry_time
         ↓
    [Customer pays via UPI app]
         ↓
    Provider sends webhook → POST /webhooks/provider
         ↓
    Verify signature (HMAC-SHA256)
         ↓
    Update payment status (PENDING → SUCCESS/FAILED)
         ↓
    Push merchant webhook callback
         ↓
    Retry if merchant server fails (1m → 5m → 15m)
```

---

## 📊 Payment Statuses

| Status    | Description                           |
|-----------|---------------------------------------|
| `CREATED` | Payment order created, awaiting scan  |
| `PENDING` | Customer initiated payment            |
| `SUCCESS` | Payment confirmed with UTR            |
| `FAILED`  | Payment failed at provider            |
| `EXPIRED` | Payment not completed within 5 min    |

---

## 🔁 Webhook Retry Logic

When a merchant's webhook endpoint fails or is unreachable:

| Attempt | Delay after failure |
|---------|---------------------|
| 2nd     | 1 minute            |
| 3rd     | 5 minutes           |
| 4th     | 15 minutes          |

After 4 attempts the webhook is marked `exhausted`. All attempts are logged in `WebhookLog`.

---

## 🔑 Security Features

- **JWT** for Admin APIs (RS-level validation, expiry)
- **API Token** (32-byte random hex) for Merchant APIs
- **HMAC-SHA256** webhook signature verification
- **Timing-safe comparison** for signature checks
- **Rate limiting**: global (200/15min), auth (10/15min), payments (30/min)
- **Input validation** on all endpoints via `express-validator`
- **Idempotent payments**: same `order_id` returns existing payment
- **Sensitive field protection**: `api_key`, `api_secret`, `webhook_secret` are `select: false` in MongoDB

---

## 🔌 Adding a Real Provider

1. Create `src/providers/realRazorpayProvider.js`
2. Implement the same interface:
   - `createPayment(options)` → `{ upi_link, qr_string, provider_payment_id, raw_response }`
   - `verifyWebhook(rawBody, signature, webhookSecret)` → `boolean`
   - `checkPaymentStatus(provider_payment_id, api_key, api_secret)` → `{ status, utr }`
   - `parseWebhookEvent(body)` → `{ event, provider_payment_id, status, utr, raw }`
3. Register it in `src/providers/index.js`:
   ```js
   const PROVIDERS = {
     razorpay: require('./realRazorpayProvider'),
     dummy: require('./razorpayProvider'),
   };
   ```

---

## 🧪 Quick Test Sequence

```bash
# 1. Login as admin
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rupeeflow.com","password":"Admin@123"}'

# 2. Create a MID
curl -X POST http://localhost:3000/api/admin/mids \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"mid_code":"MID_001","provider":"dummy","api_key":"test_key","api_secret":"test_secret","webhook_secret":"whsec_test","upi_id":"test@upi","merchant_name":"Test Merchant"}'

# 3. Create a merchant
curl -X POST http://localhost:3000/api/admin/merchants \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Corp","email":"acme@test.com","password":"Test@1234","webhook_url":"https://webhook.site/your-id"}'

# 4. Assign MID to merchant
curl -X POST http://localhost:3000/api/admin/merchants/<merchant_id>/mids \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"mid_ids":["<mid_id>"]}'

# 5. Create a payment (use api_token from step 3 response)
curl -X POST http://localhost:3000/api/payments/create \
  -H "Authorization: Bearer <api_token>" \
  -H "Content-Type: application/json" \
  -d '{"amount":500,"order_id":"ORD001","customer_name":"Rahul","customer_email":"rahul@test.com","customer_mobile":"9876543210"}'

# 6. Simulate payment success
curl -X POST http://localhost:3000/webhooks/simulate \
  -H "Content-Type: application/json" \
  -d '{"payment_id":"<payment_id>","status":"SUCCESS","utr":"UTR123456"}'
```

---

## 📦 Dependencies

| Package             | Purpose                        |
|---------------------|--------------------------------|
| express             | Web framework                  |
| mongoose            | MongoDB ODM                    |
| bcryptjs            | Password hashing               |
| jsonwebtoken        | JWT auth for admin             |
| express-validator   | Request validation             |
| express-rate-limit  | Rate limiting                  |
| node-cron           | Background jobs (expiry/retry) |
| axios               | Webhook delivery HTTP client   |
| uuid                | UUID generation                |
| dotenv              | Environment variables          |
#   p a y m e n t - m a n a g e m e n t - s e r v e r  
 