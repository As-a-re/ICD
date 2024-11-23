// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const dotenv = require('dotenv');
const axios = require('axios');
const crypto = require('crypto');

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Database connection (using MongoDB as example)
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Application Schema
const ApplicationSchema = new mongoose.Schema({
  fullName: String,
  email: String,
  phone: String,
  dob: Date,
  licenseType: String,
  preferredDate: Date,
  paymentStatus: String,
  paymentMethod: String,
  paymentReference: String,
  amount: Number,
  createdAt: { type: Date, default: Date.now }
});

const Application = mongoose.model('Application', ApplicationSchema);

// Validation middleware
const validateApplication = [
  body('fullName').trim().isLength({ min: 2, max: 50 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('phone').matches(/^\+?[\d\s-]+$/).withMessage('Invalid phone number'),
  body('dob').isDate(),
  body('licenseType').isIn(['learners', 'provisional', 'full']),
  body('preferredDate').isDate(),
];

// Payment gateway configurations
const paymentGateways = {
  mtn: {
    baseUrl: process.env.MTN_API_URL,
    apiKey: process.env.MTN_API_KEY,
    apiSecret: process.env.MTN_API_SECRET
  },
  telecel: {
    baseUrl: process.env.TELECEL_API_URL,
    apiKey: process.env.TELECEL_API_KEY,
    apiSecret: process.env.TELECEL_API_SECRET
  },
  airtel: {
    baseUrl: process.env.AIRTEL_API_URL,
    apiKey: process.env.AIRTEL_API_KEY,
    apiSecret: process.env.AIRTEL_API_SECRET
  },
  bank: {
    merchantId: process.env.BANK_MERCHANT_ID,
    apiKey: process.env.BANK_API_KEY,
    apiSecret: process.env.BANK_API_SECRET
  }
};

// Helper function to generate payment reference
function generatePaymentReference() {
  return `PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// Payment processing functions
async function processMobileMoneyPayment(provider, phoneNumber, amount) {
  const config = paymentGateways[provider];
  const reference = generatePaymentReference();
  
  try {
    const response = await axios.post(`${config.baseUrl}/payments`, {
      phoneNumber,
      amount,
      reference,
      callbackUrl: `${process.env.API_URL}/payment-webhook`
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'X-Reference': reference
      }
    });
    
    return {
      success: true,
      reference,
      providerReference: response.data.providerReference
    };
  } catch (error) {
    console.error('Payment processing error:', error);
    throw new Error('Payment processing failed');
  }
}

async function processBankPayment(amount) {
  const config = paymentGateways.bank;
  const reference = generatePaymentReference();
  
  try {
    const response = await axios.post(`${config.baseUrl}/create-payment`, {
      amount,
      reference,
      callbackUrl: `${process.env.API_URL}/payment-webhook`,
      merchantId: config.merchantId
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      }
    });
    
    return {
      success: true,
      reference,
      paymentUrl: response.data.paymentUrl
    };
  } catch (error) {
    console.error('Bank payment error:', error);
    throw new Error('Bank payment initiation failed');
  }
}

// API Routes
app.post('/api/applications', validateApplication, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const application = new Application(req.body);
    await application.save();
    res.status(201).json({ 
      success: true, 
      applicationId: application._id 
    });
  } catch (error) {
    console.error('Application submission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error submitting application' 
    });
  }
});

app.post('/api/initialize-payment', async (req, res) => {
  const { method, applicationId, amount, phoneNumber } = req.body;

  try {
    let paymentResult;
    
    switch (method) {
      case 'mtn':
      case 'telecel':
      case 'airtel':
        paymentResult = await processMobileMoneyPayment(method, phoneNumber, amount);
        break;
      case 'bank':
        paymentResult = await processBankPayment(amount);
        break;
      default:
        throw new Error('Invalid payment method');
    }

    // Update application with payment reference
    await Application.findByIdAndUpdate(applicationId, {
      paymentReference: paymentResult.reference,
      paymentMethod: method,
      paymentStatus: 'pending'
    });

    res.json(paymentResult);
  } catch (error) {
    console.error('Payment initialization error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Payment initialization failed' 
    });
  }
});

// Payment webhook handler
app.post('/payment-webhook', async (req, res) => {
  const signature = req.headers['x-payment-signature'];
  
  // Verify webhook signature
  const isValid = verifyWebhookSignature(req.body, signature);
  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  const { reference, status, transactionId } = req.body;

  try {
    await Application.findOneAndUpdate(
      { paymentReference: reference },
      { 
        paymentStatus: status,
        'payment.transactionId': transactionId
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Webhook processing failed');
  }
});

function verifyWebhookSignature(payload, signature) {
  const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET);
  const expectedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});