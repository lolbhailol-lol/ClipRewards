const { Schema, model } = require('mongoose');

const LEAD_STATUS = ['new', 'contacted', 'converted', 'closed'];

// "Book a demo / Request a pilot" submissions from the landing page.
const leadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    vertical: { type: String, default: 'other' },
    budget: { type: String, default: '' },
    message: { type: String, trim: true, default: '' },
    status: { type: String, enum: LEAD_STATUS, default: 'new', index: true },
  },
  { timestamps: true }
);

module.exports = model('Lead', leadSchema);
module.exports.LEAD_STATUS = LEAD_STATUS;
