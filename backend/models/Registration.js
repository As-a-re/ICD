const mongoose = require('mongoose');

const RegistrationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    dob: { type: Date, required: true },
    course: { type: String, required: true },
    preferredDate: { type: Date, required: true },
    paymentReference: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Registration', RegistrationSchema);
