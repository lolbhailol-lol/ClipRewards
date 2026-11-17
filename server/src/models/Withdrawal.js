const { Schema, model } = require('mongoose');

// A creator's request to be paid to UPI. Admin pays it by hand for now and records the UTR.
const withdrawalSchema = new Schema(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amountPaise: { type: Number, required: true, min: 1 },
    upiId: { type: String, required: true },
    status: { type: String, enum: ['requested', 'paid', 'rejected'], default: 'requested', index: true },
    reference: { type: String, default: '' }, // UPI transaction reference (UTR)
    note: { type: String, default: '' },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

withdrawalSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    amountPaise: this.amountPaise,
    upiId: this.upiId,
    status: this.status,
    reference: this.reference,
    note: this.note,
    paidAt: this.paidAt,
    createdAt: this.createdAt,
  };
};

module.exports = model('Withdrawal', withdrawalSchema);
