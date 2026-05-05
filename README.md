# CSE Event Management System

A comprehensive full-stack solution for managing departmental events, student registrations, On-Duty (OD) requests, and IQAC documentation. Built specifically for the Computer Science & Engineering Department at Sri Eshwar College of Engineering.

## 🚀 Recent Feature Updates

- **Concurrent Department Approvals**: New workflow involving HR, Audio, ICTS, Transport, and Hostel Wardens for requisition approval.
- **IQAC Final Review**: Events now require final IQAC approval before being posted to students.
- **Approval Timeline Visualization**: Real-time tracking of the approval progress for organizers and faculty.
- **Faculty Organizer Role**: Faculty members can now create events directly, bypassing initial faculty-level approval.

## 🛠 Tech Stack

- **Frontend**: React 19, Vite 7, TailwindCSS v4, Framer Motion, Lucide React.
- **Backend**: Node.js v22, Express v5.
- **Database**: Firebase Firestore (Real-time).
- **Authentication**: Unified portal for Staff (Hardcoded/Firebase) and Students (Firestore).

## 📂 Project Structure

- `/frontend`: React application (Vite-powered).
- `/backend`: Node.js Express API.
- `PROJECT_DOCUMENTATION.md`: Exhaustive technical and design documentation.

## 🚦 Getting Started

### 1. Prerequisites
- Node.js (v20+)
- Firebase Project setup

### 2. Backend Setup
```bash
cd backend
npm install
npm start
```
Server runs on `http://localhost:5000` (or `5001`).

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Application runs on `http://localhost:5173`.

## 📖 Documentation
For the full system architecture, user roles, API reference, and design system, please refer to [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md).

---
© 2026 CSE Department, SECE