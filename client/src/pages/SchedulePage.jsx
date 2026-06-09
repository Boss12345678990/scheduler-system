import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiPrinter, FiEdit2, FiBarChart2, FiZap, FiTrash2 } from 'react-icons/fi';
import api from '../services/api';
import ShiftModal from '../components/ShiftModal';
import './SchedulePage.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHIFT_LABELS = { morning: '早', afternoon: '午', night: '晚' };

export default function SchedulePage() {
  const location = useLocation();
  const printMonthHandled = useRef(false);
  const pageRef = useRef(null);
  const [currentDate, setCurrentDate] = useState(() => {
    const pm = location.state?.printMonth;
    if (pm) {
      const [y, m] = pm.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  });
  const [schedules, setSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, empRes] = await Promise.all([
        api.get('/schedules', { params: { month: monthStr } }),
        api.get('/employees', { params: { limit: 100 } }),
      ]);
      setSchedules(schedRes.data);
      setEmployees(empRes.data.employees);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [monthStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---- Print: scale the whole calendar to fit exactly one landscape page ----
  // Static CSS can't guarantee a single page (it can't measure content or know
  // each machine's printer margins / orientation / scale). Instead, just before
  // printing we measure the calendar at print-layout width and apply one uniform
  // transform so it always shrinks to fit one page — no data clipped, no 2nd page.
  // A4 / Letter landscape share a safe page box of ~1056 x 793 CSS px @96dpi.
  const PAGE_W = 1056;
  const PAGE_H = 793;
  const PAGE_MARGIN = 24; // ~6mm breathing room, inside any printer's dead zone

  const fitForPrint = useCallback(() => {
    const el = pageRef.current;
    if (!el) return;
    document.body.classList.add('print-mode');
    // Lay out at the printable width with no transform, then measure natural size.
    el.style.transformOrigin = 'top left';
    el.style.transform = 'none';
    el.style.width = `${PAGE_W - PAGE_MARGIN * 2}px`;
    const naturalW = el.scrollWidth || PAGE_W - PAGE_MARGIN * 2;
    const naturalH = el.scrollHeight || 1;
    const scale = Math.min(
      (PAGE_W - PAGE_MARGIN * 2) / naturalW,
      (PAGE_H - PAGE_MARGIN * 2) / naturalH,
    );
    // Center the scaled calendar within the page box.
    const tx = (PAGE_W - naturalW * scale) / 2;
    const ty = (PAGE_H - naturalH * scale) / 2;
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }, []);

  const resetAfterPrint = useCallback(() => {
    const el = pageRef.current;
    if (el) {
      el.style.transform = '';
      el.style.width = '';
      el.style.transformOrigin = '';
    }
    document.body.classList.remove('print-mode');
  }, []);

  // Catch every print path: the button, the auto-print below, and the browser's
  // own Ctrl+P / menu print.
  useEffect(() => {
    window.addEventListener('beforeprint', fitForPrint);
    window.addEventListener('afterprint', resetAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', fitForPrint);
      window.removeEventListener('afterprint', resetAfterPrint);
    };
  }, [fitForPrint, resetAfterPrint]);

  const handlePrint = () => {
    fitForPrint();
    window.print();
  };

  // Auto-print when navigated from AI agent
  useEffect(() => {
    if (location.state?.printMonth && !loading && !printMonthHandled.current) {
      printMonthHandled.current = true;
      setTimeout(handlePrint, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, loading]);

  // Calendar grid calculation
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const calendarCells = [];
  // Previous month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarCells.push({ day: prevMonthDays - i, currentMonth: false, date: null });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({ day: d, currentMonth: true, date: dateStr });
  }
  // Next month fill
  const remainder = 7 - (calendarCells.length % 7);
  if (remainder < 7) {
    for (let i = 1; i <= remainder; i++) {
      calendarCells.push({ day: i, currentMonth: false, date: null });
    }
  }

  const getScheduleForDate = (dateStr) => {
    return schedules.find(s => {
      const d = new Date(s.date).toISOString().split('T')[0];
      return d === dateStr;
    });
  };

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const goNext = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleCellClick = (cell) => {
    if (!cell.currentMonth) return;
    setSelectedDate(cell.date);
  };

  const handleModalClose = () => {
    setSelectedDate(null);
    fetchData();
  };

  const handleGenerateSummary = () => {
    navigate('/ai', { state: { autoSend: '總結工作量' } });
  };

  const handleGenerateSchedule = async () => {
    if (!window.confirm(`確定要自動排班 ${monthLabel} 嗎？這將覆蓋本月現有的排班。`)) return;
    setGenerating(true);
    try {
      const res = await api.post('/schedules/generate', { month: monthStr });
      let msg = res.data.message;
      if (res.data.warnings && res.data.warnings.length > 0) {
        msg += '\n\n⚠️ Warnings:\n' + res.data.warnings.join('\n');
      }
      alert(msg);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error generating schedule');
    } finally {
      setGenerating(false);
    }
  };

  const handleClearMonth = async () => {
    if (!window.confirm(`確定要清除 ${monthLabel} 的所有排班嗎？此操作無法復原。`)) return;
    try {
      const res = await api.delete('/schedules/clear', { params: { month: monthStr } });
      alert(res.data.message);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error clearing schedules');
    }
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="schedule-page" ref={pageRef}>
      {/* Calendar Header */}
      <div className="calendar-header">
        <div className="calendar-nav">
          <button className="btn btn-secondary btn-sm" onClick={goToday}>今天 Today</button>
          <button className="btn btn-secondary btn-sm" onClick={goPrev}><FiChevronLeft /></button>
          <button className="btn btn-secondary btn-sm" onClick={goNext}><FiChevronRight /></button>
        </div>
        <h2 className="calendar-month-title">{monthLabel}</h2>
        <div className="calendar-view-toggles">
          <button className="btn btn-secondary btn-sm active">月 Month</button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {/* Day headers */}
        <div className="calendar-day-headers">
          {DAYS.map(d => <div key={d} className="day-header">{d}</div>)}
        </div>

        {/* Cells */}
        <div className="calendar-cells">
          {calendarCells.map((cell, idx) => {
            const schedule = cell.date ? getScheduleForDate(cell.date) : null;
            const isDayOff = schedule?.dayType === 'dayoff';
            const isToday = cell.date === todayStr;

            return (
              <div
                key={idx}
                className={`calendar-cell ${!cell.currentMonth ? 'other-month' : ''} ${isDayOff ? 'day-off' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => handleCellClick(cell)}
              >
                <span className="cell-day">{cell.day}</span>

                {schedule && !isDayOff && cell.currentMonth && (
                  <div className="cell-shifts">
                    {['morning', 'afternoon', 'night'].map(shift => {
                      const rawEmps = schedule.shifts[shift];
                      if (!rawEmps || rawEmps.length === 0) return null;
                      const emps = [...rawEmps].sort((a, b) => (a.role === '牙助' ? -1 : 1) - (b.role === '牙助' ? -1 : 1));
                      const hasSurgery = schedule.surgery?.[shift];
                      return (
                        <div key={shift} className="shift-row">
                          <span className="shift-label">{SHIFT_LABELS[shift]}:</span>
                          <div className="shift-badges">
                            {emps.map(emp => (
                              <span
                                key={emp._id}
                                className="employee-badge"
                                style={{ background: emp.color || '#3b82f6' }}
                                title={emp.name}
                              >
                                {emp.initials || emp.name.charAt(0)}
                              </span>
                            ))}
                          </div>
                          {hasSurgery && <span className="surgery-tag">開刀</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {isDayOff && cell.currentMonth && (
                  <div className="day-off-label">休診</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="calendar-footer">
        <button className="btn btn-secondary" onClick={handlePrint}>
          <FiPrinter /> 列印排表 / PRINT
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/staff')}>
          <FiEdit2 /> 編輯員工 / EDIT EMPLOYEES
        </button>
        <button className="btn btn-danger" onClick={handleClearMonth}>
          <FiTrash2 /> 清除排班 / CLEAR ALL
        </button>
        <button className="btn btn-primary" onClick={handleGenerateSchedule} disabled={generating}>
          <FiZap /> {generating ? '生成中...' : '自動排班 / GENERATE SCHEDULE'}
        </button>
        <button className="btn btn-primary" onClick={handleGenerateSummary}>
          <FiBarChart2 /> 總結工作量 / GENERATE WORK SUMMARY
        </button>
      </div>

      {/* Shift Assignment Modal */}
      {selectedDate && (
        <ShiftModal
          date={selectedDate}
          schedule={getScheduleForDate(selectedDate)}
          employees={employees}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
