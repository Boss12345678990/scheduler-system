const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ChatHistory = require('../models/ChatHistory');
const Employee = require('../models/Employee');
const Schedule = require('../models/Schedule');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Helper: get or create chat history
async function getOrCreateHistory(userId) {
  let history = await ChatHistory.findOne({ userId });
  if (!history) {
    history = await ChatHistory.create({ userId, messages: [] });
  }
  return history;
}

// Helper: build system context about clinic
async function buildSystemContext(userId) {
  const employees = await Employee.find({ createdBy: userId });
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const schedules = await Schedule.find({
    createdBy: userId,
    date: { $gte: startOfMonth, $lte: endOfMonth },
  }).populate('shifts.morning shifts.afternoon shifts.night', 'name role');

  return `You are an AI scheduling assistant for a clinic. Here is the current data:

EMPLOYEES (${employees.length} total):
${employees.map(e => `- ${e.name} (${e.role}, ${e.status})`).join('\n')}

CURRENT MONTH SCHEDULES (${schedules.length} days scheduled):
${schedules.map(s => {
    const d = new Date(s.date).toISOString().split('T')[0];
    const m = s.shifts.morning.map(e => e.name).join(', ') || 'none';
    const a = s.shifts.afternoon.map(e => e.name).join(', ') || 'none';
    const n = s.shifts.night.map(e => e.name).join(', ') || 'none';
    return `${d}: ${s.dayType === 'dayoff' ? 'DAY OFF' : `Morning: [${m}] | Afternoon: [${a}] | Night: [${n}]`}`;
  }).join('\n')}

Help the user with scheduling, answer questions about the system, detect conflicts, and provide summaries. Be friendly and helpful.`;
}

// POST /api/ai/chat — send message to AI
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      // Fallback response when no API key configured
      const history = await getOrCreateHistory(req.user._id);
      history.messages.push({ role: 'user', content: message });
      history.messages.push({
        role: 'assistant',
        content: 'AI Assistant is not configured yet. Please set the GEMINI_API_KEY in the server .env file to enable AI features. For now, you can still use the scheduling system manually!',
      });
      await history.save();
      return res.json({
        reply: history.messages[history.messages.length - 1].content,
        messages: history.messages,
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const systemContext = await buildSystemContext(req.user._id);
    const history = await getOrCreateHistory(req.user._id);

    // Build chat history for context
    const chatMessages = history.messages.slice(-20).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({
      history: chatMessages,
      systemInstruction: systemContext,
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    // Save to history
    history.messages.push({ role: 'user', content: message });
    history.messages.push({ role: 'assistant', content: reply });
    await history.save();

    res.json({ reply, messages: history.messages });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ message: 'AI service error: ' + error.message });
  }
});

// GET /api/ai/history — get chat history
router.get('/history', async (req, res) => {
  try {
    const history = await getOrCreateHistory(req.user._id);
    res.json(history.messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/ai/summary?month=YYYY-MM — generate monthly summary
router.get('/summary', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ message: 'month query param required' });
    }

    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0);

    const employees = await Employee.find({ createdBy: req.user._id });
    const schedules = await Schedule.find({
      createdBy: req.user._id,
      date: { $gte: startDate, $lte: endDate },
    }).populate('shifts.morning shifts.afternoon shifts.night', 'name role');

    // Count shifts per employee
    const employeeStats = {};
    employees.forEach(e => {
      employeeStats[e._id.toString()] = { name: e.name, role: e.role, daysWorked: 0, morningShifts: 0, afternoonShifts: 0, nightShifts: 0 };
    });

    schedules.forEach(s => {
      if (s.dayType === 'dayoff') return;
      s.shifts.morning.forEach(e => {
        const id = e._id.toString();
        if (employeeStats[id]) { employeeStats[id].daysWorked++; employeeStats[id].morningShifts++; }
      });
      s.shifts.afternoon.forEach(e => {
        const id = e._id.toString();
        if (employeeStats[id]) { employeeStats[id].daysWorked++; employeeStats[id].afternoonShifts++; }
      });
      s.shifts.night.forEach(e => {
        const id = e._id.toString();
        if (employeeStats[id]) { employeeStats[id].daysWorked++; employeeStats[id].nightShifts++; }
      });
    });

    res.json({
      month,
      totalWorkingDays: schedules.filter(s => s.dayType === 'working').length,
      totalDaysOff: schedules.filter(s => s.dayType === 'dayoff').length,
      employeeStats: Object.values(employeeStats),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
