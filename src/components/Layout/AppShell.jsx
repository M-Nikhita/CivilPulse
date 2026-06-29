import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { path: '/',          icon: '🗺️', label: 'Live Map',        id: 'nav-map' },
  { path: '/feed',      icon: '📋', label: 'Issue Feed',       id: 'nav-feed' },
  { path: '/report',    icon: '📸', label: 'Report Issue',     id: 'nav-report' },
  { path: '/dashboard', icon: '📊', label: 'Performance Dashboard', id: 'nav-dashboard' },
  { path: '/agent',     icon: '🤖', label: 'AI Agent Log',     id: 'nav-agent' },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">🏙️</div>
          <div>
            <div className="navbar-title">CivicPulse</div>
            <div className="navbar-sub">Chennai Urban Intelligence</div>
          </div>
        </div>

        <div className="navbar-right">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/report')}
            id="navbar-report-btn"
          >
            + Report Issue
          </button>

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="user-avatar">
                {user.photoURL
                  ? <img src={user.photoURL} alt={user.displayName} referrerPolicy="no-referrer" />
                  : <div style={{ width: '100%', height: '100%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700 }}>
                      {user.displayName?.[0] || '?'}
                    </div>
                }
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={logout}
                id="logout-btn"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Body */}
      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="nav-section-label">Navigation</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              id={item.id}
              className={`nav-item${location.pathname === item.path ? ' active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}

          {/* Sidebar footer */}
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Powered by{' '}
              <span style={{ color: 'var(--brand)' }}>Gemini Vision</span> ·{' '}
              <span style={{ color: 'var(--brand)' }}>Maps API</span> ·{' '}
              <span style={{ color: 'var(--brand)' }}>Firebase</span> ·{' '}
              <span style={{ color: 'var(--brand)' }}>Cloud Run</span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
