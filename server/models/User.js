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
    // Older documents and manual database edits may have no format field.
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
  if (typeof enteredPassword !== 'string' || typeof this.password !== 'string') return false;
  const format = this.passwordFormat ?? (/^\$2[aby]\$/.test(this.password) ? 'bcrypt' : 'plain');
  if (format === 'plain') return enteredPassword === this.password;
  if (format === 'bcrypt') return await bcrypt.compare(enteredPassword, this.password);
  return false;
};

module.exports = mongoose.model('User', userSchema);
