import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiCalendar, FiUsers, FiMessageSquare, FiSettings, FiLogOut } from 'react-icons/fi';
import { HiOutlineSwitchHorizontal } from 'react-icons/hi';
import './Sidebar.css';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <HiOutlineSwitchHorizontal className="logo-icon" />
          <div>
            <h1 className="logo-text">WorkSync</h1>
            <p className="logo-subtitle">管理後台 Admin Portal</p>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/schedule" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FiCalendar />
          <span>排班表 Schedule</span>
        </NavLink>
        <NavLink to="/staff" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FiUsers />
          <span>員工 Staff</span>
        </NavLink>
        <NavLink to="/ai" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FiMessageSquare />
          <span>AI 助理 Agent</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="user-details">
            <p className="user-name">{user?.name || 'User'}</p>
            <p className="user-email">{user?.email || ''}</p>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="登出 Logout">
          <FiLogOut />
        </button>
      </div>
    </aside>
  );
}
