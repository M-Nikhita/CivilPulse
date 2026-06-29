import { useEffect, useState } from 'react';
import { subscribeToReports, computeAccountabilityScore } from '../../firebase/firestore';
import { CHENNAI_WARDS, CHENNAI_ZONES } from '../../utils/chennaiData';

function ScoreRing({ score }) {
  const radius = 52;
  const circ   = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color  = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';
  const grade  = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div className="score-circle">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle className="score-circle-track" cx="60" cy="60" r={radius} />
          <circle
            className="score-circle-fill"
            cx="60" cy="60" r={radius}
            stroke={color}
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="score-center">
          <div className="score-number" style={{ color }}>{score}</div>
          <div className="score-label">Score</div>
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{grade}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {score >= 70 ? 'Good Performance' : score >= 40 ? 'Needs Improvement' : 'Critical — Action Required'}
      </div>
    </div>
  );
}

function ShameWall({ reports }) {
  const now = Date.now();
  const shamers = reports.filter((r) => {
    if (r.status === 'RESOLVED') return false;
    const created = (r.createdAt?.seconds || 0) * 1000;
    const days = (now - created) / 86400000;
    return days >= 1; // lowered for demo (real: 30 days)
  }).map((r) => ({
    ...r,
    daysOld: Math.floor((now - (r.createdAt?.seconds || 0) * 1000) / 86400000),
  })).sort((a, b) => b.daysOld - a.daysOld).slice(0, 5);

  if (!shamers.length) return (
    <div className="empty-state" style={{ padding: 32 }}>
      <div className="empty-state-icon">🎉</div>
      <div className="empty-state-title">No issues on the shame wall!</div>
      <div className="empty-state-sub">All issues are within SLA limits</div>
    </div>
  );

  return (
    <div>
      {shamers.map((r) => (
        <div className="shame-wall-item" key={r.id}>
          <div className="shame-days-badge">{r.daysOld}d</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.ward} · Severity {r.severity}/10</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--sev-critical)', fontWeight: 600 }}>Unresolved</div>
        </div>
      ))}
    </div>
  );
}

const isWardInZone = (wardString, zoneId) => {
  if (!wardString || !zoneId) return false;
  const match = wardString.match(/Ward (\d+)/i);
  if (!match) return false;
  const wardNum = parseInt(match[1], 10);
  const zone = CHENNAI_ZONES.find(z => z.id === zoneId);
  return zone && wardNum >= zone.start && wardNum <= zone.end;
};

const getLocalHeroes = (scope, selectedZone, selectedWard) => {
  const firstNames = ['Rajesh', 'Priya', 'Anand', 'Sneha', 'Karthik', 'Sandhya', 'Vijay', 'Deepa', 'Suresh', 'Divya', 'Ramesh', 'Aswathy', 'Manoj', 'Harini', 'Ganesh'];
  const lastNames = ['Kumar', 'Mudaliar', 'Sundaram', 'Ramachandran', 'Srinivasan', 'Rajan', 'Balaji', 'Nathan', 'Krishnan', 'Naidu'];
  
  const badges = [
    { label: 'Pothole Patrol', icon: '👷' },
    { label: 'Waste Watcher', icon: '♻️' },
    { label: 'Light Savior', icon: '💡' },
    { label: 'Water Guardian', icon: '💧' },
    { label: 'Drain Watchdog', icon: '🚰' },
    { label: 'Civic Hero', icon: '🦸' },
    { label: 'Clean Chennai Ambassador', icon: '🌱' },
  ];

  const hashString = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const seedKey = scope === 'CITY' ? 'CITY' : scope === 'ZONE' ? selectedZone : selectedWard;
  const seed = hashString(seedKey);

  const localHeroes = [];
  for (let i = 0; i < 4; i++) {
    const fIdx = (seed + i * 7) % firstNames.length;
    const lIdx = (seed + i * 13) % lastNames.length;
    const name = `${firstNames[fIdx]} ${lastNames[lIdx]}`;
    
    const bIdx = (seed + i * 17) % badges.length;
    const badgeObj = badges[bIdx];

    const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : badgeObj.icon;
    const points = Math.max(50, 480 - i * 90 - (seed % 30));
    const contextTag = scope === 'CITY' ? 'Chennai' : scope === 'ZONE' ? `${selectedZone}` : `${selectedWard.replace('Ward ', 'W')}`;

    localHeroes.push({
      name,
      points,
      badge: `${rankIcon} ${badgeObj.label} (${contextTag})`,
      icon: badgeObj.icon,
    });
  }

  return localHeroes;
};

