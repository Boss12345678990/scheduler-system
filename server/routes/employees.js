const express = require('express');
const Employee = require('../models/Employee');
const Schedule = require('../models/Schedule');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET /api/employees — list all employees for the current user
router.get('/', async (req, res) => {
  try {
    const { search, department, status, page = 1, limit = 10 } = req.query;
    const query = { createdBy: req.user._id };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { role: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (department) query.department = department;
    if (status) query.status = status;

    const total = await Employee.countDocuments(query);
    const employees = await Employee.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      employees,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/employees/:id — get single employee with monthly stats
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Calculate days worked this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const schedulesThisMonth = await Schedule.countDocuments({
      createdBy: req.user._id,
      date: { $gte: startOfMonth, $lte: endOfMonth },
      dayType: 'working',
      $or: [
        { 'shifts.morning': employee._id },
        { 'shifts.afternoon': employee._id },
        { 'shifts.night': employee._id },
      ],
    });

    res.json({
      ...employee.toObject(),
      daysWorkedThisMonth: schedulesThisMonth,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/employees — create employee
router.post('/', async (req, res) => {
  try {
    const { name, role, phone, department, email, status } = req.body;

    if (!name || !role) {
      return res.status(400).json({ message: 'Name and role are required' });
    }

    const employee = await Employee.create({
      name,
      role,
      phone: phone || '',
      department: department || '',
      email: email || '',
      status: status || 'Active',
      createdBy: req.user._id,
    });

    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/employees/:id — update employee
router.put('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const fields = ['name', 'role', 'phone', 'department', 'email', 'status'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        employee[field] = req.body[field];
      }
    });

    await employee.save();
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/employees/:id — delete employee
router.delete('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id,
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({ message: 'Employee removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
