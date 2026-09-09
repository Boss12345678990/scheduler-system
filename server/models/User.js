const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
  },
  passwordFormat: {
    type: String,
    enum: ['bcrypt', 'plain'],
    // Existing documents have no format field and contain bcrypt hashes.
    default: 'bcrypt',
  },
  isFirstLogin: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Store new or changed passwords literally and identify their format.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.passwordFormat = 'plain';
});

// Continue accepting passwords for accounts created with bcrypt hashing.
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (typeof enteredPassword !== 'string') return false;
  if (this.passwordFormat === 'plain') return enteredPassword === this.password;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
