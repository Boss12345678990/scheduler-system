const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
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

  return `You are an AI scheduling assistant for a clinic. You can read data and MODIFY schedules using the tools provided.

EMPLOYEES (${employees.length} total):
${employees.map(e => `- ${e.name} (ID: ${e._id}, role: ${e.role}, status: ${e.status})`).join('\n')}

CURRENT MONTH SCHEDULES (${schedules.length} days scheduled):
${schedules.map(s => {
    const d = new Date(s.date).toISOString().split('T')[0];
    const m = s.shifts.morning.map(e => e.name).join(', ') || 'none';
    const a = s.shifts.afternoon.map(e => e.name).join(', ') || 'none';
    const n = s.shifts.night.map(e => e.name).join(', ') || 'none';
    return `${d}: ${s.dayType === 'dayoff' ? 'DAY OFF' : `Morning: [${m}] | Afternoon: [${a}] | Night: [${n}]`}`;
  }).join('\n')}

Today's date is ${now.toISOString().split('T')[0]}.

RULES:
- When assigning shifts, always use the employee IDs from the EMPLOYEES list above.
- Shifts are: morning, afternoon, night. Each shift takes an array of employee IDs.
- A date can be "working" or "dayoff" type.
- Use get_employees to look up employee IDs if needed.
- Use get_schedules to check existing schedules for a date range.
- Use set_schedule to create or update a schedule for a specific date.
- When the user asks to schedule, confirm what you plan to do, then execute with the tools.
- Be friendly, helpful, and respond in the same language the user uses.`;
}

// Tool definitions for Claude
const tools = [
  {
    name: 'get_employees',
    description: 'Get the list of all employees with their IDs, names, roles, and status.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_schedules',
    description: 'Get schedules for a date range. Returns all scheduled shifts within the range.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'set_schedule',
    description: 'Create or update a schedule for a specific date. Can assign employees to morning, afternoon, and/or night shifts.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format',
        },
        day_type: {
          type: 'string',
          enum: ['working', 'dayoff'],
          description: 'Whether this is a working day or day off',
        },
        morning: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of employee IDs for morning shift',
        },
        afternoon: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of employee IDs for afternoon shift',
        },
        night: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of employee IDs for night shift',
        },
      },
      required: ['date'],
    },
  },
];

// Execute a tool call
async function executeTool(toolName, toolInput, userId) {
  switch (toolName) {
    case 'get_employees': {
      const employees = await Employee.find({ createdBy: userId });
      return JSON.stringify(employees.map(e => ({
        id: e._id.toString(),
        name: e.name,
        role: e.role,
        status: e.status,
      })));
    }

    case 'get_schedules': {
      const startDate = new Date(toolInput.start_date + 'T00:00:00.000Z');
      const endDate = new Date(toolInput.end_date + 'T00:00:00.000Z');
      const schedules = await Schedule.find({
        createdBy: userId,
        date: { $gte: startDate, $lte: endDate },
      }).populate('shifts.morning shifts.afternoon shifts.night', 'name role');

      return JSON.stringify(schedules.map(s => ({
        date: new Date(s.date).toISOString().split('T')[0],
        dayType: s.dayType,
        shifts: {
          morning: s.shifts.morning.map(e => ({ id: e._id.toString(), name: e.name })),
          afternoon: s.shifts.afternoon.map(e => ({ id: e._id.toString(), name: e.name })),
          night: s.shifts.night.map(e => ({ id: e._id.toString(), name: e.name })),
        },
      })));
    }

    case 'set_schedule': {
      const date = new Date(toolInput.date + 'T00:00:00.000Z');
      const shifts = {};
      if (toolInput.morning) shifts.morning = toolInput.morning;
      if (toolInput.afternoon) shifts.afternoon = toolInput.afternoon;
      if (toolInput.night) shifts.night = toolInput.night;

      let schedule = await Schedule.findOne({ date, createdBy: userId });

      if (schedule) {
        if (toolInput.day_type) schedule.dayType = toolInput.day_type;
        if (shifts.morning) schedule.shifts.morning = shifts.morning;
        if (shifts.afternoon) schedule.shifts.afternoon = shifts.afternoon;
        if (shifts.night) schedule.shifts.night = shifts.night;
        await schedule.save();
      } else {
        schedule = await Schedule.create({
          date,
          dayType: toolInput.day_type || 'working',
          shifts: {
            morning: shifts.morning || [],
            afternoon: shifts.afternoon || [],
            night: shifts.night || [],
          },
          createdBy: userId,
        });
      }

      schedule = await Schedule.findById(schedule._id)
        .populate('shifts.morning shifts.afternoon shifts.night', 'name role');

      return JSON.stringify({
        success: true,
        date: toolInput.date,
        dayType: schedule.dayType,
        shifts: {
          morning: schedule.shifts.morning.map(e => e.name),
          afternoon: schedule.shifts.afternoon.map(e => e.name),
          night: schedule.shifts.night.map(e => e.name),
        },
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// POST /api/ai/chat — send message to AI with tool use
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const history = await getOrCreateHistory(req.user._id);
      history.messages.push({ role: 'user', content: message });
      history.messages.push({
        role: 'assistant',
        content: 'AI Assistant is not configured yet. Please set the ANTHROPIC_API_KEY in the server environment to enable AI features.',
      });
      await history.save();
      return res.json({
        reply: history.messages[history.messages.length - 1].content,
        messages: history.messages,
      });
    }

    const client = new Anthropic({ apiKey });
    const systemContext = await buildSystemContext(req.user._id);
    const history = await getOrCreateHistory(req.user._id);

    // Build chat history for context
    const chatMessages = history.messages.slice(-20).map(m => ({
      role: m.role,
      content: m.content,
    }));
    chatMessages.push({ role: 'user', content: message });

    // Agentic loop: keep calling Claude until it stops using tools
    let messages = chatMessages;
    let finalReply = '';

    for (let i = 0; i < 10; i++) { // max 10 tool-use rounds
      const result = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: systemContext,
        tools,
        messages,
      });

      // If no tool use, extract the text reply and break
      if (result.stop_reason === 'end_turn') {
        const textBlocks = result.content.filter(b => b.type === 'text');
        finalReply = textBlocks.map(b => b.text).join('\n');
        break;
      }

      // Handle tool use
      if (result.stop_reason === 'tool_use') {
        const toolUseBlocks = result.content.filter(b => b.type === 'tool_use');
        const toolResults = [];

        for (const toolUse of toolUseBlocks) {
          const output = await executeTool(toolUse.name, toolUse.input, req.user._id);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: output,
          });
        }

        // Append assistant message and tool results for next iteration
        messages = [
          ...messages,
          { role: 'assistant', content: result.content },
          { role: 'user', content: toolResults },
        ];
      }
    }

    // Save to history (only the user message and final reply)
    history.messages.push({ role: 'user', content: message });
    history.messages.push({ role: 'assistant', content: finalReply });
    await history.save();

    res.json({ reply: finalReply, messages: history.messages });
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

// POST /api/ai/history/clear — clear chat history (new chat)
router.post('/history/clear', async (req, res) => {
  try {
    const history = await getOrCreateHistory(req.user._id);
    history.messages = [];
    await history.save();
    res.json({ message: 'Chat history cleared' });
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
