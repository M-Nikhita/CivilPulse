import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError('Sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Background glows */}
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />

      <div className="login-card">
        <div className="login-logo">🏙️</div>

        <h1 className="login-title">CivicPulse</h1>
        <p className="login-sub">
          AI-powered civic intelligence platform for Chennai.<br />
          Report, track, and resolve urban infrastructure issues.
        </p>

        {error && (
          <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        <button
          className="btn btn-google w-full"
          onClick={handleLogin}
          disabled={loading}
          id="google-signin-btn"
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              Signing in…
            </span>
          ) : (
            <>
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                style={{ width: 20, height: 20 }}
              />
              Continue with Google
            </>
          )}
        </button>

        <div className="login-divider">Urban intelligence, powered by Gemini AI</div>

        <div className="login-features">
          {[
            { icon: '📸', bg: '#EEEDFE', label: 'Upload a photo — Gemini Vision auto-classifies the issue' },
            { icon: '🗺️', bg: '#E6F1FB', label: 'Live geospatial map with real-time issue pins' },
            { icon: '🤖', bg: '#FAECE7', label: 'Autonomous agent escalates breaches & drafts RTI letters' },
            { icon: '📊', bg: '#E1F5EE', label: 'Public ward accountability scores & SLA tracking' },
          ].map((f) => (
            <div className="login-feature" key={f.label}>
              <div className="login-feature-icon" style={{ background: f.bg }}>{f.icon}</div>
              <span>{f.label}</span>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 24, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          By signing in, you agree to use this platform responsibly for genuine civic reporting.
          Built with Gemini AI · Google Maps API · Firebase · Google Cloud Run.
        </p>
      </div>
    </div>
  );
}
