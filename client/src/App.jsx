import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SchedulePage from './pages/SchedulePage';
import StaffPage from './pages/StaffPage';
import EmployeeProfilePage from './pages/EmployeeProfilePage';
import AIAgentPage from './pages/AIAgentPage';
import './App.css';

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={user ? <Navigate to="/schedule" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/schedule" replace /> : <RegisterPage />} />

      {/* Protected routes */}
      <Route path="/schedule" element={
        <PrivateRoute>
          <AppLayout><SchedulePage /></AppLayout>
        </PrivateRoute>
      } />
      <Route path="/staff" element={
        <PrivateRoute>
          <AppLayout><StaffPage /></AppLayout>
        </PrivateRoute>
      } />
      <Route path="/staff/:id" element={
        <PrivateRoute>
          <AppLayout><EmployeeProfilePage /></AppLayout>
        </PrivateRoute>
      } />
      <Route path="/ai" element={
        <PrivateRoute>
          <AppLayout><AIAgentPage /></AppLayout>
        </PrivateRoute>
      } />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to={user ? "/schedule" : "/login"} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
