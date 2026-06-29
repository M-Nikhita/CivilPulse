# 🏙️ CivicPulse — Hyperlocal Civic Intelligence & AI Accountability Platform

[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Hosting%20%7C%20Firestore-FFCA28?style=flat&logo=firebase)](https://firebase.google.com/)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-2.0%20Flash-4285F4?style=flat&logo=google)](https://ai.google.dev/)
[![Google Maps](https://img.shields.io/badge/Google%20Maps-API-4285F4?style=flat&logo=googlemaps)](https://developers.google.com/maps)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat&logo=vite)](https://vitejs.dev/)

> **Vibe2Ship Hackathon Submission**
> **Problem Statement 2:** Community Hero — Hyperlocal Problem Solver
> 
> **Live Demo:** [civicpulse-93910.web.app](https://civicpulse-93910.web.app)

---

A lightweight civic intelligence dashboard, reporting engine, and autonomous accountability platform for municipal issues in Chennai. Report issues with a photo, let an autonomous Gemini AI agent analyze, categorize, track SLA status, and write formal RTI complaint letters, and monitor zone/ward performance in real-time.

Think of it as a modernized, AI-augmented municipal grievance system — built to demonstrate end-to-end civic accountability and automated verification instead of manual triage and static reports.

## Features

- **Gemini Vision Triage** — Upload a photo of any civic issue (e.g. pothole, broken light) and the AI automatically determines the category, details, severity (1–10), and priority.
- **Geospatial Mapping** — Real-time interactive Google Map displaying color-coded issues with filters for Chennai's 15 administrative zones and 200 wards.
- **🛠️ Admin Control Panel** — Appending `?admin=true` to the Agent Log URL (i.e. `/agent?admin=true`) unlocks active admin commands: seeding mock reports (50–500 issues), running agent sweeps on-demand, resetting/wiping the Firestore database, and exiting back to the citizen view via the "Exit Admin" button.
- **Autonomous AI Agent** — Monitors SLAs (flags breaches after 72 hrs), auto-escalates community swarms (3+ upvotes), drafts legally formatted Right to Information (RTI) complaint letters, and verifies resolution photos before closing issues.
- **Dynamic Performance Dashboard** — Computes dynamic accountability letter grades (A–F) for each zone/ward based on open issues, breaches, and resolution times.
- **Shame Wall** — Highlights chronic, unaddressed SLA breaches to drive administrative accountability.
- **Community Gamification** — Encourages civic participation through upvotes, comments, karma points, and a community hero leaderboard.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vanilla CSS, Vite 8, Lucide React Icons |
| Database | Firebase Firestore (Real-time synchronization) |
| Authentication | Firebase Auth (Google OAuth) |
| AI Services | Google Gemini 2.0 Flash API (Vision & Text generation) |
| Maps & Geo | Google Maps JavaScript API |
| Hosting | Firebase Hosting (Google Cloud infrastructure) |

## Project Structure

```
.
├── firebase.json                   # Firebase deployment configuration
├── .firebaserc                     # Firebase project mapping
├── civicpulse/
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example                # Sample environment variables config
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   └── src/
│       ├── main.jsx                # Entry point
│       ├── App.jsx                 # Routing and shell configuration
│       ├── App.css
│       ├── index.css               # Global styles & design system tokens
│       ├── components/
│       │   ├── Agent/              # AI Agent console & monitoring panel
│       │   ├── Auth/               # Google login page
│       │   ├── Dashboard/          # Ward ratings, Shame Wall, and charts
│       │   ├── Feed/               # Live issue feed and detail modal
│       │   ├── Layout/             # App shell navigation
│       │   ├── Map/                # Google Maps view
│       │   └── Report/             # Photo-based report wizard
│       ├── context/
│       │   └── AuthContext.jsx     # Firebase Auth context with Popups
│       ├── firebase/
│       │   ├── config.js           # Firebase app initialization
│       │   └── firestore.js        # Firestore CRUD queries and listeners
│       ├── services/
│       │   └── gemini.js           # Gemini API wrappers (Vision & Text prompts)
│       └── utils/
│           └── chennaiData.js      # Chennai structural zones and wards database
```

## Architecture

```
LoginPage (Google Auth) → AppShell (Navigation)
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
  MapView.jsx            IssueFeed.jsx       Dashboard.jsx
(Google Maps API)       (Upvotes/Comments)  (Grades & Shame Wall)
       │                     │                     │
       └──────────┬──────────┴─────────────────────┘
                  ▼
         Firebase Firestore (Real-time Sync)
                  ▲
                  │  (Image Analysis / RTI Generation)
         Google Gemini 2.0 API
```

The React frontend establishes a real-time connection to Firebase Firestore. When a citizen submits an issue with an image, the client prompts Google Gemini 2.0 Flash to extract structural features, classify the category, and assign a severity score. An background polling loop (or client-side simulation) runs the autonomous agent logic: tracking SLAs, flagging breaches, drafting RTI letters for breached reports, and writing actions back to the Firestore database which instantly syncs to all active dashboard views.

## Prerequisites

- **Node.js** (v18.x or higher)
- **npm** (v9.x or higher)
- **Google Cloud Platform Project** with:
  - Google Maps JavaScript API enabled
  - Google Gemini API Key (Google AI Studio)
- **Firebase Project** with:
  - Firestore Database enabled
  - Google Provider enabled in Firebase Auth

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/M-Nikhita/CivilPulse.git
cd CivilPulse/civicpulse
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the `civicpulse/` directory:

```env
# Gemini API Key -> https://aistudio.google.com/app/apikey
VITE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# Google Maps API Key -> https://console.cloud.google.com/apis/credentials
VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY

# Firebase Configuration
VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
```

### 4. Run the development server

```bash
npm run dev
```

The application will start locally on **`http://localhost:5173`**.

### 5. Build and Deploy (Firebase Hosting)

Deploy the build directly to Google Cloud's Firebase Hosting CDN:

```bash
# Build production assets
npm run build

# Deploy to Hosting (run from the repository root containing firebase.json)
cd ..
firebase deploy --only hosting
```

## Using the Application

1. Open the live site (or `http://localhost:5173`) and sign in using your Google Account.
2. Visit the **Live Map** to explore existing pins or filter by Chennai Zone/Ward.
3. Click **Report Issue**, upload an image (e.g. damaged street road or water logging), and watch the Gemini AI instantly classify it and fill in the details.
4. Go to **Issue Feed** to view active complaints, upvote important ones to trigger AI agent priority escalation, or write comments.
5. Open the **Performance Dashboard** to monitor GCC performance grades, SLA breach statistics on the Shame Wall, and real-time AI safety suggestions.
6. Open the **AI Agent Log** to inspect autonomous agent actions like RTI letters drafted, SLA breaches caught, and swarms managed.

## Firestore Schema Reference

### `reports` Collection
Stores reported community issues:
```typescript
interface Report {
  id?: string;
  title: string;
  description: string;
  category: "Waterlogging" | "Open Drain / Sewer" | "Broken Streetlight" | "Garbage Dumping" | "Road / Pothole" | "Other";
  severity: number;              // 1 to 10 scale
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CRITICAL";
  latitude: number;
  longitude: number;
  imageUrl: string;
  upvotes: number;
  upvotedBy: string[];           // User IDs list
  comments: Comment[];
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
  zone: string;                  // Chennai Zone Name (e.g. Zone 13 - Adyar)
  ward: string;                  // Chennai Ward Name (e.g. Ward 172)
  reporterName: string;
  reporterId: string;
  slaDeadline: Timestamp;        // createdAt + 72 hours
  slaStatus: "OK" | "BREACHED";
  rtiLetter?: string;            // Auto-drafted RTI letter on breach
}
```

### `agent_logs` Collection
Tracks autonomous agent actions:
```typescript
interface AgentLog {
  id?: string;
  timestamp: Timestamp;
  actionType: "SLA_MONITOR" | "SWARM_ESCALATION" | "RTI_GENERATOR" | "RESOLUTION_VERIFICATION";
  reportId: string;
  message: string;
  details?: string;
}
```

## Roadmap

- **Automatic Official Delivery** — Send auto-generated RTI and complaint emails directly to public grievance portals via official API endpoints.
- **Worker App Companion** — Separate dashboard for GCC field engineers to mark issues "In Progress", upload resolution photos, and receive directions.
- **SLA Penalty Automation** — Link smart contracts or micro-incentives to refund reporting users or penalize slow resolution times.
- **Predictive Infrastructure Budgets** — AI budget projection based on ward issue frequency, severity, and historic fix costs.

## License

This project is licensed under the [MIT License](LICENSE).
