import { useEffect, useState } from 'react';
import {
  subscribeToReports,
  checkAndMarkSLABreaches,
  escalateReport,
  getAllReports,
  markSLABreach,
  seedMockReports,
  clearAllReports,
} from '../../firebase/firestore';
import { generateComplaintLetter } from '../../services/gemini';
import { useAuth } from '../../context/AuthContext';

function AgentLogEntry({ icon, title, desc, time, type = 'info' }) {
  const colors = {
    info:     { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',  icon: '#60a5fa' },
    critical: { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',  icon: '#f87171' },
    warning:  { bg: 'rgba(234,179,8,0.08)',   border: 'rgba(234,179,8,0.2)',   icon: '#fde047' },
    success:  { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)',   icon: '#4ade80' },
  };
  const c = colors[type] || colors.info;

  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 'var(--r-md)', padding: '12px 14px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
      animation: 'slideIn 0.3s ease',
    }}>
      <div style={{ fontSize: 20, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{time}</div>
    </div>
  );
}

export default function AgentPanel() {
  const { user }   = useAuth();
  const [reports,  setReports]  = useState([]);
  const [log,      setLog]      = useState(() => {
    const saved = localStorage.getItem('civicpulse_agent_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [running,  setRunning]  = useState(false);
  const [seeding,  setSeeding]  = useState(false);
  const [resetting, setResetting] = useState(false);
  const [seedCount, setSeedCount] = useState(100);
  
  // Local state to keep card counts in sync with the log completion
  const [displayStats, setDisplayStats] = useState({
    total: 0,
    breached: 0,
    swarmReady: 0
  });

  useEffect(() => {
    localStorage.setItem('civicpulse_agent_logs', JSON.stringify(log));
  }, [log]);

  // Sync stats only when not actively running, seeding, or resetting
  useEffect(() => {
    if (!seeding && !running && !resetting) {
      setDisplayStats({
        total: reports.length,
        breached: reports.filter((r) => r.slaBreached).length,
        swarmReady: reports.filter((r) => (r.upvotes || 0) >= 3 && r.status === 'OPEN').length
      });
    }
  }, [reports, seeding, running, resetting]);

  useEffect(() => {
    const unsub = subscribeToReports(setReports);
    return unsub;
  }, []);

  const pushLog = (entry) => setLog((prev) => [entry, ...prev]);

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to delete all reports from the database? This cannot be undone.")) return;
    setResetting(true);
    try {
      await clearAllReports();
      pushLog({
        icon: '🗑️', type: 'critical',
        title: 'Database Wiped',
        desc: 'Successfully deleted all Chennai reports from the Firestore database.',
        time: 'now'
      });
    } catch (err) {
      pushLog({ icon: '❌', type: 'critical', title: 'Reset error', desc: err.message, time: 'now' });
    } finally {
      setResetting(false);
    }
  };

  // Main agent run
  const runAgent = async () => {
    setRunning(true);
    setLog([]); // Clear logs for fresh run
    pushLog({ icon: '🤖', title: 'Agent started', desc: 'CivicPulse autonomous agent scanning all open issues…', time: 'now', type: 'info' });

    try {
      // 1. Check SLA breaches (process locally using memory array)
      const cutoff = Date.now() - 72 * 60 * 60 * 1000; // 72 hours ago
      const pendingSlaReports = reports.filter(
        (r) => (r.status === 'OPEN' || r.status === 'IN_PROGRESS') && !r.slaBreached
      );

      let breachCount = 0;
      for (const report of pendingSlaReports) {
        const createdMs = report.createdAt?.seconds * 1000 || 0;
        if (createdMs > 0 && createdMs < cutoff) {
          await markSLABreach(report.id);
          breachCount++;
        }
      }

      if (breachCount > 0) {
        pushLog({
          icon: '🚨', type: 'critical',
          title: `SLA Breach detected — ${breachCount} issue${breachCount > 1 ? 's' : ''}`,
          desc: `${breachCount} issue${breachCount > 1 ? 's have' : ' has'} exceeded the 72-hour resolution SLA. Marked as SLA_BREACH. Public breach notice published.`,
          time: 'now',
        });
      } else {
        pushLog({ icon: '✅', type: 'success', title: 'SLA Check passed', desc: 'No new SLA breaches detected.', time: 'now' });
      }

      // 2. Swarm escalation (process locally using memory array)
      const swarmCandidates = reports.filter(
        (r) => (r.upvotes || 0) >= 3 && r.status === 'OPEN' && !r.complaintLetter
      );

      let escalatedInThisRun = 0;
      if (swarmCandidates.length > 0) {
        pushLog({
          icon: '🐝', type: 'warning',
          title: `Swarm escalation — ${swarmCandidates.length} issue${swarmCandidates.length > 1 ? 's' : ''}`,
          desc: `Generating RTI complaint letters and escalating ${swarmCandidates.length} issues in parallel…`,
          time: 'now',
        });

        // Run all generations and updates in parallel!
        const escalationPromises = swarmCandidates.map(async (report) => {
          try {
            const letter = await generateComplaintLetter(report);
            await escalateReport(report.id, letter);
            escalatedInThisRun++;
          } catch (innerErr) {
            console.error(`Failed to escalate ${report.title}:`, innerErr);
          }
        });

        await Promise.all(escalationPromises);

        if (escalatedInThisRun > 0) {
          pushLog({
            icon: '📝', type: 'success',
            title: `RTI letters generated for ${escalatedInThisRun} issues`,
            desc: `Drafted GCC formal complaints and escalated ${escalatedInThisRun} issues to CRITICAL status.`,
            time: 'now',
          });
        }
      } else {
        pushLog({ icon: '✅', type: 'success', title: 'Swarm check passed', desc: 'No issues require swarm escalation at this time.', time: 'now' });
      }

      const totalEscalated = reports.filter(r => r.status === 'CRITICAL' && r.complaintLetter).length;
      pushLog({ icon: '🏁', type: 'success', title: 'Agent run complete', desc: `Processed ${reports.length} reports. ${breachCount} breaches. ${totalEscalated} escalated.`, time: 'now' });

    } catch (err) {
      pushLog({ icon: '❌', type: 'critical', title: 'Agent error', desc: err.message, time: 'now' });
    } finally {
      setRunning(false);
    }
  };

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const count = await seedMockReports(user.uid, user.email, user.displayName, seedCount, reports);
      
      if (count > 0) {
        pushLog({
          icon: '🌱', type: 'success',
          title: `Seeded ${count} new Chennai reports`,
          desc: `Successfully added ${count} unique mock issues across various Chennai locations.`,
          time: 'now'
        });
      } else {
        pushLog({
          icon: 'ℹ️', type: 'info',
          title: 'All issues already seeded',
          desc: `No new mock issues were added because all ${seedCount} unique Chennai issues are already in the database.`,
          time: 'now'
        });
      }
    } catch (err) {
      pushLog({ icon: '❌', type: 'critical', title: 'Seed error', desc: `Failed to write to database. Check if Firestore is enabled in Test Mode. Error: ${err.message}`, time: 'now' });
    } finally {
      setSeeding(false);
    }
  };

  // Live stats
  const critical = reports.filter((r) => r.status === 'CRITICAL').length;
  const breached = reports.filter((r) => r.slaBreached).length;
  const swarmReady = reports.filter((r) => (r.upvotes || 0) >= 3 && r.status === 'OPEN').length;

  // Check if URL has ?admin=true parameter and save it to sessionStorage so it persists during navigation
  const queryParams = new URLSearchParams(window.location.search);
  const adminParam = queryParams.get('admin')?.toLowerCase();
  if (adminParam === 'true') {
    sessionStorage.setItem('civicpulse_is_admin', 'true');
  } else if (adminParam === 'false') {
    sessionStorage.removeItem('civicpulse_is_admin');
  }
  const isAdmin = sessionStorage.getItem('civicpulse_is_admin') === 'true';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div>
          <div className="page-title">🤖 AI Agent Log</div>
          <div className="page-sub">Autonomous civic accountability agent — monitoring 24/7</div>
        </div>
        
        {/* Only render action controls if user is in admin mode (?admin=true) */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 12px', height: '38px', fontSize: '13px' }}
              value={seedCount}
              onChange={(e) => setSeedCount(Number(e.target.value))}
              disabled={seeding}
              id="seed-count-select"
            >
              <option value={50}>50 Issues</option>
              <option value={100}>100 Issues</option>
              <option value={200}>200 Issues</option>
              <option value={500}>500 Issues</option>
            </select>
            <button className="btn btn-ghost btn-sm" style={{ height: '38px' }} onClick={handleSeed} disabled={seeding} id="seed-data-btn">
              {seeding ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Seeding…</> : '🌱 Seed Data'}
            </button>
            <button className="btn btn-primary" style={{ height: '38px' }} onClick={runAgent} disabled={running} id="run-agent-btn">
              {running ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Agent Running…</> : '▶ Run Agent Now'}
            </button>
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ height: '38px', color: 'var(--text-muted)' }} 
              onClick={handleReset}
              disabled={resetting}
              id="reset-db-btn"
            >
              {resetting ? 'Resetting...' : '🗑️ Reset DB'}
            </button>
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ height: '38px', color: 'var(--sev-critical)' }} 
              onClick={() => { setLog([]); localStorage.removeItem('civicpulse_agent_logs'); }}
              id="clear-logs-btn"
            >
              🗑️ Clear Logs
            </button>
          </div>
        )}
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Agent status cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Issues Tracked',   value: displayStats.total, icon: '📋', color: 'var(--brand)' },
            { label: 'SLA Breaches',     value: displayStats.breached,       icon: '🚨', color: 'var(--sev-critical)' },
            { label: 'Swarm Ready',      value: displayStats.swarmReady,     icon: '🐝', color: 'var(--sev-medium)' },
          ].map((s) => (
            <div className="card" key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Agent capabilities */}
        <div className="card">
          <div className="agent-header">
            <div className="agent-dot" />
            Agent Capabilities
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '🐝', title: 'Community Swarm Escalation', desc: 'When 3+ upvotes on an issue → auto-escalates to CRITICAL and generates RTI letter addressed to GCC Commissioner' },
              { icon: '⏰', title: 'SLA Breach Monitor',          desc: 'Checks every open issue against the 72-hour SLA. Breached issues are flagged publicly on the feed and shame wall.' },
              { icon: '📝', title: 'RTI Complaint Generator',     desc: 'Gemini drafts formal RTI-style complaint letters for escalated issues — ready to submit to municipal authorities.' },
              { icon: '✅', title: 'Resolution Verifier',          desc: 'Gemini Vision compares before/after photos to confirm issues are genuinely fixed, preventing false closures.' },
            ].map((c) => (
              <div key={c.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 20, flexShrink: 0 }}>{c.icon}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent log */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Agent Activity Log</div>
          {log.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <div className="empty-state-icon">🤖</div>
              <div className="empty-state-title">Agent not yet run</div>
              <div className="empty-state-sub">Click "Run Agent Now" to scan all issues, check SLA breaches, and trigger swarm escalations</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {log.map((entry, i) => <AgentLogEntry key={i} {...entry} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
