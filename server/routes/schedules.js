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
    const { dayType, shifts, surgery } = req.body;

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
      if (surgery !== undefined) {
        schedule.surgery = { ...schedule.surgery?.toObject?.() || {}, ...surgery };
      }
      await schedule.save();
    } else {
      // Create new
      schedule = await Schedule.create({
        date,
        dayType: dayType || 'working',
        shifts: shifts || { morning: [], afternoon: [], night: [] },
        surgery: surgery || { morning: false, afternoon: false, night: false },
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

// DELETE /api/schedules/clear — remove all schedules for a month
router.delete('/clear', async (req, res) => {
  try {
    const { month } = req.query; // e.g. "2026-04"
    if (!month) {
      return res.status(400).json({ message: 'month query param required (YYYY-MM)' });
    }

    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, mon - 1, 1));
    const endDate = new Date(Date.UTC(year, mon, 0));

    const result = await Schedule.deleteMany({
      createdBy: req.user._id,
      date: { $gte: startDate, $lte: endDate },
    });

    res.json({ message: `Cleared ${result.deletedCount} schedule entries for ${month}`, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ──────────────────────────────────────────────
// Operating hours config (server-side duplicate)
// ──────────────────────────────────────────────
const OPERATING_HOURS = {
  0: { dayoff: true, morning: false, afternoon: false, night: false },
  1: { dayoff: false, morning: false, afternoon: true, night: true,
       hours: { afternoon: 5, night: 2 } },
  2: { dayoff: false, morning: true, afternoon: true, night: false,
       hours: { morning: 3, afternoon: 4 } },
  3: { dayoff: true, morning: false, afternoon: false, night: false },
  4: { dayoff: false, morning: false, afternoon: true, night: true,
       hours: { afternoon: 4, night: 2 } },
  5: { dayoff: false, morning: true, afternoon: true, night: false,
       hours: { morning: 3, afternoon: 4 } },
  6: { dayoff: false, morning: true, afternoon: true, night: false,
       hours: { morning: 3, afternoon: 4 } },
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SHIFT_MIN = { 牙助: 2, 櫃台: 1 };
const SHIFT_MAX = { 牙助: 2, 櫃台: 2 };

// Priority for filling 牙助 positions: 牙助 > 牙助+櫃台
const YAZHU_PRIORITY = ['牙助', '牙助+櫃台'];
// Priority for filling 櫃台 positions: 櫃台 > 牙助+櫃台
const GUITAI_PRIORITY = ['櫃台', '牙助+櫃台'];

// ──────────────────────────────────────────────
// POST /api/schedules/generate — auto-generate schedule for a month
// ──────────────────────────────────────────────
const Employee = require('../models/Employee');

router.post('/generate', async (req, res) => {
  try {
    const { month } = req.body; // e.g. "2026-04"
    if (!month) {
      return res.status(400).json({ message: 'month is required (YYYY-MM)' });
    }

    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();

    // Load all active employees
    const employees = await Employee.find({
      createdBy: req.user._id,
      status: 'Active',
    });

    if (employees.length === 0) {
      return res.status(400).json({ message: 'No active employees found. Please add employees first.' });
    }

    // Track assigned hours per employee for the month
    const assignedHours = {};
    employees.forEach(emp => { assignedHours[emp._id.toString()] = 0; });

    const warnings = [];
    let generatedCount = 0;

    // Helper: get remaining hours for an employee
    const remainingHours = (emp) => {
      return Math.max(0, (emp.workingHours || 0) - assignedHours[emp._id.toString()]);
    };

    // Helper: check if employee still needs hours
    const needsMoreHours = (emp) => {
      return remainingHours(emp) > 0;
    };

    // Helper: pick employees by priority, sorted by most remaining hours first
    const pickEmployees = (needed, priorityList, availablePool, alreadyAssigned, onlyNeedHours = false) => {
      const picked = [];
      const assignedSet = new Set(alreadyAssigned.map(id => id.toString()));

      for (const role of priorityList) {
        if (picked.length >= needed) break;

        const candidates = availablePool
          .filter(emp =>
            emp.role === role &&
            !assignedSet.has(emp._id.toString()) &&
            !picked.some(p => p.toString() === emp._id.toString()) &&
            (!onlyNeedHours || needsMoreHours(emp))
          )
          // Sort by remaining hours descending — employees with more remaining hours get priority
          .sort((a, b) => remainingHours(b) - remainingHours(a));

        for (const emp of candidates) {
          if (picked.length >= needed) break;
          picked.push(emp._id);
          assignedSet.add(emp._id.toString());
        }
      }

      return picked;
    };

    // ── Build schedule data for all working days ──
    const scheduleData = []; // { date, dayOfWeek, config, shifts }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, mon - 1, day));
      const dayOfWeek = date.getUTCDay();
      const config = OPERATING_HOURS[dayOfWeek];

      if (!config || config.dayoff) {
        await Schedule.findOneAndUpdate(
          { date, createdBy: req.user._id },
          {
            date,
            dayType: 'dayoff',
            shifts: { morning: [], afternoon: [], night: [] },
            surgery: { morning: false, afternoon: false, night: false },
            createdBy: req.user._id,
          },
          { upsert: true, new: true }
        );
        generatedCount++;
        continue;
      }

      const dayName = DAY_NAMES[dayOfWeek];
      const availableEmployees = employees.filter(emp =>
        !emp.unavailableDays.includes(dayName)
      );

      const shifts = { morning: [], afternoon: [], night: [] };
      const allAssignedToday = [];

      // ── PASS 1: Fill minimum requirements (2 牙助 + 1 櫃台) ──
      for (const shiftKey of ['morning', 'afternoon', 'night']) {
        if (!config[shiftKey]) continue;

        const yazhus = pickEmployees(SHIFT_MIN['牙助'], YAZHU_PRIORITY, availableEmployees, allAssignedToday);
        const guitais = pickEmployees(SHIFT_MIN['櫃台'], GUITAI_PRIORITY, availableEmployees, [...allAssignedToday, ...yazhus]);

        const shiftEmployees = [...yazhus, ...guitais];
        shifts[shiftKey] = shiftEmployees;

        const shiftHours = config.hours?.[shiftKey] || 2;
        shiftEmployees.forEach(id => {
          allAssignedToday.push(id);
          assignedHours[id.toString()] += shiftHours;
        });

        if (yazhus.length < SHIFT_MIN['牙助']) {
          warnings.push(`${date.toISOString().split('T')[0]} ${shiftKey}: only ${yazhus.length}/${SHIFT_MIN['牙助']} 牙助 assigned`);
        }
        if (guitais.length < SHIFT_MIN['櫃台']) {
          warnings.push(`${date.toISOString().split('T')[0]} ${shiftKey}: only ${guitais.length}/${SHIFT_MIN['櫃台']} 櫃台 assigned`);
        }
      }

      // ── PASS 2: Fill up to max (3 牙助 + 2 櫃台) with employees who still need hours ──
      for (const shiftKey of ['morning', 'afternoon', 'night']) {
        if (!config[shiftKey]) continue;

        const currentYazhuCount = shifts[shiftKey].filter(id => {
          const emp = employees.find(e => e._id.toString() === id.toString());
          return emp && YAZHU_PRIORITY.includes(emp.role);
        }).length;

        const currentGuitaiCount = shifts[shiftKey].filter(id => {
          const emp = employees.find(e => e._id.toString() === id.toString());
          return emp && GUITAI_PRIORITY.includes(emp.role) && !YAZHU_PRIORITY.includes(emp.role);
        }).length;

        // Add extra 牙助 up to max
        if (currentYazhuCount < SHIFT_MAX['牙助']) {
          const extraYazhus = pickEmployees(
            SHIFT_MAX['牙助'] - currentYazhuCount,
            YAZHU_PRIORITY,
            availableEmployees,
            [...allAssignedToday],
            true // only employees who still need hours
          );
          const shiftHours = config.hours?.[shiftKey] || 2;
          extraYazhus.forEach(id => {
            shifts[shiftKey].push(id);
            allAssignedToday.push(id);
            assignedHours[id.toString()] += shiftHours;
          });
        }

        // Add extra 櫃台 up to max
        const guitaiInShift = shifts[shiftKey].filter(id => {
          const emp = employees.find(e => e._id.toString() === id.toString());
          return emp && GUITAI_PRIORITY.includes(emp.role);
        }).length;

        if (guitaiInShift < SHIFT_MAX['櫃台']) {
          const extraGuitais = pickEmployees(
            SHIFT_MAX['櫃台'] - guitaiInShift,
            GUITAI_PRIORITY,
            availableEmployees,
            [...allAssignedToday],
            true
          );
          const shiftHours = config.hours?.[shiftKey] || 2;
          extraGuitais.forEach(id => {
            shifts[shiftKey].push(id);
            allAssignedToday.push(id);
            assignedHours[id.toString()] += shiftHours;
          });
        }
      }

      scheduleData.push({ date, config, shifts });
    }

    // ── PASS 3: Second sweep — add employees who still haven't met their hours ──
    const unfinishedEmployees = employees.filter(emp => needsMoreHours(emp));
    for (const emp of unfinishedEmployees) {
      // Try to add this employee to shifts where there's capacity
      for (const entry of scheduleData) {
        if (!needsMoreHours(emp)) break;

        const dayName = DAY_NAMES[entry.date.getUTCDay()];
        if (emp.unavailableDays.includes(dayName)) continue;

        for (const shiftKey of ['morning', 'afternoon', 'night']) {
          if (!needsMoreHours(emp)) break;
          if (!entry.config[shiftKey]) continue;

          const alreadyInShift = entry.shifts[shiftKey].some(id => id.toString() === emp._id.toString());
          if (alreadyInShift) continue;

          // Check capacity based on role
          const isYazhuRole = YAZHU_PRIORITY.includes(emp.role);
          const isGuitaiRole = GUITAI_PRIORITY.includes(emp.role);

          const yazhuCount = entry.shifts[shiftKey].filter(id => {
            const e = employees.find(e2 => e2._id.toString() === id.toString());
            return e && YAZHU_PRIORITY.includes(e.role);
          }).length;

          const guitaiCount = entry.shifts[shiftKey].filter(id => {
            const e = employees.find(e2 => e2._id.toString() === id.toString());
            return e && GUITAI_PRIORITY.includes(e.role);
          }).length;

          let canAdd = false;
          if (isYazhuRole && yazhuCount < SHIFT_MAX['牙助']) canAdd = true;
          if (isGuitaiRole && guitaiCount < SHIFT_MAX['櫃台']) canAdd = true;

          if (canAdd) {
            entry.shifts[shiftKey].push(emp._id);
            const shiftHours = entry.config.hours?.[shiftKey] || 2;
            assignedHours[emp._id.toString()] += shiftHours;
          }
        }
      }
    }

    // ── Save all working-day schedules ──
    for (const entry of scheduleData) {
      await Schedule.findOneAndUpdate(
        { date: entry.date, createdBy: req.user._id },
        {
          date: entry.date,
          dayType: 'working',
          shifts: entry.shifts,
          surgery: { morning: false, afternoon: false, night: false },
          createdBy: req.user._id,
        },
        { upsert: true, new: true }
      );
      generatedCount++;
    }

    // Report employees who still haven't met their hours
    employees.forEach(emp => {
      const remaining = remainingHours(emp);
      if (remaining > 0) {
        warnings.push(`${emp.name}: still has ${remaining.toFixed(1)}hrs remaining (${assignedHours[emp._id.toString()].toFixed(1)}/${emp.workingHours}hrs assigned)`);
      }
    });

    res.json({
      message: `Generated schedule for ${generatedCount} days in ${month}`,
      generatedCount,
      warnings,
    });
  } catch (error) {
    console.error('Schedule generation error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
