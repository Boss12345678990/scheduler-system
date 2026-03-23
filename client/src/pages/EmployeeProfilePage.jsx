import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiPhone, FiBriefcase, FiCalendar } from 'react-icons/fi';
import api from '../services/api';
import './EmployeeProfilePage.css';

export default function EmployeeProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/employees/${id}`);
        setEmployee(res.data);
      } catch {
        navigate('/staff');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id, navigate]);

  if (loading) {
    return <div className="profile-page"><div className="spinner" style={{ margin: '100px auto', width: 40, height: 40 }} /></div>;
  }
  if (!employee) return null;

  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="profile-page">
      <button className="back-btn" onClick={() => navigate('/staff')}>
        <FiArrowLeft /> Back to Staff
      </button>

      <div className="profile-card">
        <div className="profile-header-section">
          <div className="profile-avatar" style={{ background: employee.role === '櫃台' ? '#ec4899' : '#3b82f6' }}>
            {employee.initials || employee.name.charAt(0)}
          </div>
          <div className="profile-info">
            <h1>{employee.name}</h1>
            <span className={`badge ${employee.status === 'Active' ? 'badge-active' : employee.status === 'On Leave' ? 'badge-leave' : 'badge-inactive'}`}>
              ● {employee.status}
            </span>
          </div>
        </div>

        <div className="profile-details">
          <div className="detail-item">
            <FiBriefcase className="detail-icon" />
            <div>
              <p className="detail-label">Role</p>
              <p className="detail-value">{employee.role}</p>
            </div>
          </div>
          <div className="detail-item">
            <FiPhone className="detail-icon" />
            <div>
              <p className="detail-label">Phone</p>
              <p className="detail-value">{employee.phone || 'Not set'}</p>
            </div>
          </div>
          {employee.department && (
            <div className="detail-item">
              <FiBriefcase className="detail-icon" />
              <div>
                <p className="detail-label">Department</p>
                <p className="detail-value">{employee.department}</p>
              </div>
            </div>
          )}
        </div>

        <div className="profile-stats">
          <div className="stat-card">
            <FiCalendar className="stat-icon" />
            <div>
              <p className="stat-number">{employee.daysWorkedThisMonth || 0}</p>
              <p className="stat-label">Days worked in {monthName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
