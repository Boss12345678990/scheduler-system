import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiChevronLeft, FiChevronRight, FiDownload } from 'react-icons/fi';
import api from '../services/api';
import './StaffPage.css';


const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function StaffPage() {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', role: '牙助', phone: '', department: '', email: '', status: 'Active', workingHours: 0, unavailableDays: [] });

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/employees', { params: { search, page, limit: 8 } });
      setEmployees(res.data.employees);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const openAdd = () => {
    setEditingEmployee(null);
    setForm({ name: '', role: '牙助', phone: '', department: '', email: '', status: 'Active', workingHours: 0, unavailableDays: [] });
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditingEmployee(emp);
    setForm({ name: emp.name, role: emp.role, phone: emp.phone, department: emp.department, email: emp.email, status: emp.status, workingHours: emp.workingHours || 0, unavailableDays: emp.unavailableDays || [] });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee._id}`, form);
      } else {
        await api.post('/employees', form);
      }
      setShowModal(false);
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving employee');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    try {
      await api.delete(`/employees/${id}`);
      fetchEmployees();
    } catch (err) {
      alert('Error deleting employee');
    }
  };

  const getStatusBadge = (status) => {
    const cls = status === 'Active' ? 'badge-active' : status === 'On Leave' ? 'badge-leave' : 'badge-inactive';
    return <span className={`badge ${cls}`}>● {status}</span>;
  };

  return (
    <div className="staff-page">
      <div className="staff-header">
        <div className="staff-breadcrumb">Organization &gt; <strong>Staff</strong></div>
        <div className="staff-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>
            <FiPlus /> Add Employee
          </button>
        </div>
      </div>

      <div className="staff-title-section">
        <h1>Staff Directory</h1>
        <p>Showing {total} registered team members across all departments.</p>
      </div>

      <div className="staff-filters">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, position, or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="staff-table-wrapper">
        <table className="staff-table">
          <thead>
            <tr>
              <th>EMPLOYEE NAME</th>
              <th>POSITION / ROLE</th>
              <th>CONTACT DETAILS</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="table-loading"><div className="spinner" /></td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan="5" className="table-empty">No employees found. Add your first employee!</td></tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp._id}>
                  <td>
                    <div className="emp-name-cell">
                      <div className="emp-avatar" style={{ background: emp.color || '#3b82f6' }}>
                        {emp.initials || emp.name.charAt(0)}
                      </div>
                      <div>
                        <p className="emp-name">{emp.name}</p>
                        <p className="emp-id">EMP-{emp._id.slice(-4).toUpperCase()}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="emp-role">{emp.role}</p>
                    <p className="emp-dept">{emp.department || '—'}</p>
                  </td>
                  <td>
                    <p className="emp-contact">{emp.email || '—'}</p>
                    <p className="emp-contact">{emp.phone || '—'}</p>
                  </td>
                  <td>{getStatusBadge(emp.status)}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/staff/${emp._id}`)}>View Profile</button>
                      <button className="icon-btn" onClick={() => openEdit(emp)} title="Edit"><FiEdit2 /></button>
                      <button className="icon-btn icon-btn-danger" onClick={() => handleDelete(emp._id)} title="Delete"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="staff-pagination">
        <p className="pagination-info">Showing {((page - 1) * 8) + 1} to {Math.min(page * 8, total)} of {total} entries</p>
        <div className="pagination-btns">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><FiChevronLeft /></button>
          {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 5).map(p => (
            <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}><FiChevronRight /></button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h2>
            <form onSubmit={handleSubmit} className="emp-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Role *</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required>
                    <option value="牙助">牙助</option>
                    <option value="櫃台">櫃台</option>
                    <option value="牙助+櫃台">牙助+櫃台</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Department</label>
                  <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Working Hours/Month 每月工時 *</label>
                  <input type="number" min="1" value={form.workingHours} onChange={(e) => setForm({ ...form, workingHours: Number(e.target.value) })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Unavailable Days 不可上班日</label>
                <div className="weekday-checkboxes">
                  {WEEKDAYS.map(day => (
                    <label key={day} className={`weekday-checkbox ${form.unavailableDays.includes(day) ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={form.unavailableDays.includes(day)}
                        onChange={() => {
                          setForm(prev => ({
                            ...prev,
                            unavailableDays: prev.unavailableDays.includes(day)
                              ? prev.unavailableDays.filter(d => d !== day)
                              : [...prev.unavailableDays, day]
                          }));
                        }}
                      />
                      {day.slice(0, 3)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingEmployee ? 'Save Changes' : 'Add Employee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
