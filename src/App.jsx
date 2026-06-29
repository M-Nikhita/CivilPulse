import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import './index.css';

// Pages
import LoginPage   from './components/Auth/LoginPage';
import AppShell    from './components/Layout/AppShell';
import MapView     from './components/Map/MapView';
import IssueFeed   from './components/Feed/IssueFeed';
import ReportForm  from './components/Report/ReportForm';
import Dashboard   from './components/Dashboard/Dashboard';
import AgentPanel  from './components/Agent/AgentPanel';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading CivicPulse…</span>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/"          element={<MapView />} />
                <Route path="/feed"      element={<IssueFeed />} />
                <Route path="/report"    element={<ReportForm />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/agent"     element={<AgentPanel />} />
                <Route path="*"          element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
