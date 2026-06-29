# 🏙️ CivicPulse — Hyperlocal Civic Intelligence & AI Accountability Platform

[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Hosting%20%7C%20Firestore-FFCA28?style=flat&logo=firebase)](https://firebase.google.com/)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-2.0%20Flash-4285F4?style=flat&logo=google)](https://ai.google.dev/)
[![Google Maps](https://img.shields.io/badge/Google%20Maps-API-4285F4?style=flat&logo=googlemaps)](https://developers.google.com/maps)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat&logo=vite)](https://vitejs.dev/)

> **Vibe2Ship Hackathon Submission**
> **Problem Statement 2:** Community Hero — Hyperlocal Problem Solver
> **Live Demo:** [civicpulse-93910.web.app](https://civicpulse-93910.web.app)

---

## 📌 Project Overview
**CivicPulse** is a real-time civic issue reporting and AI-driven accountability platform for Chennai, India. It empowers citizens to identify, report, and track hyperlocal infrastructure issues (such as potholes, waterlogging, damaged streetlights, and garbage dumping) while using autonomous AI agents to ensure transparency, monitor Service Level Agreements (SLAs), generate formal RTI escalations, and verify resolutions.

---

## ✨ Key Features

### 📸 Smart Issue Reporting (Powered by Gemini Vision)
*   **Zero-Form Overhead**: Citizens upload a photo of the issue.
*   **AI Auto-Categorization**: Gemini Vision parses the image to determine the category, severity (1–10 scale), and a precise structural description.
*   **Geospatial Tracking**: Captures live coordinate data to pin issues precisely.

### 🗺️ Live Geospatial Map
*   **Interactive Visualization**: A dark-mode Google Maps view plotting active issues.
*   **Zone & Ward Filtering**: Drill down through Chennai's 15 administrative zones and 200 wards.
*   **Status Color Coding**: Visual markers showing issue lifecycle stages (Open, In Progress, Resolved, Critical, SLA Breached).

### 🤖 Autonomous AI Agent (Swarm & Accountability Layer)
*   **SLA Monitor**: Automatically flags issues that exceed the 72-hour resolution SLA threshold as "Breached".
*   **Swarm Escalation**: Upvoting triggers community escalation. If an issue gets 3+ upvotes, the AI automatically raises its severity to `CRITICAL`.
*   **RTI Generator**: Automatically drafts a formal, legally structured Right to Information (RTI) complaint letter addressed to the Zonal Officer of the Greater Chennai Corporation (GCC).
*   **Resolution Verifier**: When a worker uploads a resolution photo, Gemini compares it against the original report photo to verify if the issue has actually been fixed before resolving it.

### 📊 GCC Performance Dashboard
*   **Accountability Scoring**: Automatically computes a dynamic letter grade (A–F) for Chennai's zones and wards using a mathematical formula:
    $$\text{Score} = 100 - (\text{Open} \times 2) - (\text{Breaches} \times 5) - (\text{Avg Resolution Days} \times 3)$$
*   **Shame Wall**: Highlights chronic, unaddressed SLA breaches to drive administrative accountability.
*   **AI Predictive Insights**: Real-time warnings (e.g. vector risk indicators for open garbage dumping, drainage overload patterns).
*   **Quick Metrics**: Key KPIs showing average severity, resolution rate, and community engagement.

---

## 🛠️ Google Technologies Utilized

1.  **Google Gemini 2.0 Flash**: Powers image classification, severity assessment, RTI drafting, and automated resolution verification.
2.  **Google Maps JavaScript API**: Renders the live interactive mapping interface with custom styles and geolocating.
3.  **Firebase Firestore**: Real-time database synchronizing issues, agent logs, and leaderboards across all users instantly.
4.  **Firebase Authentication**: Secure user sign-in via Google OAuth.
5.  **Firebase Hosting**: Scalable production deployment on Google Cloud infrastructure.

---

## 💻 Tech Stack
*   **Frontend**: React 19, React Router, Vite 8, Lucide React Icons
*   **Backend & DB**: Firebase (Auth, Firestore, Storage)
*   **AI Service**: Gemini API (`@google/generative-ai`)
*   **Styling**: Vanilla CSS (Custom Design System with dark mode glassmorphism)

---

## 🚀 Local Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/M-Nikhita/CivilPulse.git
cd CivilPulse
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
```
