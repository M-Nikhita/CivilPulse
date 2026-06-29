import { useEffect, useState } from 'react';
import { subscribeToReports, upvoteReport, removeUpvote } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import IssueDetailModal from './IssueDetailModal';
import { CHENNAI_ZONES, CHENNAI_WARDS } from '../../utils/chennaiData';

const CATEGORY_EMOJI = {
  'Pothole':             '🕳️',
  'Waterlogging':        '🌊',
  'Garbage Dumping':     '🗑️',
  'Broken Streetlight':  '💡',
  'Damaged Road Sign':   '⚠️',
  'Encroachment':        '🚧',
  'Open Drain / Sewer':  '🚰',
  'Tree Fall':           '🌳',
  'Other':               '📍',
};

function timeAgo(seconds) {
  if (!seconds) return 'just now';
  const diff = Math.floor(Date.now() / 1000 - seconds);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getSeverityColor(sev) {
  if (sev >= 9) return 'var(--sev-critical)';
  if (sev >= 7) return 'var(--sev-high)';
  if (sev >= 5) return 'var(--sev-medium)';
  return 'var(--sev-low)';
}

function StatusBadge({ status }) {
  const map = {
    OPEN:        { cls: 'badge-open',     label: 'Open' },
    IN_PROGRESS: { cls: 'badge-progress', label: 'In Progress' },
    CRITICAL:    { cls: 'badge-critical', label: '🔴 Critical' },
    SLA_BREACH:  { cls: 'badge-breach',   label: '🚨 SLA Breach' },
    RESOLVED:    { cls: 'badge-resolved', label: '✅ Resolved' },
  };
  const s = map[status] || map.OPEN;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function IssueCard({ report, onSelect }) {
  const { user } = useAuth();
  const hasUpvoted = report.upvotedBy?.includes(user?.uid);
  const [voting, setVoting] = useState(false);

  const handleUpvote = async (e) => {
    e.stopPropagation();
    if (!user || voting) return;
    setVoting(true);
    try {
      if (hasUpvoted) await removeUpvote(report.id, user.uid);
      else            await upvoteReport(report.id, user.uid);
    } finally {
      setVoting(false);
    }
  };

  const cardClass = [
    'issue-card',
    report.status === 'CRITICAL' ? 'critical-card' : '',
    report.status === 'SLA_BREACH' ? 'breach-card' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass} onClick={() => onSelect(report)} id={`issue-card-${report.id}`}>
      <div className="issue-card-top">
        {report.imageUrl
          ? <img className="issue-card-img" src={report.imageUrl} alt={report.title} />
          : <div className="issue-card-img-placeholder">{CATEGORY_EMOJI[report.category] || '📍'}</div>
        }
        <div className="issue-card-body">
          <div className="issue-card-title">{report.title}</div>
          <div className="issue-card-desc">{report.description}</div>
          <div className="issue-card-meta">
            <StatusBadge status={report.status} />
            <span className="badge badge-default">{CATEGORY_EMOJI[report.category]} {report.category}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 22,
            fontWeight: 800,
            color: getSeverityColor(report.severity),
            lineHeight: 1,
          }}>{report.severity}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Severity</div>
        </div>
      </div>

      <div className="issue-card-actions">
        <button
          className={`upvote-btn${hasUpvoted ? ' upvoted' : ''}`}
          onClick={handleUpvote}
          disabled={voting}
          id={`upvote-btn-${report.id}`}
        >
          {hasUpvoted ? '▲' : '△'} {report.upvotes || 0} upvotes
        </button>

        <div className="issue-card-location" style={{ marginLeft: 4 }}>
          📍 {report.ward}
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          {timeAgo(report.createdAt?.seconds)}
        </div>
      </div>

      {report.slaBreached && (
        <div className="alert-banner alert-critical" style={{ marginTop: 8, fontSize: 12 }}>
          🚨 SLA BREACH — Unresolved for 72+ hours
        </div>
      )}
    </div>
  );
}

