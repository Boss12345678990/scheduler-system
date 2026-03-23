import { useState } from 'react';
import api from '../services/api';
import './ShiftModal.css';

const SHIFT_TYPES = [
  { key: 'morning', label: '早 (Morning)' },
  { key: 'afternoon', label: '午 (Afternoon)' },
  { key: 'night', label: '晚 (Night)' },
];

export default function ShiftModal({ date, schedule, employees, onClose }) {
  const [dayType, setDayType] = useState(schedule?.dayType || 'working');
  const [shifts, setShifts] = useState({
    morning: schedule?.shifts?.morning?.map(e => e._id) || [],
    afternoon: schedule?.shifts?.afternoon?.map(e => e._id) || [],
    night: schedule?.shifts?.night?.map(e => e._id) || [],
  });
  const [surgery, setSurgery] = useState({
    morning: schedule?.surgery?.morning || false,
    afternoon: schedule?.surgery?.afternoon || false,
    night: schedule?.surgery?.night || false,
  });
  const [saving, setSaving] = useState(false);

  const toggleEmployee = (shiftKey, empId) => {
    setShifts(prev => {
      const current = prev[shiftKey];
      const updated = current.includes(empId)
        ? current.filter(id => id !== empId)
        : [...current, empId];
      return { ...prev, [shiftKey]: updated };
    });
  };

  const handleSave = async () => {
    // Validate: surgery shifts must have at least one 牙助
    for (const { key, label } of SHIFT_TYPES) {
      if (surgery[key]) {
        const shiftEmpIds = shifts[key];
        const numberofYazhu = employees.filter(e => shiftEmpIds.includes(e._id) && e.role === '牙助').length;
        if (numberofYazhu < 2) {
          alert(`${label} 有開刀，必須至少安排兩位牙助！`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      await api.put(`/schedules/${date}`, { dayType, shifts, surgery });
      onClose();
    } catch (err) {
      alert('Error saving schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content shift-modal" onClick={e => e.stopPropagation()}>
        <h2>分配 {date} 的排班</h2>
        <p className="shift-modal-subtitle">Assign shifts for {date}</p>

        <div className="day-type-toggle">
          <label className={`day-type-option ${dayType === 'working' ? 'active' : ''}`}>
            <input
              type="radio"
              name="dayType"
              value="working"
              checked={dayType === 'working'}
              onChange={() => setDayType('working')}
            />
            ● 營業 (Working)
          </label>
          <label className={`day-type-option ${dayType === 'dayoff' ? 'active' : ''}`}>
            <input
              type="radio"
              name="dayType"
              value="dayoff"
              checked={dayType === 'dayoff'}
              onChange={() => setDayType('dayoff')}
            />
            ○ 休診 (Day Off)
          </label>
        </div>

        {dayType === 'working' && (
          <div className="shifts-container">
            {SHIFT_TYPES.map(({ key, label }) => (
              <div key={key} className="shift-section">
                <div className="shift-section-header">
                  <h3 className="shift-section-label">{label}</h3>
                  <label className={`surgery-toggle ${surgery[key] ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={surgery[key]}
                      onChange={() => setSurgery(prev => ({ ...prev, [key]: !prev[key] }))}
                    />
                    手術時段
                  </label>
                </div>
                <div className="shift-employee-groups">
                  {['牙助', '櫃台'].map(role => {
                    const roleEmps = employees.filter(e => e.status === 'Active' && e.role === role);
                    if (roleEmps.length === 0) return null;
                    const roleColor = role === '牙助' ? '#3b82f6' : '#ec4899';
                    return (
                      <div key={role} className="shift-role-group">
                        <span className="shift-role-label" style={{ color: roleColor }}>{role}</span>
                        <div className="shift-employee-list">
                          {roleEmps.map(emp => {
                            const isSelected = shifts[key].includes(emp._id);
                            return (
                              <button
                                key={emp._id}
                                className={`shift-emp-btn ${isSelected ? 'selected' : ''}`}
                                onClick={() => toggleEmployee(key, emp._id)}
                                title={emp.name}
                                style={isSelected
                                  ? { background: roleColor, borderColor: roleColor, color: 'white' }
                                  : { background: `${roleColor}15`, borderColor: `${roleColor}40`, color: roleColor }}
                              >
                                <span className="shift-emp-initials">{emp.initials || emp.name.charAt(0)}</span>
                                <span className="shift-emp-name">{emp.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {employees.filter(e => e.status === 'Active').length === 0 && (
                    <p className="no-employees">No active employees. Add employees first.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="shift-modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner" /> : '確認 (Confirm)'}
          </button>
        </div>
      </div>
    </div>
  );
}
