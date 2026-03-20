const express = require('express');
const Schedule = require('../models/Schedule');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// GET /api/schedules?month=YYYY-MM — get all schedules for a month
router.get('/', async (req, res) => {
  try {
    const { month } = req.query; // e.g. "2025-07"
    if (!month) {
      return res.status(400).json({ message: 'month query param required (YYYY-MM)' });
    }

    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0); // last day of month

    const schedules = await Schedule.find({
      createdBy: req.user._id,
      date: { $gte: startDate, $lte: endDate },
    }).populate('shifts.morning shifts.afternoon shifts.night', 'name initials color role');

    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/schedules/:date — create or update schedule for a specific date
router.put('/:date', async (req, res) => {
  try {
    const dateStr = req.params.date; // e.g. "2025-07-01"
    const date = new Date(dateStr + 'T00:00:00.000Z');
    const { dayType, shifts } = req.body;

    let schedule = await Schedule.findOne({
      date,
      createdBy: req.user._id,
    });

    if (schedule) {
      // Update existing
      if (dayType !== undefined) schedule.dayType = dayType;
      if (shifts) {
        if (shifts.morning) schedule.shifts.morning = shifts.morning;
        if (shifts.afternoon) schedule.shifts.afternoon = shifts.afternoon;
        if (shifts.night) schedule.shifts.night = shifts.night;
      }
      await schedule.save();
    } else {
      // Create new
      schedule = await Schedule.create({
        date,
        dayType: dayType || 'working',
        shifts: shifts || { morning: [], afternoon: [], night: [] },
        createdBy: req.user._id,
      });
    }

    // Return populated
    schedule = await Schedule.findById(schedule._id)
      .populate('shifts.morning shifts.afternoon shifts.night', 'name initials color role');

    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
