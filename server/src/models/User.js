const { Schema, model } = require('mongoose');

const ROLES = ['creator', 'brand', 'admin'];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, trim: true, default: '' },
    // Set when the user signs in with Google through Firebase.
    firebaseUid: { type: String, default: undefined, index: { unique: true, sparse: true } },
    avatarUrl: { type: String, trim: true, default: '' },
    // null until the user picks a role after first sign-in.
    role: { type: String, enum: [...ROLES, null], default: null },
    onboarded: { type: Boolean, default: false },
    creator: {
      instagram: { type: String, trim: true, default: '' },
      youtube: { type: String, trim: true, default: '' },
      upiId: { type: String, trim: true, default: '' },
      // Instagram early access: until Meta approves the app, only Instagram accounts added as
      // testers in Meta can connect. Creators request access here; an admin adds them in Meta.
      igAccess: {
        status: { type: String, enum: ['', 'requested', 'invited', 'connected'], default: '' },
        username: { type: String, trim: true, default: '' },
        requestedAt: Date,
        invitedAt: Date,
      },
    },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand', default: null },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    email: this.email,
    name: this.name,
    avatarUrl: this.avatarUrl,
    role: this.role,
    onboarded: this.onboarded,
    creator: this.creator,
    brandId: this.brandId ? this.brandId.toString() : null,
  };
};

module.exports = model('User', userSchema);
module.exports.ROLES = ROLES;