export default function Dashboard() {
  const [scope, setScope] = useState('CITY'); // 'CITY', 'ZONE', 'WARD'
  const [selectedZone, setSelectedZone] = useState(CHENNAI_ZONES[0].id);
  const [selectedWard, setSelectedWard] = useState(CHENNAI_WARDS[0].id);
  const [allReports, setAllReports] = useState([]);

  useEffect(() => {
    const unsub = subscribeToReports(setAllReports);
    return unsub;
  }, []);

  const reports = allReports.filter((r) => {
    if (scope === 'CITY') return true;
    if (scope === 'ZONE') return isWardInZone(r.ward, selectedZone);
    if (scope === 'WARD') return r.ward === selectedWard;
    return true;
  });

  const score       = computeAccountabilityScore(reports);
  const open        = reports.filter((r) => r.status === 'OPEN' || r.status === 'CRITICAL').length;
  const resolved    = reports.filter((r) => r.status === 'RESOLVED').length;
  const breaches    = reports.filter((r) => r.slaBreached && r.status !== 'RESOLVED').length;
  const totalUp     = reports.reduce((s, r) => s + (r.upvotes || 0), 0);

  // Category breakdown
  const catMap = {};
  reports.forEach((r) => { catMap[r.category] = (catMap[r.category] || 0) + 1; });
  const topCategories = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const localHeroes = getLocalHeroes(scope, selectedZone, selectedWard);

  // Compute rankings
  const zoneRankings = CHENNAI_ZONES.map((zone) => {
    const zoneReps = allReports.filter((r) => isWardInZone(r.ward, zone.id));
    const zoneScore = computeAccountabilityScore(zoneReps);
    return {
      ...zone,
      score: zoneScore,
      total: zoneReps.length,
      breaches: zoneReps.filter((r) => r.slaBreached && r.status !== 'RESOLVED').length,
    };
  }).sort((a, b) => b.score - a.score);

  const zoneWards = CHENNAI_WARDS.filter((w) => w.zoneId === selectedZone);
  const wardRankings = zoneWards.map((ward) => {
    const wardReps = allReports.filter((r) => r.ward === ward.id);
    const wardScore = computeAccountabilityScore(wardReps);
    return {
      ...ward,
      score: wardScore,
      total: wardReps.length,
      breaches: wardReps.filter((r) => r.slaBreached && r.status !== 'RESOLVED').length,
    };
  }).sort((a, b) => b.score - a.score);

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ gap: 16 }}>
        <div>
          <div className="page-title">📊 GCC Performance Dashboard</div>
          <div className="page-sub">Live accountability ratings and performance stats</div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto' }}>
          {/* Scope selection */}
          <div className="btn-group" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: 3, borderRadius: 'var(--r-md)' }}>
            {[
              { id: 'CITY', label: '🏙️ City' },
              { id: 'ZONE', label: '🏢 Zone' },
              { id: 'WARD', label: '📍 Ward' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setScope(t.id)}
                className={`btn btn-${scope === t.id ? 'primary' : 'text'}`}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  borderRadius: 'var(--r-sm)',
                  border: 'none',
                  background: scope === t.id ? 'var(--brand)' : 'transparent',
                  color: scope === t.id ? '#ffffff' : 'var(--text-secondary)'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Zone selection (for ZONE and WARD scopes) */}
          {(scope === 'ZONE' || scope === 'WARD') && (
            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 12px' }}
              value={selectedZone}
              onChange={(e) => {
                setSelectedZone(e.target.value);
                // Also update the ward selection to the first ward in this zone if we are in WARD scope
                const firstWardInNewZone = CHENNAI_WARDS.find(w => w.zoneId === e.target.value);
                if (firstWardInNewZone) setSelectedWard(firstWardInNewZone.id);
              }}
              id="dashboard-zone-select"
            >
              {CHENNAI_ZONES.map((z) => (
                <option key={z.id} value={z.id}>{z.id} - {z.name}</option>
              ))}
            </select>
          )}

          {/* Ward selection (only for WARD scope) */}
          {scope === 'WARD' && (
            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 12px' }}
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              id="dashboard-ward-select"
            >
              {CHENNAI_WARDS.filter(w => w.zoneId === selectedZone).map((w) => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div>
        {/* Score + Stats Card — fixed 180px total row height */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, padding: '20px 24px' }}>
          {/* Score ring — no .card class to avoid its 20px padding bloating the height */}
          <div style={{
            height: 180,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}>
            <ScoreRing score={score} />
          </div>
          {/* 2x2 stat grid — two rows × 84px + 12px gap = 180px total */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '84px 84px', gap: 12 }}>
            {[
              { label: `${scope === 'CITY' ? 'City' : scope === 'ZONE' ? 'Zone' : 'Ward'} Open Issues`, value: open, cls: open > 5 ? 'red' : 'orange', sub: 'need attention' },
              { label: 'Resolved Issues', value: resolved, cls: 'green', sub: 'this period' },
              { label: 'SLA Breaches', value: breaches, cls: breaches > 0 ? 'red' : 'green', sub: '72hr unresolved' },
              { label: 'Citizen Upvotes', value: totalUp, cls: 'blue', sub: 'overall votes' },
            ].map((s) => (
              <div key={s.label} style={{
                height: 84,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '0 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}>
                <div className="stat-label">{s.label}</div>
                <div className={`stat-value ${s.cls}`}>{s.value}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Dashboard Workspace Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 20, padding: '0 24px 24px' }}>
          
          {/* Left Column: Administrative Ratings & Leaderboards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* City-Wide: Zone Rankings Leaderboard */}
            {scope === 'CITY' && (
              <div className="card" style={{ padding: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>🏢 Chennai Zones Performance Rating</div>
                {zoneRankings.map((zone, idx) => {
                  const zoneColor = zone.score >= 70 ? 'var(--sev-low)' : zone.score >= 40 ? 'var(--sev-medium)' : 'var(--sev-critical)';
                  return (
                    <div key={zone.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: idx === zoneRankings.length - 1 ? 'none' : '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 13, width: 20 }}>#{idx + 1}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{zone.id} - {zone.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {zone.total} issue{zone.total !== 1 ? 's' : ''} · {zone.breaches} breach{zone.breaches !== 1 ? 'es' : ''}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ fontSize: 13, color: zoneColor, fontWeight: 700 }}>
                          {zone.score} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>score</span>
                        </div>
                        <button
                          className="btn btn-text"
                          onClick={() => {
                            setScope('ZONE');
                            setSelectedZone(zone.id);
                          }}
                          style={{ padding: '4px 8px', fontSize: 11, border: 'none', background: 'rgba(255,255,255,0.05)', borderRadius: 4, color: 'var(--brand)' }}
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Zone-Wide: Ward Rankings Leaderboard */}
            {scope === 'ZONE' && (
              <div className="card" style={{ padding: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>📍 Wards inside {selectedZone} ({CHENNAI_ZONES.find(z => z.id === selectedZone)?.name})</div>
                {wardRankings.map((ward, idx) => {
                  const wardColor = ward.score >= 70 ? 'var(--sev-low)' : ward.score >= 40 ? 'var(--sev-medium)' : 'var(--sev-critical)';
                  return (
                    <div key={ward.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: idx === wardRankings.length - 1 ? 'none' : '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 13, width: 20 }}>#{idx + 1}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{ward.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {ward.total} issue{ward.total !== 1 ? 's' : ''} · {ward.breaches} breach{ward.breaches !== 1 ? 'es' : ''}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ fontSize: 13, color: wardColor, fontWeight: 700 }}>
                          {ward.score} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>score</span>
                        </div>
                        <button
                          className="btn btn-text"
                          onClick={() => {
                            setScope('WARD');
                            setSelectedWard(ward.id);
                          }}
                          style={{ padding: '4px 8px', fontSize: 11, border: 'none', background: 'rgba(255,255,255,0.05)', borderRadius: 4, color: 'var(--brand)' }}
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  );
                })}
                {wardRankings.length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No issues mapped to wards in this zone yet.
                  </div>
                )}
              </div>
            )}

            {/* Category breakdown (for Ward or custom scopes if categories exist) */}
            {topCategories.length > 0 && (
              <div className="card">
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Top Issue Categories</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topCategories.map(([cat, count]) => {
                    const maxCount = topCategories[0][1];
                    const pct = (count / maxCount) * 100;
                    return (
                      <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 160, fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{cat}</div>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, width: 24, textAlign: 'right' }}>{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Metrics */}
            {reports.length > 0 && (() => {
              const total = reports.length;
              const avgSev = (reports.reduce((s, r) => s + (r.severity || 0), 0) / total).toFixed(1);
              const resRate = Math.round((reports.filter(r => r.status === 'RESOLVED').length / total) * 100);
              const avgUp  = (reports.reduce((s, r) => s + (r.upvotes || 0), 0) / total).toFixed(1);
              return (
                <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Quick Metrics</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {[
                      { value: avgSev,      label: 'Avg Severity', color: 'var(--sev-medium)' },
                      { value: `${resRate}%`, label: 'Resolved',     color: 'var(--sev-low)'    },
                      { value: avgUp,       label: 'Avg Upvotes',  color: 'var(--brand)'       },
                    ].map(m => (
                      <div key={m.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* No reports state */}
            {reports.length === 0 && (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon">🏆</div>
                <div className="empty-state-title">No issues tracked in this scope</div>
                <div className="empty-state-sub">Everything is fully clean or needs seeding!</div>
              </div>
            )}
          </div>

          {/* Right Column: AI Insights, Citizen Gamification & SLA Alerts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* AI Predictive Insights Card */}
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                🔮 AI Predictive Insights
              </div>
              <div>
                {(() => {
                  const waterlogging = reports.filter(r => r.category === 'Waterlogging' && r.status !== 'RESOLVED');
                  const garbage = reports.filter(r => r.category === 'Garbage Dumping' && r.status !== 'RESOLVED');
                  const streetlights = reports.filter(r => r.category === 'Broken Streetlight' && r.status !== 'RESOLVED');

                  const insights = [];
                  if (waterlogging.length >= 2) {
                    insights.push({
                      cls: 'insight-critical',
                      title: '🌧️ Severe Drainage Overload Risk',
                      desc: `${waterlogging.length} active waterlogging spots detected. High probability of localized flooding on major thoroughfares during next rainfall.`
                    });
                  } else {
                    insights.push({
                      cls: 'insight-low',
                      title: '✅ Stormwater Drainage: Stable',
                      desc: 'No significant waterlogging clusters. Drainage lines show normal throughput capacity.'
                    });
                  }

                  if (garbage.length >= 2) {
                    insights.push({
                      cls: 'insight-warning',
                      title: '🦟 Waste Accumulation Vector Hazard',
                      desc: `Multiple garbage dumping hotspots detected. Vector breeding risk increases if unaddressed in 48h.`
                    });
                  }

                  if (streetlights.length >= 2) {
                    insights.push({
                      cls: 'insight-info',
                      title: '💡 Street Lighting Grid Degradation',
                      desc: ' streetlight outages clustered in close proximity suggest cable wear or circuit breaker faults.'
                    });
                  }

                  return insights.map((ins, i) => (
                    <div className={`insight-item ${ins.cls}`} key={i}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{ins.title}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>{ins.desc}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Community Heroes Gamification Leaderboard */}
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                🏆 Community Heroes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {localHeroes.map((hero, idx) => (
                  <div key={hero.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <div style={{ fontSize: 18 }}>{hero.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hero.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--brand)' }}>{hero.badge}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>
                      {hero.points} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>karma</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shame Wall */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                😤 Shame Wall
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>— breaches</span>
              </div>
              <ShameWall reports={reports} />
            </div>

            {/* Score formula */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Accountability Rating Formula</div>
              <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, wordBreak: 'break-all', lineHeight: 1.8, color: 'var(--text-primary)' }}>
                Score = 100 − (open × 2) − (breaches × 5) − (avgResolutionDays × 3)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Higher scores denote highly responsive municipal action.
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
