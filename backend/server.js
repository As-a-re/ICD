const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const uri = process.env.MONGODB_URI;

const Registration = require('./models/Registration'); 

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

// Register Endpoint
app.post('/api/register', async (req, res) => {
    const { name, email, phone, dob, course, preferredDate, paymentReference } = req.body;

    try {
        // Save registration to database
        const registration = new Registration({
            name,
            email,
            phone,
            dob,
            course,
            preferredDate,
            paymentReference
        });

        await registration.save();

        res.status(201).json({ message: 'Registration successful', registration });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});

// Payment Verification Endpoint
app.post('/api/payment/verify', async (req, res) => {
    const { reference } = req.body;

    try {
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            }
        });

        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ message: 'Payment verification failed', error });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
