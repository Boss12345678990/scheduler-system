const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add employee name'],
    trim: true,
  },
  role: {
    type: String,
    required: [true, 'Please add employee role'],
    enum: ['牙助', '櫃台'],
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  department: {
    type: String,
    trim: true,
    default: '',
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: '',
  },
  status: {
    type: String,
    enum: ['Active', 'On Leave', 'Inactive'],
    default: 'Active',
  },
  avatar: {
    type: String,
    default: '',
  },
  initials: {
    type: String,
    default: '',
  },
  color: {
    type: String,
    default: '#3b82f6', // overridden by pre-save hook based on role
  },
  dateJoined: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Auto-generate initials and assign color based on role before saving
const ROLE_COLORS = { '牙助': '#3b82f6', '櫃台': '#ec4899' };

employeeSchema.pre('save', function () {
  if (this.isModified('name') || !this.initials) {
    const parts = this.name.trim().split(/\s+/);
    this.initials = parts.map(p => p.charAt(0).toUpperCase()).join('').slice(0, 2);
  }
  if (this.isModified('role') || !this.color || this.isNew) {
    this.color = ROLE_COLORS[this.role] || '#3b82f6';
  }
});

module.exports = mongoose.model('Employee', employeeSchema);
