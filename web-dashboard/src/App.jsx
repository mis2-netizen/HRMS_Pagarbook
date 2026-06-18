import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import EmployeeSimulator from './simulator/EmployeeSimulator';

// Pages
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import Payroll from './pages/Payroll';
import Adjustments from './pages/Adjustments';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

// Icons
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  CircleDollarSign,
  Receipt,
  FileBarChart2,
  Settings as SettingsIcon,
  LogOut,
  Smartphone,
  Sun,
  Moon,
  ShieldCheck,
  Bell,
  Check
} from 'lucide-react';

function DashboardLayout() {
  const { user, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  
  // Notification states
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const token = localStorage.getItem('token');

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('dark-mode');
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/extra/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setNotifications(data);
    } catch (e) {
      console.error(e);
    }
  };

  const markRead = async (id) => {
    try {
      const res = await fetch(`/api/extra/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 30 seconds for live feel
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'hr', 'manager'] },
    { id: 'employees', label: 'Employee Master', icon: Users, roles: ['super_admin', 'hr', 'manager'] },
    { id: 'attendance', label: 'Attendance logs', icon: CalendarCheck, roles: ['super_admin', 'hr', 'manager'] },
    { id: 'leaves', label: 'Leave Approvals', icon: CalendarDays, roles: ['super_admin', 'hr', 'manager'] },
    { id: 'payroll', label: 'Payroll Sheet', icon: Receipt, roles: ['super_admin', 'hr'] },
    { id: 'adjustments', label: 'Ledger Adjusts', icon: CircleDollarSign, roles: ['super_admin', 'hr'] },
    { id: 'reports', label: 'Analytics Reports', icon: FileBarChart2, roles: ['super_admin', 'hr', 'manager'] },
    { id: 'settings', label: 'SaaS Settings', icon: SettingsIcon, roles: ['super_admin', 'hr'] }
  ];

  const allowedMenuItems = menuItems.filter(item => item.roles.includes(user?.role));
  const unreadCount = notifications.filter(n => n.read === 0).length;

  return (
    <div className="app-container">
      
      {/* SaaS Sidebar */}
      <aside className="sidebar">
        <a href="#" className="sidebar-brand">
          <span>💼</span>
          <span>Pagarbook Corp</span>
        </a>

        <ul className="sidebar-menu">
          {allowedMenuItems.map(item => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <a
                  onClick={() => {
                    setCurrentTab(item.id);
                    setIsNotifOpen(false);
                  }}
                  className={`sidebar-item-link ${currentTab === item.id ? 'active' : ''}`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>

        {/* Sidebar Footer Controls */}
        <div className="sidebar-footer">
          
          <button
            onClick={() => {
              setIsSimulatorOpen(!isSimulatorOpen);
              setIsNotifOpen(false);
            }}
            className="sidebar-item-link"
            style={{
              backgroundColor: isSimulatorOpen ? 'var(--primary-color)' : 'var(--primary-soft)',
              color: isSimulatorOpen ? '#ffffff' : 'var(--primary-color)',
              border: 'none',
              justifyContent: 'center'
            }}
          >
            <Smartphone size={18} />
            <span>{isSimulatorOpen ? 'Close Phone Simulator' : 'Open Mobile App'}</span>
          </button>

          <button onClick={toggleDarkMode} className="sidebar-item-link" style={{ background: 'none', border: 'none' }}>
            {darkMode ? <Sun size={18} style={{ color: 'orange' }} /> : <Moon size={18} />}
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <a onClick={logout} className="sidebar-item-link" style={{ color: '#ef4444' }}>
            <LogOut size={18} />
            <span>Sign Out</span>
          </a>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content">
        
        {/* Top Navbar */}
        <header className="navbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', padding: '4px 8px', borderRadius: '6px', backgroundColor: 'var(--primary-color)', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={13} />
              {user?.role.toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            
            {/* Notifications Alert center */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', position: 'relative' }}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-4px',
                    backgroundColor: 'var(--danger)',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown list */}
              {isNotifOpen && (
                <div className="card" style={{
                  position: 'absolute',
                  top: '36px',
                  right: '0',
                  width: '320px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  zIndex: 200,
                  boxShadow: 'var(--shadow-lg)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <h4 style={{ fontSize: '14px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    Notifications Inbox
                  </h4>
                  {notifications.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '12px' }}>No system notifications.</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.notificationId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', opacity: n.read === 1 ? 0.6 : 1 }}>
                        <div style={{ fontSize: '11px', flex: 1, paddingRight: '8px' }}>
                          <p style={{ fontWeight: 'bold' }}>{n.title}</p>
                          <p style={{ color: 'var(--text-sub)', marginTop: '2px' }}>{n.message}</p>
                        </div>
                        {n.read === 0 && (
                          <button
                            onClick={() => markRead(n.notificationId)}
                            style={{ border: 'none', background: 'none', color: 'var(--success)', cursor: 'pointer' }}
                            title="Mark as read"
                          >
                            <Check size={14} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="navbar-profile">
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150"
                alt="avatar"
                className="navbar-avatar"
              />
              <div className="navbar-userinfo">
                <span className="navbar-username">{user?.name}</span>
                <span className="navbar-userrole">{user?.email}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Pages */}
        <div className="page-container">
          {currentTab === 'dashboard' && <Dashboard />}
          {currentTab === 'employees' && <Employees />}
          {currentTab === 'attendance' && <Attendance />}
          {currentTab === 'leaves' && <Leaves />}
          {currentTab === 'payroll' && <Payroll />}
          {currentTab === 'adjustments' && <Adjustments />}
          {currentTab === 'reports' && <Reports />}
          {currentTab === 'settings' && <Settings />}
        </div>

      </main>

      {/* Simulator Side Panel */}
      {isSimulatorOpen && (
        <div style={{
          width: '430px',
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#0f172a',
          transition: 'all 0.3s'
        }}>
          <EmployeeSimulator />
        </div>
      )}

    </div>
  );
}

function LoginPage() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (usrEmail, usrPass) => {
    setLoading(true);
    try {
      await login(usrEmail, usrPass);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f1f5f9' }}>
      
      {/* Left pane branding info */}
      <div style={{ flex: 1, backgroundColor: 'var(--primary-color)', color: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px', backgroundImage: 'radial-gradient(circle at 10% 20%, rgb(40, 91, 60) 0%, rgb(27, 67, 50) 90.2%)' }}>
        <span style={{ fontSize: '72px', marginBottom: '24px' }}>💼</span>
        <h1 style={{ fontSize: '42px', fontFamily: 'var(--font-title)', marginBottom: '16px' }}>HR Payroll System</h1>
        <p style={{ fontSize: '16px', opacity: 0.8, maxWidth: '480px', lineHeight: '1.6' }}>
          An all-in-one platform to onboard employees, run payroll drafts, audit GPS attendance check-ins, approve leaves, and generate salary slips.
        </p>
      </div>

      {/* Right pane Auth Form */}
      <div style={{ width: '480px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px', backgroundColor: '#ffffff' }}>
        
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', color: 'var(--primary-color)' }}>Portal Sign In</h2>
          <p style={{ color: 'var(--text-sub)', fontSize: '13px', marginTop: '4px' }}>Log in to access the administrator dashboard.</p>
        </div>

        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="form-group">
            <label className="label">Admin / HR Email *</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. hr@company.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Password *</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: '600' }}>{error}</p>}

          <button type="submit" className="btn btn-primary" style={{ padding: '12px 0', fontSize: '15px' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>

        </form>

        <div style={{ marginTop: '32px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
          <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '12px' }}>
            Demo Fast-Login Credentials
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleQuickLogin('admin@company.com', 'admin123')}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '8px 0', fontSize: '11px' }}
            >
              👑 Super Admin
            </button>
            <button
              onClick={() => handleQuickLogin('hr@company.com', 'hr123')}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '8px 0', fontSize: '11px' }}
            >
              👩‍💼 HR Manager
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}

function MainAppContent() {
  const { token, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc' }}>
        <span style={{ fontSize: '48px' }}>💼</span>
        <div style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>Loading HRMS Console...</div>
      </div>
    );
  }

  return token ? <DashboardLayout /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
