// Firestore operations for CivicPulse
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  GeoPoint,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { CHENNAI_WARDS } from '../utils/chennaiData';

// ─── Collections ────────────────────────────────────────────────────────────
const REPORTS_COL = 'reports';
const WARDS_COL = 'wards';

// ─── Issue Status ────────────────────────────────────────────────────────────
export const STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CRITICAL: 'CRITICAL',
  SLA_BREACH: 'SLA_BREACH',
};

// ─── Submit a new report ─────────────────────────────────────────────────────
export async function submitReport({ userId, userEmail, userName, imageUrl, lat, lng, geminiResult, ward }) {
  const reportData = {
    userId,
    userEmail,
    userName,
    imageUrl,
    location: new GeoPoint(lat, lng),
    lat,
    lng,
    ward: ward || 'Ward 1',
    city: 'Chennai',
    category: geminiResult.category,
    severity: geminiResult.severity,
    title: geminiResult.title,
    description: geminiResult.description,
    urgency: geminiResult.urgency,
    status: geminiResult.severity >= 8 ? STATUS.CRITICAL : STATUS.OPEN,
    upvotes: 0,
    upvotedBy: [],
    reportCount: 1,
    mergedReportIds: [],
    complaintLetter: null,
    resolvedAt: null,
    resolutionImageUrl: null,
    slaBreached: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, REPORTS_COL), reportData);
  return docRef.id;
}

// ─── Real-time listener for all reports ─────────────────────────────────────
export function subscribeToReports(callback) {
  const q = query(
    collection(db, REPORTS_COL),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(reports);
  });
}

// ─── Real-time listener for ward reports ─────────────────────────────────────
export function subscribeToWardReports(ward, callback) {
  const q = query(
    collection(db, REPORTS_COL),
    where('ward', '==', ward)
  );
  return onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(reports);
  });
}

