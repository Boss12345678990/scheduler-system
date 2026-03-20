const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'Please add a date'],
  },
  dayType: {
    type: String,
    enum: ['working', 'dayoff'],
    default: 'working',
  },
  shifts: {
    morning: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    }],
    afternoon: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    }],
    night: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    }],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Compound index:  one schedule per date per user
scheduleSchema.index({ date: 1, createdBy: 1 }, { unique: true });

module.exports = mongoose.model('Schedule', scheduleSchema);
