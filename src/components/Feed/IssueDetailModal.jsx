import { useState } from 'react';
import { escalateReport, resolveReport } from '../../firebase/firestore';
import { generateComplaintLetter, verifyResolution } from '../../services/gemini';
import { useAuth } from '../../context/AuthContext';

function timeAgo(seconds) {
  if (!seconds) return 'just now';
  const diff = Math.floor(Date.now() / 1000 - seconds);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const CATEGORY_EMOJI = {
  'Pothole':'🕳️','Waterlogging':'🌊','Garbage Dumping':'🗑️',
  'Broken Streetlight':'💡','Damaged Road Sign':'⚠️','Encroachment':'🚧',
  'Open Drain / Sewer':'🚰','Tree Fall':'🌳','Other':'📍',
};

export default function IssueDetailModal({ report, onClose }) {
  const { user } = useAuth();
  const [letter,         setLetter]         = useState(report.complaintLetter || '');
  const [genLoading,     setGenLoading]     = useState(false);
  const [resolveImg,     setResolveImg]     = useState(null);
  const [verifyResult,   setVerifyResult]   = useState(null);
  const [verifyLoading,  setVerifyLoading]  = useState(false);
  const [copied,         setCopied]         = useState(false);

  const generateLetter = async () => {
    setGenLoading(true);
    try {
      const text = await generateComplaintLetter(report);
      setLetter(text);
      await escalateReport(report.id, text);
    } catch (e) {
      console.error(e);
    } finally {
      setGenLoading(false);
    }
  };

  // Helper function to compress resolution proof photo client-side
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
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    });
  };

  const handleResolveImgChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const compressed = await compressImage(reader.result);
        setResolveImg(compressed);
      } catch (err) {
        console.error('Image compression failed:', err);
        setResolveImg(reader.result); // Fallback
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVerify = async () => {
    if (!resolveImg || !report.imageUrl) return;
    setVerifyLoading(true);
    try {
      // For demo: pass dummy original since we might not have original base64
      const base64Resolved = resolveImg.split(',')[1];
      const result = await verifyResolution('', base64Resolved);
      setVerifyResult(result);
      if (result.isResolved) await resolveReport(report.id, resolveImg);
    } catch(e) {
      console.error(e);
    } finally {
      setVerifyLoading(false);
    }
  };

  const copyLetter = () => {
    navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSevColor = (s) => s >= 9 ? '#ef4444' : s >= 7 ? '#f97316' : s >= 5 ? '#eab308' : '#22c55e';
  const pct = ((report.severity || 0) / 10) * 100;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      id="issue-detail-modal"
    >
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 28 }}>{CATEGORY_EMOJI[report.category] || '📍'}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{report.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                📍 {report.ward} · {timeAgo(report.createdAt?.seconds)} · by {report.userName}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: 'var(--text-secondary)', borderRadius: 6, width: 28, height: 28, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        {/* Scrollable content */}
        <div className="scroll-y" style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Image */}
          {report.imageUrl && (
            <img src={report.imageUrl} alt={report.title} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 'var(--r-md)' }} />
          )}

          {/* Description */}
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{report.description}</p>

          {/* Severity bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Severity Score</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: getSevColor(report.severity) }}>{report.severity}/10</span>
            </div>
            <div className="sev-bar-track">
              <div className="sev-bar-fill" style={{ width: `${pct}%`, background: getSevColor(report.severity) }} />
            </div>
          </div>

          {/* Meta grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Category', value: report.category },
              { label: 'Upvotes',  value: `▲ ${report.upvotes || 0}` },
              { label: 'Status',   value: report.status },
            ].map((m) => (
              <div key={m.label} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* SLA breach */}
          {report.slaBreached && (
            <div className="alert-banner alert-critical">
              🚨 <strong>SLA BREACH</strong> — This issue has been unresolved for 72+ hours. AI agent has escalated automatically.
            </div>
          )}

          {/* Complaint letter */}
          {(report.status === 'CRITICAL' || report.status === 'SLA_BREACH') && (
            <div>
              <div className="agent-header">
                <div className="agent-dot" />
                AI Agent — RTI Complaint Letter
              </div>
              {letter ? (
                <>
                  <div className="complaint-letter">{letter}</div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 8 }}
                    onClick={copyLetter}
                    id="copy-letter-btn"
                  >
                    {copied ? '✅ Copied!' : '📋 Copy Letter'}
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-danger"
                  onClick={generateLetter}
                  disabled={genLoading}
                  id="generate-letter-btn"
                >
                  {genLoading ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating…</> : '📝 Generate RTI Complaint Letter'}
                </button>
              )}
            </div>
          )}

          {/* Resolution verification */}
          {report.status !== 'RESOLVED' && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>✅ Mark as Resolved</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                Upload a photo showing the issue has been fixed. Gemini AI will verify the resolution.
              </div>
              <input type="file" accept="image/*" onChange={handleResolveImgChange} style={{ display: 'none' }} id="resolve-img-input" />
              <label htmlFor="resolve-img-input" className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                📸 Upload Resolution Photo
              </label>
              {resolveImg && (
                <div style={{ marginTop: 10 }}>
                  <img src={resolveImg} alt="Resolution" style={{ width: '100%', maxHeight: 150, objectFit: 'cover', borderRadius: 'var(--r-md)', marginBottom: 8 }} />
                  <button className="btn btn-primary btn-sm" onClick={handleVerify} disabled={verifyLoading} id="verify-resolution-btn">
                    {verifyLoading ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Verifying…</> : '🤖 Verify with Gemini AI'}
                  </button>
                  {verifyResult && (
                    <div className={`alert-banner ${verifyResult.isResolved ? 'alert-warning' : 'alert-critical'}`} style={{ marginTop: 8 }}>
                      {verifyResult.isResolved ? '✅' : '❌'} {verifyResult.explanation} (Confidence: {verifyResult.confidence}%)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {report.status === 'RESOLVED' && (
            <div className="alert-banner" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
              ✅ This issue has been resolved and verified.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