// ─── Upvote a report ─────────────────────────────────────────────────────────
export async function upvoteReport(reportId, userId) {
  const ref = doc(db, REPORTS_COL, reportId);
  await updateDoc(ref, {
    upvotes: increment(1),
    upvotedBy: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
}

export async function removeUpvote(reportId, userId) {
  const ref = doc(db, REPORTS_COL, reportId);
  await updateDoc(ref, {
    upvotes: increment(-1),
    upvotedBy: arrayRemove(userId),
    updatedAt: serverTimestamp(),
  });
}

// ─── Escalate to CRITICAL with complaint letter ───────────────────────────────
export async function escalateReport(reportId, complaintLetter) {
  const ref = doc(db, REPORTS_COL, reportId);
  await updateDoc(ref, {
    status: STATUS.CRITICAL,
    complaintLetter,
    escalatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ─── Mark SLA breach ─────────────────────────────────────────────────────────
export async function markSLABreach(reportId) {
  const ref = doc(db, REPORTS_COL, reportId);
  await updateDoc(ref, {
    status: STATUS.SLA_BREACH,
    slaBreached: true,
    slaBreachedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ─── Resolve a report ────────────────────────────────────────────────────────
export async function resolveReport(reportId, resolutionImageUrl) {
  const ref = doc(db, REPORTS_COL, reportId);
  await updateDoc(ref, {
    status: STATUS.RESOLVED,
    resolutionImageUrl,
    resolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ─── Compute ward accountability score ───────────────────────────────────────
export function computeAccountabilityScore(reports) {
  if (!reports.length) return 100;

  const now = Date.now();
  const openReports = reports.filter((r) => r.status === STATUS.OPEN || r.status === STATUS.CRITICAL);
  const slaBreaches = reports.filter((r) => r.slaBreached);
  const resolvedReports = reports.filter((r) => r.status === STATUS.RESOLVED);

  // Average resolution days
  let avgDays = 0;
  if (resolvedReports.length) {
    const totalDays = resolvedReports.reduce((sum, r) => {
      const created = r.createdAt?.seconds * 1000 || now;
      const resolved = r.resolvedAt?.seconds * 1000 || now;
      return sum + (resolved - created) / (1000 * 60 * 60 * 24);
    }, 0);
    avgDays = totalDays / resolvedReports.length;
  }

  const score = Math.max(
    0,
    Math.round(100 - openReports.length * 2 - slaBreaches.length * 5 - avgDays * 3)
  );
  return score;
}

// ─── Check SLA breaches (72 hrs) ─────────────────────────────────────────────
export async function checkAndMarkSLABreaches() {
  const cutoff = Date.now() - 72 * 60 * 60 * 1000; // 72 hours ago
  const q = query(
    collection(db, REPORTS_COL),
    where('status', 'in', [STATUS.OPEN, STATUS.IN_PROGRESS]),
    where('slaBreached', '==', false)
  );

  const snapshot = await getDocs(q);
  const promises = [];

  snapshot.docs.forEach((d) => {
    const data = d.data();
    const createdMs = data.createdAt?.seconds * 1000 || 0;
    if (createdMs < cutoff) {
      promises.push(markSLABreach(d.id));
    }
  });

  await Promise.all(promises);
  return promises.length; // number of breaches marked
}

// ─── Get all reports (one-time) ───────────────────────────────────────────────
export async function getAllReports() {
  const snapshot = await getDocs(collection(db, REPORTS_COL));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Seed mock Chennai reports ────────────────────────────────────────────────
export async function seedMockReports(userId, userEmail, userName, count = 150, existingReports = []) {
  // 1. Use the pre-loaded reports to check for duplicates (bypasses network fetch)
  const existingTitles = new Set(existingReports.map((r) => r.title));

  // 2. Procedural generator configuration
  const categories = [
    { name: 'Pothole', templates: [
      { title: 'Deep pothole on {street}', desc: 'Dangerous pothole nearly 30cm deep causing vehicles to swerve near {landmark}. Needs immediate repair.' },
      { title: 'Road cave-in near {street}', desc: 'Surface collapsing due to underlying pipeline leak near {landmark}. Heavy vehicle risk.' },
      { title: 'Series of potholes on {street}', desc: 'Multiple potholes causing severe traffic jams during peak hours near {landmark}.' }
    ]},
    { name: 'Waterlogging', templates: [
      { title: 'Severe flooding at {street}', desc: 'Rainwater stagnating 2 feet deep near {landmark}, blocking traffic and pedestrians.' },
      { title: 'Waterlogging under {street} bridge', desc: 'Blocked storm drains causing flooding under the passage near {landmark}.' },
      { title: 'Drain overflow at {street}', desc: 'Sewage drain overflowing onto the road surface near {landmark}. Bad odor.' }
    ]},
    { name: 'Garbage Dumping', templates: [
      { title: 'Illegal waste pile on {street}', desc: 'Uncollected plastic and organic waste piling up near {landmark}, attracting pests.' },
      { title: 'Overflowing dustbin at {street}', desc: 'Municipal bin overflowing for 4 days near {landmark}. Foul smell spreading.' },
      { title: 'Debris dumped on sidewalk at {street}', desc: 'Construction debris blocking pedestrian pathway near {landmark}, forcing walking on road.' }
    ]},
    { name: 'Broken Streetlight', templates: [
      { title: 'Streetlights out on {street}', desc: 'Consecutive streetlights non-functional, causing safety risk at night near {landmark}.' },
      { title: 'Damaged light pole at {street}', desc: 'Electric pole leaning dangerously near {landmark} after a vehicle collision.' }
    ]},
    { name: 'Open Drain / Sewer', templates: [
      { title: 'Open manhole on {street}', desc: 'Uncovered sewer manhole posing critical hazard to pedestrians and motorists near {landmark}.' },
      { title: 'Broken drain slab near {street}', desc: 'Concrete cover of storm drain broken near {landmark}, creating a foot trap.' }
    ]}
  ];

  const locations = [
    { name: 'Anna Salai', lat: 13.0674, lng: 80.2376, ward: 'Ward 108 - Gemini / Anna Salai', landmarks: ['Gemini Flyover', 'Spencer Plaza', 'Thousand Lights'] },
    { name: 'Adyar', lat: 13.0418, lng: 80.2341, ward: 'Ward 173 - Adyar', landmarks: ['Adyar Depot', 'Kasturba Nagar', 'Malar Hospital'] },
    { name: 'T Nagar', lat: 13.0524, lng: 80.2137, ward: 'Ward 130 - T Nagar', landmarks: ['Panagal Park', 'Pondy Bazaar', 'Ranganathan Street'] },
    { name: 'Mylapore', lat: 13.0424, lng: 80.2684, ward: 'Ward 160 - Mylapore', landmarks: ['Kapaleeshwarar Temple', 'Luz Corner', 'Mylapore Station'] },
    { name: 'Velachery', lat: 12.9815, lng: 80.2206, ward: 'Ward 196 - Velachery Lake', landmarks: ['Phoenix Marketcity', 'Velachery Bypass', 'Grand Mall'] },
    { name: 'Nungambakkam', lat: 13.0602, lng: 80.2411, ward: 'Ward 108 - Gemini / Anna Salai', landmarks: ['College Road', 'Valluvar Kottam', 'Nungambakkam High Road'] },
    { name: 'Koyambedu', lat: 13.0732, lng: 80.1912, ward: 'Ward 130 - T Nagar', landmarks: ['Koyambedu Terminus', 'Omni Bus Stand', 'Vegetable Market'] },
    { name: 'Perambur', lat: 13.0878, lng: 80.2785, ward: 'Ward 50 - Perambur', landmarks: ['Perambur Flyover', 'Railway Carriage Works', 'Jamalia'] },
    { name: 'Tondiarpet', lat: 13.1067, lng: 80.2946, ward: 'Ward 30 - Tondiarpet', landmarks: ['Apollo Hospital', 'Tondiarpet Station', 'TH Road'] },
    { name: 'Madhavaram', lat: 13.1312, lng: 80.2862, ward: 'Ward 18 - Madhavaram Junction', landmarks: ['Milk Colony', 'RTO Office', 'Retteri Junction'] },
    { name: 'Guindy', lat: 13.0067, lng: 80.2206, ward: 'Ward 173 - Adyar', landmarks: ['Guindy Kathipara', 'Ekkattuthangal Metro', 'Olympia Tech Park'] },
    { name: 'Taramani', lat: 12.9862, lng: 80.2433, ward: 'Ward 182 - Velachery', landmarks: ['Tidel Park', 'Ascendas IT Park', 'Taramani Link Road'] }
  ];

  // 3. Generate requested unique issues
  const mockReports = [];

  for (let i = 0; i < count; i++) {
    const loc = locations[i % locations.length];
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const template = cat.templates[Math.floor(Math.random() * cat.templates.length)];
    const landmark = loc.landmarks[Math.floor(Math.random() * loc.landmarks.length)];

    // Apply random dispersion (up to 1.5km spread around neighborhood center)
    const latOffset = (Math.random() - 0.5) * 0.015;
    const lngOffset = (Math.random() - 0.5) * 0.015;
    const lat = loc.lat + latOffset;
    const lng = loc.lng + lngOffset;

    // Generate unique code so titles never clash
    const ticketCode = `CP-${Math.floor(1000 + Math.random() * 9000)}`;
    const title = `${template.title.replace('{street}', loc.name).replace('{landmark}', landmark)} [${ticketCode}]`;
    
    const desc = template.desc.replace('{street}', loc.name).replace('{landmark}', landmark);
    // 80% chance of minor/moderate severity, 25% chance of high/critical severity
    const severity = Math.random() < 0.75
      ? Math.floor(Math.random() * 4) + 3 // 3, 4, 5, 6 severity
      : Math.floor(Math.random() * 4) + 7; // 7, 8, 9, 10 severity

    // 85% chance of low upvotes (0-2), 15% chance of high upvotes (3-15) which triggers Swarm Escalation
    const upvotes = Math.random() < 0.85
      ? Math.floor(Math.random() * 3) // 0, 1, 2 upvotes
      : Math.floor(Math.random() * 13) + 3; // 3 to 15 upvotes

    // 80% chance of fresh issue (0-2 days old, no breach), 20% chance of old issue (3-10 days, SLA breached)
    const ageDays = Math.random() < 0.8
      ? Math.floor(Math.random() * 3) // 0, 1, 2 days old
      : Math.floor(Math.random() * 8) + 3; // 3 to 10 days old

    // Assign a truly random ward from our list of 200 wards
    const randomWard = CHENNAI_WARDS[Math.floor(Math.random() * CHENNAI_WARDS.length)].id;

    mockReports.push({
      lat,
      lng,
      category: cat.name,
      severity,
      title,
      description: desc,
      ward: randomWard,
      urgency: severity >= 8 ? 'CRITICAL' : severity >= 6 ? 'HIGH' : severity >= 4 ? 'MEDIUM' : 'LOW',
      upvotes,
      ageDays
    });
  }

  // 4. Filter out issues already present in the database
  const newMockReports = mockReports.filter((r) => !existingTitles.has(r.title));

  if (newMockReports.length === 0) {
    return 0;
  }

  // 5. Submit issues in a single unified Write Batch for maximum speed (~200ms)
  const batch = writeBatch(db);
  
  newMockReports.forEach((r) => {
    const timestampMs = Date.now() - r.ageDays * 24 * 60 * 60 * 1000;
    const createdAt = Timestamp.fromMillis(timestampMs);
    
    // Create a new document reference with an auto-generated ID
    const docRef = doc(collection(db, REPORTS_COL));
    
    batch.set(docRef, {
      userId,
      userEmail,
      userName,
      imageUrl: null,
      location: new GeoPoint(r.lat, r.lng),
      lat: r.lat,
      lng: r.lng,
      city: 'Chennai',
      category: r.category,
      severity: r.severity,
      title: r.title,
      description: r.description,
      ward: r.ward,
      urgency: r.urgency,
      status: r.urgency === 'CRITICAL' ? STATUS.CRITICAL : STATUS.OPEN,
      reportCount: Math.floor(Math.random() * 3) + 1,
      upvotes: r.upvotes,
      upvotedBy: [],
      mergedReportIds: [],
      complaintLetter: null,
      resolvedAt: null,
      resolutionImageUrl: null,
      slaBreached: r.ageDays >= 3, // SLA breached if older than 72 hours
      createdAt,
      updatedAt: createdAt,
    });
  });

  await batch.commit();
  return newMockReports.length;
}

/**
 * Wipes all reports from the database for clean demo resets
 */
export async function clearAllReports() {
  const snapshot = await getDocs(collection(db, REPORTS_COL));
  const batch = writeBatch(db);
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}
