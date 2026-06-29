import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase/config';
import { submitReport } from '../../firebase/firestore';
import { analyzeIssueImage, ISSUE_CATEGORIES } from '../../services/gemini';
import { useAuth } from '../../context/AuthContext';

const CHENNAI_WARDS = [
  'Ward 1 - Manali','Ward 2 - Madhavaram','Ward 18 - Madhavaram Junction',
  'Ward 30 - Tondiarpet','Ward 50 - Perambur','Ward 108 - Gemini / Anna Salai',
  'Ward 130 - T Nagar','Ward 142 - Kodambakkam','Ward 160 - Mylapore',
  'Ward 173 - Adyar','Ward 182 - Velachery','Ward 196 - Velachery Lake',
  'Ward 200 - Sholinganallur',
];

function UrgencyBadge({ urgency }) {
  const map = {
    LOW:      { bg: 'rgba(34,197,94,0.1)',   color: '#4ade80',  label: '🟢 Low' },
    MEDIUM:   { bg: 'rgba(234,179,8,0.1)',   color: '#fde047',  label: '🟡 Medium' },
    HIGH:     { bg: 'rgba(249,115,22,0.1)',  color: '#fb923c',  label: '🟠 High' },
    CRITICAL: { bg: 'rgba(239,68,68,0.1)',   color: '#f87171',  label: '🔴 Critical' },
  };
  const s = map[urgency] || map.MEDIUM;
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

export default function ReportForm() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const fileRef    = useRef(null);
  const cameraRef  = useRef(null);

  const [imageFile,     setImageFile]     = useState(null);
  const [imagePreview,  setImagePreview]  = useState(null);
  const [analyzing,     setAnalyzing]     = useState(false);
  const [geminiResult,  setGeminiResult]  = useState(null);
  const [geminiError,   setGeminiError]   = useState('');
  const [location,      setLocation]      = useState(null);
  const [gpsLoading,    setGpsLoading]    = useState(false);
  const [ward,          setWard]          = useState('Ward 108 - Gemini / Anna Salai');
  const [submitting,    setSubmitting]    = useState(false);
  const [submitted,     setSubmitted]     = useState(false);
  const [toast,         setToast]         = useState('');
  const [dragOver,      setDragOver]      = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleFile = async (file) => {
    if (!file?.type.startsWith('image/')) return;
    setImageFile(file);
    setGeminiResult(null);
    setGeminiError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      // Compress image client-side to <100KB so it fits in Firestore
      try {
        const compressedBase64 = await compressImage(e.target.result);
        setImagePreview(compressedBase64);
        
        // Auto-analyze with Gemini
        setAnalyzing(true);
        const base64Raw = compressedBase64.split(',')[1];
        const result = await analyzeIssueImage(base64Raw, file.type);
        setGeminiResult(result);
        if (!result.isValidIssue) {
          setGeminiError('⚠️ This image does not appear to show a civic issue. Please upload a relevant photo.');
        }
      } catch (err) {
        setGeminiError('Gemini analysis failed: ' + err.message);
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Helper function to compress image using Canvas
  const compressImage = (base64Str) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 450;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // Compress as low-quality JPEG to keep file size small (~40-80KB)
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const getGPS = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
        showToast('📍 Location captured!');
      },
      () => {
        // Default to Chennai center if GPS denied
        setLocation({ lat: 13.0827, lng: 80.2707 });
        setGpsLoading(false);
        showToast('📍 Using Chennai center (GPS denied)');
      }
    );
  };

  const handleSubmit = async () => {
    if (!geminiResult || !geminiResult.isValidIssue) return;
    if (!location) { showToast('📍 Please capture your location first'); return; }

    setSubmitting(true);
    try {
      // Save the compressed Base64 image directly in Firestore, bypassing Firebase Storage!
      const imageUrl = imagePreview;

      const reportId = await submitReport({
        userId:    user.uid,
        userEmail: user.email,
        userName:  user.displayName,
        imageUrl,
        lat:       location.lat,
        lng:       location.lng,
        geminiResult,
        ward,
      });

      setSubmitted(true);
      showToast('✅ Issue reported successfully!');
      setTimeout(() => navigate('/feed'), 2000);
    } catch (err) {
      showToast('❌ Failed to submit: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const sevColor = geminiResult ? (
    geminiResult.severity >= 9 ? '#ef4444' :
    geminiResult.severity >= 7 ? '#f97316' :
    geminiResult.severity >= 5 ? '#eab308' : '#22c55e'
  ) : null;

  if (submitted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 64 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Issue Reported!</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Your report has been submitted. The AI agent is monitoring this issue.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => navigate('/feed')}>View Feed →</button>
          <button className="btn btn-ghost" onClick={() => { setSubmitted(false); setImageFile(null); setImagePreview(null); setGeminiResult(null); }}>Report Another</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div>
          <div className="page-title">📸 Report a Civic Issue</div>
          <div className="page-sub">Upload a photo — Gemini AI will auto-detect the issue type and severity</div>
        </div>
      </div>

      <div className="scroll-y" style={{ flex: 1 }}>
        <div className="report-form">

          {/* Upload zone */}
          {!imagePreview ? (
            <div
              className={`upload-zone${dragOver ? ' drag-over' : ''}`}
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              id="upload-zone"
            >
              <div className="upload-icon">📸</div>
              <div className="upload-title">Drop your photo here</div>
              <div className="upload-sub">or click to browse · JPG, PNG, WEBP</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} id="browse-btn">
                  🖼️ Browse File
                </button>
                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }} id="camera-btn">
                  📷 Take Photo
                </button>
              </div>
            </div>
          ) : (
            <div className="upload-preview">
              <img src={imagePreview} alt="Preview" />
              {analyzing && (
                <div className="analyzing-overlay" style={{ position: 'absolute', inset: 0 }}>
                  <div className="spinner" />
                  <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>🤖 Gemini AI is analyzing…</span>
                </div>
              )}
              <button
                className="upload-preview-remove"
                onClick={() => { setImageFile(null); setImagePreview(null); setGeminiResult(null); setGeminiError(''); }}
                id="remove-image-btn"
              >✕</button>
            </div>
          )}

          <input ref={fileRef}   type="file" accept="image/*"          style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />

          {/* Gemini error */}
          {geminiError && (
            <div className="alert-banner alert-warning">{geminiError}</div>
          )}

          {/* Gemini result */}
          {geminiResult && geminiResult.isValidIssue && (
            <div className="gemini-result" id="gemini-result-panel">
              <div className="gemini-header">
                <div className="gemini-pulse" />
                Gemini AI Analysis
              </div>
              <div className="gemini-grid">
                <div className="gemini-field">
                  <div className="gemini-field-label">Issue Type</div>
                  <div className="gemini-field-value">{geminiResult.category}</div>
                </div>
                <div className="gemini-field">
                  <div className="gemini-field-label">Severity</div>
                  <div className="gemini-field-value" style={{ color: sevColor, fontSize: 20 }}>
                    {geminiResult.severity}/10
                  </div>
                </div>
                <div className="gemini-field">
                  <div className="gemini-field-label">Urgency</div>
                  <UrgencyBadge urgency={geminiResult.urgency} />
                </div>
                <div className="gemini-field">
                  <div className="gemini-field-label">Auto Title</div>
                  <div className="gemini-field-value" style={{ fontSize: 13 }}>{geminiResult.title}</div>
                </div>
              </div>
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {geminiResult.description}
              </div>
            </div>
          )}

          {/* Ward selection */}
          <div className="form-group">
            <label className="form-label">🏘️ Ward</label>
            <select className="form-select" value={ward} onChange={(e) => setWard(e.target.value)} id="ward-select">
              {CHENNAI_WARDS.map((w) => <option key={w}>{w}</option>)}
            </select>
          </div>

          {/* GPS */}
          <div className="form-group">
            <label className="form-label">📍 Location</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-ghost"
                onClick={getGPS}
                disabled={gpsLoading}
                id="get-gps-btn"
              >
                {gpsLoading ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Getting GPS…</> : '📍 Capture My Location'}
              </button>
              {location && (
                <span style={{ fontSize: 12, color: 'var(--sev-low)' }}>
                  ✅ {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </span>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            className="btn btn-primary btn-lg w-full"
            onClick={handleSubmit}
            disabled={!geminiResult || !geminiResult.isValidIssue || !location || submitting}
            id="submit-report-btn"
            style={{ opacity: (!geminiResult || !location) ? 0.5 : 1 }}
          >
            {submitting
              ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Submitting…</>
              : '🚀 Submit Report'
            }
          </button>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            Your report will be publicly visible. The AI agent will monitor it for SLA compliance and escalate if unresolved.
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className="toast info">{toast}</div>
        </div>
      )}
    </div>
  );
}