export default function IssueFeed() {
  const [reports,  setReports]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter,   setFilter]   = useState('ALL');
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [wardFilter, setWardFilter] = useState('ALL');
  const [sortBy,   setSortBy]   = useState('newest');

  useEffect(() => {
    const unsub = subscribeToReports(setReports);
    return unsub;
  }, []);

  const filtered = reports.filter((r) => {
    // 1. Status / Category Filter
    let matchFilter = true;
    if (filter !== 'ALL') {
      if (filter === 'CRITICAL_BREACH') matchFilter = r.status === 'CRITICAL' || (r.slaBreached && r.status !== 'RESOLVED');
      else if (filter === 'CRITICAL_ONLY') matchFilter = r.status === 'CRITICAL';
      else if (filter === 'BREACH_ONLY') matchFilter = r.slaBreached && r.status !== 'RESOLVED';
      else matchFilter = r.status === filter || r.category === filter;
    }

    // 2. Zone Filter
    let matchZone = true;
    if (zoneFilter !== 'ALL') {
      const wardMatch = r.ward?.match(/Ward (\d+)/i);
      if (wardMatch) {
        const wardNum = parseInt(wardMatch[1], 10);
        const zoneObj = CHENNAI_ZONES.find(z => z.id === zoneFilter);
        if (zoneObj && (wardNum < zoneObj.start || wardNum > zoneObj.end)) {
           matchZone = false;
        }
      } else {
        matchZone = false;
      }
    }

    // 3. Ward Filter
    let matchWard = true;
    if (wardFilter !== 'ALL') {
      matchWard = r.ward?.includes(wardFilter);
    }

    return matchFilter && matchZone && matchWard;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'newest')   return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    if (sortBy === 'severity') return (b.severity || 0) - (a.severity || 0);
    if (sortBy === 'upvotes')  return (b.upvotes  || 0) - (a.upvotes  || 0);
    return 0;
  });

  const breachCount   = reports.filter((r) => r.slaBreached && r.status !== 'RESOLVED').length;
  const criticalCount = reports.filter((r) => r.status === 'CRITICAL').length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div>
          <div className="page-title">📋 Issue Feed</div>
          <div className="page-sub">{reports.length} total · {criticalCount} critical · {breachCount} SLA breach</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={zoneFilter}
            onChange={(e) => {
              setZoneFilter(e.target.value);
              setWardFilter('ALL'); // Reset ward filter when zone changes
            }}
            id="feed-zone-filter-select"
          >
            <option value="ALL">All Zones</option>
            {CHENNAI_ZONES.map((z) => (
              <option key={z.id} value={z.id}>{z.id} - {z.name}</option>
            ))}
          </select>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            id="feed-ward-filter-select"
          >
            <option value="ALL">All Wards / Areas</option>
            {CHENNAI_WARDS.filter(w => zoneFilter === 'ALL' || w.zoneId === zoneFilter).map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            id="feed-filter-select"
          >
            <option value="ALL">All Issues</option>
            <option value="CRITICAL_BREACH">🚨 Critical / Breach</option>
            <option value="CRITICAL_ONLY">🔴 Critical Only</option>
            <option value="BREACH_ONLY">⚠️ SLA Breach Only</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
            <option value="Pothole">Potholes</option>
            <option value="Waterlogging">Waterlogging</option>
            <option value="Garbage Dumping">Garbage</option>
          </select>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            id="feed-sort-select"
          >
            <option value="newest">Newest</option>
            <option value="severity">Severity</option>
            <option value="upvotes">Most Upvoted</option>
          </select>
        </div>
      </div>

      {/* SLA breach banner */}
      {breachCount > 0 && (
        <div className="alert-banner alert-critical" style={{ margin: '12px 16px 0', borderRadius: 'var(--r-md)' }}>
          🚨 <strong>{breachCount} issue{breachCount > 1 ? 's' : ''}</strong> have breached the 72-hour SLA — AI agent has escalated these automatically
        </div>
      )}

      <div className="scroll-y" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No issues found</div>
            <div className="empty-state-sub">Issues reported by citizens will appear here in real time</div>
          </div>
        ) : (
          sorted.map((r) => (
            <IssueCard key={r.id} report={r} onSelect={setSelected} />
          ))
        )}
      </div>

      {selected && <IssueDetailModal report={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
