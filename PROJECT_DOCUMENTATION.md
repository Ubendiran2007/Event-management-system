# CSE Department Event Management System — Full Project Documentation

> **For:** UI/UX Design Reference  
> **Institution:** Sri Eshwar College of Engineering  
> **Department:** Computer Science & Engineering  
> **Date:** March 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Authentication Flow](#5-authentication-flow)
6. [Pages & Screens](#6-pages--screens)
   - 6.1 Landing Page
   - 6.2 Login Page
   - 6.3 Dashboard
   - 6.4 Create Event
   - 6.5 Explore Events
   - 6.6 IQAC Submission
   - 6.7 Manage Students
7. [Components](#7-components)
8. [Data Models](#8-data-models)
9. [Event Lifecycle (Status Flow)](#9-event-lifecycle-status-flow)
10. [OD Request Lifecycle](#10-od-request-lifecycle)
11. [IQAC Submission Flow](#11-iqac-submission-flow)
12. [Feedback Flow](#12-feedback-flow)
13. [API Reference](#13-api-reference)
14. [Firestore Database Structure](#14-firestore-database-structure)
15. [UI Design System](#15-ui-design-system)
16. [Routing Map](#16-routing-map)
17. [Validation Rules](#17-validation-rules)
18. [Real-Time Data](#18-real-time-data)
19. [Role-Based View Summary (Per Screen)](#19-role-based-view-summary-per-screen)

---

## 1. Project Overview

The **CSE Event Management System** is a full-stack web portal for the Computer Science Department at Sri Eshwar College of Engineering. It digitalises the complete lifecycle of department events — from proposal creation, multi-level institutional approval, student registration with On-Duty (OD) requests, post-event feedback, to final IQAC documentation.

### Core Problems Solved

| Problem | Solution |
|---|---|
| Paper-based event approvals | Digital multi-level approval chain (Faculty → HOD → Principal) |
| Manual OD letter process | Online OD request with organizer + staff approval |
| Post-event documentation scattered | Structured IQAC submission form with deadline enforcement |
| No central event discovery for students | Public Explore Events page with registration |
| No feedback collection system | In-app star rating + comment feedback per event |
| Manual organizer privilege management | Staff-controlled role assignment per student |

---

## 2. Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 7 |
| Routing | React Router DOM v7 |
| Styling | TailwindCSS v4 (utility-first) |
| Animations | Framer Motion v12 |
| Icons | Lucide React v0.575 |
| State Management | React Context API (`AppContext`) |
| Real-time DB | Firebase Firestore (client SDK v12) |
| Fonts | Inter (body), JetBrains Mono (code) |

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js v22 |
| Framework | Express v5 |
| Database | Firebase Firestore (via Firebase Admin SDK) |
| Environment | dotenv |
| Dev server | nodemon |

### Infrastructure
| | |
|---|---|
| Frontend dev server | `http://localhost:5173` |
| Backend API server | `http://localhost:5000` |
| Database | Google Firebase Firestore (NoSQL) |

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────┐
│                    FRONTEND (React)                    │
│                                                        │
│  pages/          components/       context/            │
│  ├─ Landing      ├─ Navbar         └─ AppContext       │
│  ├─ Login        ├─ EventDetailModal                   │
│  ├─ Dashboard    ├─ ODRequestDetailModal               │
│  ├─ CreateEvent  ├─ FeedbackModal                      │
│  ├─ ExploreEvents├─ StatusBadge                        │
│  ├─ IQACSubmission                                     │
│  └─ ManageStudents                                     │
│                                                        │
│  services/firebaseService.js   ←── Real-time listeners │
│  (onSnapshot subscriptions to Firestore directly)      │
└──────────────┬──────────────────────────┬─────────────┘
               │ REST API calls           │ Firestore SDK
               ▼                          ▼
┌──────────────────────┐     ┌────────────────────────┐
│   BACKEND (Express)   │     │   Firebase Firestore    │
│                       │     │                        │
│  routes/              │     │  collections:          │
│  ├─ auth.js           │◄────│  ├─ events             │
│  ├─ events.js         │     │  ├─ odRequests         │
│  ├─ odRequests.js     │     │  ├─ users              │
│  ├─ iqac.js           │     │  └─ students/          │
│  ├─ students.js       │     │       ├─ CSE-B/members │
│  ├─ dashboard.js      │     │       └─ CSE-D/members │
│  └─ explore.js        │     └────────────────────────┘
└──────────────────────┘
```

> **Note:** Real-time Firestore listeners in `firebaseService.js` (via `onSnapshot`) update React state live when any document changes, bypassing the backend REST layer for read operations. The backend is primarily used for authenticated operations and complex queries.

---

## 4. User Roles & Permissions

### Role Hierarchy

```
PRINCIPAL
    └── HOD
         └── FACULTY
              ├── STUDENT_ORGANIZER  (approved by faculty)
              └── STUDENT_GENERAL
```

### Role Capabilities Matrix

| Capability | STUDENT_GENERAL | STUDENT_ORGANIZER | FACULTY | HOD | PRINCIPAL |
|---|:---:|:---:|:---:|:---:|:---:|
| View landing page | ✓ | ✓ | ✓ | ✓ | ✓ |
| Login | ✓ | ✓ | ✓ | ✓ | ✓ |
| View Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Explore events | ✓ | ✓ | ✓ | ✓ | ✓ |
| Register for event (OD request) | ✓ | ✓ | — | — | — |
| Withdraw OD request | ✓ | ✓ | — | — | — |
| Submit event feedback | ✓ | ✓ | — | — | — |
| Create event proposal | — | ✓ (if approved) | — | — | — |
| Approve incoming OD registrations | — | ✓ | — | — | — |
| Submit IQAC report | — | ✓ | — | — | — |
| Approve/reject events (Faculty queue) | — | — | ✓ | — | — |
| Approve/reject events (HOD queue) | — | — | — | ✓ | — |
| Approve/reject events (Principal queue) | — | — | — | — | ✓ |
| Mark event as COMPLETED | — | — | ✓ | ✓ | ✓ |
| Manage students (grant/revoke organizer) | — | — | ✓ | ✓ | ✓ |
| View organizer requests sidebar | — | — | ✓ | — | — |

### Staff Login Credentials (Hardcoded)
| Role | Username | Password |
|---|---|---|
| Faculty | `faculty` | `faculty` |
| HOD | `hod` | `hod` |
| Principal | `principal` | `principal` |

### Student Login
- **Username:** student's email address (or username field)
- **Password:** student's roll number (case-insensitive)
- Students are stored in Firestore: `students/{className}/members/{studentId}`
- Supported classes: `CSE-B`, `CSE-D`

---

## 5. Authentication Flow

```
User enters credentials
        │
        ▼
Is it a staff username? (faculty/hod/principal)
        │
   YES ─┼──► Match against hardcoded STAFF_CREDENTIALS
        │         └─→ Success: save to localStorage, set in AppContext, navigate to /dashboard
        │
   NO ──┼──► POST /api/login with { email, password }
        │         │
        │    Check Firestore "users" collection
        │         └─→ Found + password match → success
        │         │
        │    Not found → check students/{CSE-B,CSE-D}/members
        │         └─→ Found + roll number match → success
        │         │
        │    No match → 401 "Invalid email or password"
        │
        ▼
On success: user object stored in localStorage + AppContext.currentUser
On page reload: user read from localStorage to restore session
```

**User object shape after login:**
```json
{
  "id": "firestore-doc-id",
  "name": "Student Name",
  "email": "student@college.edu",
  "role": "STUDENT_GENERAL | STUDENT_ORGANIZER | FACULTY | HOD | PRINCIPAL",
  "isApprovedOrganizer": false,
  "className": "CSE-B"   // students only
}
```

---

## 6. Pages & Screens

### 6.1 Landing Page (`/`)

**Purpose:** Public home page / introduction  
**Access:** Everyone (no login required)

**Layout:**
- Full-screen background: college campus image (`sece.avif`) with dark overlay (55% opacity)
- Sticky glassmorphism navbar (top)
- Centered hero section:
  - College/dept logo (rounded, 96×96px)
  - "Sri Eshwar College of Engineering" badge (blue pill)
  - Headline: "CSE Department **Event Management**" (white + blue-400)
  - Sub-description paragraph
  - CTA button: "Get Started →" → navigates to `/login`
- Features grid (4 cards): Event Management, Student OD Requests, Multi-Level Approval, IQAC Submissions
- Stagger animation on page load via Framer Motion

**Features cards:**
| Icon | Title | Description |
|---|---|---|
| CalendarCheck | Event Management | Create, track, manage events through approval workflow |
| Users | Student OD Requests | Students submit On-Duty requests and get approvals |
| ShieldCheck | Multi-Level Approval | Faculty → HOD → Principal chain with audit trail |
| BookOpen | IQAC Submissions | Submit event reports and documentation to IQAC |

---

### 6.2 Login Page (`/login`)

**Purpose:** Unified login for all user types  
**Access:** Everyone

**Layout:**
- Same background as landing
- Single card centered on screen
- Form fields:
  - Username/Email (text input)
  - Password (password input with show/hide toggle eye icon)
- Submit button: "Sign In" with spinner when loading
- Error message display (red text)
- No separate registration — accounts provisioned by admin

**Behavior:**
- On success → redirects to `/dashboard`
- Persists login to `localStorage`
- Staff logins authenticated locally (no network call)
- Student logins hit `POST /api/login`

---

### 6.3 Dashboard (`/dashboard`)

**Purpose:** Central hub — different content per role  
**Access:** All logged-in users  
**Guard:** Redirects to `/` if not logged in

#### Layout Structure
```
Navbar (sticky)
│
Main (max-w-7xl, 3-column grid on desktop)
├── Left/Center (2/3): Stats cards + Tabbed content
│     ├── Stats Grid (5 cards for students, 4 for staff)
│     ├── Tab: Events / Pending Approvals
│     ├── Tab: My OD Requests (STUDENT_GENERAL only)
│     └── Tab: Registrations (STUDENT_ORGANIZER only)
│
└── Right Sidebar (1/3):
      ├── Organizer Requests (FACULTY only)
      ├── Manage Students quick card (staff only)
      ├── Student Organizer quick actions (organizer only)
      ├── CSE Department info card (image + stats)
      └── Quick Resources links
```

#### Stats Cards (top row)

| Label | Value | Color | Who sees |
|---|---|---|---|
| Total Events | count of all events | blue | all |
| My Queue / Pending | staff: queue count; students: pending events count | amber | all |
| Posted | POSTED + APPROVED count | emerald | all |
| Completed | COMPLETED count | slate | all |
| OD Requests | pending OD count | purple | students only |

#### Events Tab

**For Students (STUDENT_ORGANIZER):**
- Lists events created by them (`organizerId === currentUser.id`)
- Each row shows: event icon, title, venue + date, organizer name, status badge, "View Details" link
- Action buttons per event:
  - If event is **COMPLETED + no IQAC submitted**: "Submit IQAC (Xd left)" button with countdown
    - > 1 day left: normal secondary button
    - ≤ 1 day left: amber-highlighted button
    - deadline missed (> 3 days): red "IQAC Deadline Missed" badge
  - If event is **not COMPLETED + no IQAC**: no IQAC button (disabled until completed)
  - If IQAC is submitted: green "✓ IQAC Submitted" badge
- Row click → opens EventDetailModal

**For Staff (FACULTY / HOD / PRINCIPAL):**
- Lists events pending their specific approval level
  - FACULTY: events with status `PENDING_FACULTY`
  - HOD: events with status `PENDING_HOD`
  - PRINCIPAL: events with status `PENDING_PRINCIPAL`
- Row click → opens EventDetailModal with Approve/Reject buttons

#### My OD Requests Tab (STUDENT_GENERAL only)
- Lists OD requests where `studentId === currentUser.id`
- Each row: purple icon, student name, roll no, event name, date, status badge, Withdraw button
- Row click → opens ODRequestDetailModal
- Status badge colors:
  - APPROVED: emerald
  - REJECTED: red
  - WITHDRAWN: slate + strikethrough
  - PENDING_*: amber

#### Registrations Tab (STUDENT_ORGANIZER only)
- Lists incoming OD requests for events they organize
- Each row: FileText icon, student name, roll no, class, event title, status + action buttons
- PENDING_ORGANIZER: shows Reject (red) + Approve (green) buttons
- WITHDRAWN: shows "Withdrawn" pill
- APPROVED/REJECTED: shows coloured status pill
- Approve/Reject with `PATCH /api/od-requests/:id/status`

#### Faculty Sidebar: Organizer Requests
- Hardcoded sample request (mock data — Jane Smith, pending)
- CheckCircle button to approve
- Only visible to FACULTY role

#### Header Buttons
| Button | Visible to | Action |
|---|---|---|
| Explore Events | all | navigate to /explore |
| Create Event | STUDENT_ORGANIZER (approved) | navigate to /create-event |
| Manage Students | FACULTY, HOD, PRINCIPAL | navigate to /manage-students |

---

### 6.4 Create Event (`/create-event`)

**Purpose:** Student organizer submits a new event proposal  
**Access:** STUDENT_ORGANIZER with `isApprovedOrganizer === true`  
**Guard:** Redirects to `/` if not logged in

**Form sections (9 total):**

#### Section 1: Event Basic Information
| Field | Type | Validation |
|---|---|---|
| Event Title | text | required |
| Event Type | select | required (Workshop / Seminar / Technical Event / Cultural Event / Guest Lecture) |
| Organizing Department | text | required |
| Event Mode | select | required (Online / Offline / Hybrid) |
| Event Date | date | required, must be today or future |
| Start Time | time | required |
| End Time | time | required, must be **after** start time |
| Venue | text | required |

#### Section 2: Coordinator Details
| Field | Type | Validation |
|---|---|---|
| Faculty Coordinator Name | text | required |
| Faculty Email | email | required |
| Faculty Phone | tel | required |
| Student Organizer Name | text | required |
| Student Register Number | text | required |
| Student Phone | tel | required |

#### Section 3: Resource Person Details
| Field | Type | Validation |
|---|---|---|
| Speaker Name | text | required |
| Designation | text | required |
| Organization | text | required |
| Email | email | required |
| Phone Number | tel | required |

#### Section 4: Event Objective
| Field | Type | Validation |
|---|---|---|
| Event Purpose & Expected Learning Outcomes | textarea (h-32) | required |

#### Section 5: Target Audience
| Field | Type | Validation |
|---|---|---|
| Target Participants | select | required (All Students / First Year / Second Year / Third Year / Final Year / Department Students / Faculty / Mixed) |
| Expected Number of Participants | number (min 1) | required |

#### Section 6: Budget Details
| Field | Type | Validation |
|---|---|---|
| Estimated Budget (₹) | number (min 0) | required |
| Funding Source | select | required (Department / College / Sponsorship / Registration Fee / Mixed) |
| Expense Breakdown | textarea (h-24) | required |

#### Section 7: Logistics & Resource Requirements
All optional sub-sections:

**Venue Requirement:**
- Venue Required (select: yes/no) — required
- Preferred Venue (text)
- Seating Capacity (number)

**Media Requirement (checkboxes):**
- Photography Required
- Videography Required
- Social Media Promotion

**Food & Refreshment:**
- Guest Count, VIP Count, Student Count (numbers)
- Food Type (select: Snacks / Lunch / Tea / Breakfast / Dinner)

**Guest Travel:**
- Travel Required (checkbox)
- Travel Mode (select: Car / Train / Flight / Bus)

**Guest Accommodation:**
- Rooms Required (number)
- Number of Nights (number)

**IT Support:**
- Desktop Count, LAN Count, Projector Count (numbers)
- WiFi Access (checkbox)

**Audio Video Support:**
- Collar Mic Count, Hand Mic Count, Display Screen Count (numbers)
- Podium Required (checkbox)

#### Section 8: Event Schedule (Dynamic Table)
- Table with columns: Time | Activity | Delete button
- Default: 1 row
- "Add Time Slot" button adds rows
- At least 1 complete row required (both time + activity)
- Partial rows (only one filled) are invalid
- **Schedule must be in chronological order** (time of row N must be ≥ time of row N-1)

#### Section 9: Poster Upload
- File input: accepts `image/*`, `.pdf`
- Images compressed to max 800px width, JPEG 0.78 quality
- Stored as base64 dataUrl in Firestore (max payload 10 MB)

#### Validation Summary Banner
- Shown above submit button when errors exist
- Lists: "X required fields are empty or invalid" + schedule errors

#### Submit Behavior
- `POST /api/events` with full event object
- Initial status: `PENDING_FACULTY`
- On success: navigate to `/dashboard`
- On failure: shows red error message at bottom

---

### 6.5 Explore Events (`/explore`)

**Purpose:** Discover and register for upcoming events  
**Access:** All logged-in users  
**Guard:** Redirects to `/` if not logged in

**Visible events:** Status is one of `POSTED`, `APPROVED`, or `COMPLETED`

**Layout:** 3-column responsive card grid

#### Event Card Structure
```
┌────────────────────────┐
│  Poster image (h-48)   │
│  [Status Badge]  top-r │
├────────────────────────┤
│  Event Title (bold)    │
│  Description (2 lines) │
│  📍 Venue             │
│  📅 Date              │
│  [IQAC Submitted]      │  ← if event is completed
│                        │
│  [Action Button Area]  │
└────────────────────────┘
```

Poster image: uses event's `posterDataUrl` → fallback `posterUrl` → fallback Picsum placeholder

#### Action Button States (for students)

| State | Button/Display |
|---|---|
| Not registered, upcoming event | "Register Now" primary button |
| Registering (loading) | Spinner + disabled |
| Registration pending | "⏳ Pending Approval" amber + "Withdraw Registration" red button |
| Registration approved | "✓ Registration Approved" emerald + "Withdraw Registration" red button |
| Registration rejected | "✗ Registration Rejected" red pill |
| Withdrawn | "Register Now" again (re-register allowed) |
| Completed + approved + no feedback + within 1 day | "Give Feedback" primary button |
| Completed + feedback submitted | "Feedback Submitted ✓" emerald pill |
| Completed + feedback deadline missed (> 1 day) | "⚠ Feedback Deadline Missed" red pill |
| Completed + no OD or not approved | "Event Completed" grey disabled |

#### For Staff
- Shows "Staff View" grey label (no registration button)

#### Withdraw Flow
- Clicking "Withdraw Registration" opens a **custom confirmation modal** (not browser confirm)
- Modal shows event title + Yes/No buttons
- `PATCH /api/od-requests/:id/withdraw`

#### IQAC Detail Click
- If event is COMPLETED and has `iqacData` → clicking the card opens IQAC detail modal
- Card is `cursor-pointer` only in this case

#### Modals on this page:
1. **IQAC Detail Modal** — full IQAC report view
2. **Withdraw Confirm Modal** — withdrawal confirmation
3. **Feedback Modal** — star rating + comment form

---

### 6.6 IQAC Submission (`/iqac`)

**Purpose:** Student organizer submits post-event IQAC documentation  
**Access:** STUDENT_ORGANIZER only  
**Guards:**
- Redirects to `/` if not logged in
- Redirects to `/dashboard` if no event selected
- Shows alert + redirects to `/dashboard` if event is NOT `COMPLETED`

#### Deadline Logic
The IQAC submission deadline is **3 days after the event date**.

**Deadline Banner (shown at top of page):**
| Situation | Banner Color | Message |
|---|---|---|
| > 1 day remaining | Blue | "X days remaining — Deadline: [date]" |
| 1 day remaining | Amber | "IQAC Submission Due Tomorrow!" |
| 0 days remaining (today) | Amber | "IQAC Submission Due Today!" |
| Past deadline | Red | "IQAC Submission Deadline Missed — contact coordinator" |

#### Page Sections

**Section 1: Event Summary (Auto-populated, read-only)**
Shows: Event Title, Date, Venue, Organizer, Department, Resource Person, Target Audience, Status. Read from `selectedEvent` in AppContext.

**Section 2: Attendance Statistics (Live from Firestore)**
Live fetched from `GET /api/iqac/:eventId`
Shows: Registered, Approved, Rejected, Attendance Rate (%)

**Section 3: Participant Feedback Summary (Live from Firestore)**
Shows: Average rating (stars), total responses, individual feedback comments (student name, roll no, star rating, comment text)

**Section 4: Event Outcome (Manual — required)**
- Textarea (5 rows)
- Required field — red border + inline error if left empty on submit
- Error cleared as user types

**Section 5: Guest Feedback (Manual — required)**
- Textarea (4 rows)
- Required field — red border + inline error if left empty on submit
- Error cleared as user types

**Section 6: Document Uploads**
8 document slots, each with upload button:

| Document Type |
|---|
| Request Letter |
| Brochure |
| Schedule |
| Registration Details |
| Attendance Sheet |
| Geo-tagged Photos |
| Resource Person Profile |
| Participant Feedback Forms |

- Each slot shows uploaded state (green, filename shown) or upload state
- Accepts: images, PDF, DOC, DOCX, XLS, XLSX
- Images compressed to max 800px
- Upload/Replace/Remove per slot
- Progress bar showing X/8 documents
- At least 1 document required for submission

**Section 7: Final Event Report (required)**
- Single file upload slot (PDF, DOC, DOCX)
- Required for submission
- Shows file name + size when uploaded
- Replace / Remove buttons

#### Validation on Submit
| Field | Rule |
|---|---|
| Event Outcome | Must not be empty |
| Guest Feedback | Must not be empty |
| Documents | At least 1 uploaded |
| Final Report | Must be uploaded |

If validation fails:
- `validationErrors` state populated
- Red inline error under each failing field
- Red **validation summary banner** above submit button listing all issues
- Auto-scrolls to first error element

#### Submit Button
- Text: "Submit IQAC Report"
- Disabled + spinner while submitting
- Calls `POST /api/iqac/:eventId`
- Marks event as `COMPLETED` in Firestore
- On success → navigate to `/dashboard`

---

### 6.7 Manage Students (`/manage-students`)

**Purpose:** Staff view and manage student roles  
**Access:** FACULTY, HOD, PRINCIPAL only  
**Guard:** Redirects to `/` (not logged in) or `/dashboard` (not staff)

#### Layout
**Phase 1: Class selection grid**
- Shows available classes: `CSE B`, `CSE D`
- Each class shown as a card with student count
- Click to drill into the class

**Phase 2: Student list within a class**
- Back button to return to class grid
- Search bar (filters by name, roll number, email)
- Student rows showing:
  - Name + Roll No
  - Email
  - Current role badge (STUDENT_ORGANIZER: blue shield; STUDENT_GENERAL: slate)
  - Toggle button: "Make Organizer" (green) or "Revoke Organizer" (red)
  - Loading spinner while toggling

**Data source:** Firebase real-time + static `STUDENTS` array merged (Firebase takes precedence)

**Toggle logic:**
- If current role is `STUDENT_GENERAL` → set to `STUDENT_ORGANIZER`, `isApprovedOrganizer: true`
- If current role is `STUDENT_ORGANIZER` → set to `STUDENT_GENERAL`, `isApprovedOrganizer: false`
- Calls `PATCH /api/students/:id/role`
- Firestore path: `students/{CSE-B|CSE-D}/members/{studentId}`

---

## 7. Components

### `Navbar`
- Sticky, glassmorphism, z-50
- Left: Logo image + "CSE Event Management" title + "Department of Computer Science" subtitle
- Right (when logged in): User name + role text + Logout button (red hover)
- Logo click → `/dashboard` (logged in) or `/` (not logged in)
- Logout → clears `currentUser` in AppContext, navigates to `/`

### `StatusBadge`
Renders an event status as a colored pill badge.

| Status | Colors |
|---|---|
| PENDING_FACULTY | amber bg/text/border |
| PENDING_HOD | blue bg/text/border |
| PENDING_PRINCIPAL | purple bg/text/border |
| APPROVED | emerald bg/text/border |
| POSTED | emerald bg/text/border |
| REJECTED | red bg/text/border |
| COMPLETED | slate bg/text/border |

Display text: status with `PENDING_` stripped and underscores replaced with spaces.

### `EventDetailModal`
Full-screen overlay modal with all event details.

**Sections:**
- Header: event title + close button
- Status badge + approval chain progress
- Basic Info: date, time, venue, mode, type, department
- Coordinator: faculty + student coordinator details
- Resource Person: name, designation, org, email, phone
- Objective (full text)
- Target Audience + expected participants
- Budget: estimated amount, funding source, breakdown
- Logistics: venue/media/food/travel/accommodation/IT/AV
- Event Schedule (time table)
- Poster image preview (if available)

**Actions (for staff with approval rights):**
- Approve button → advances status in chain
- Reject button → sets status to REJECTED
- Next approver hint shown: "HOD" / "Principal" / "Posted for all students"
- Error state for ghost events (never saved to Firestore)

### `ODRequestDetailModal`
Modal showing OD request details for staff review.

**Sections:**
- Status badge + request date
- Student Information: name, roll no, class, email
- Event Details: title, date, venue
- Approval progress (Faculty → HOD → Principal steps)
- Approve/Reject buttons (context-aware per role)

### `FeedbackModal`
Modal for approved students to submit post-event feedback.

**Fields:**
- Star rating (1–5) with hover effect + label (Poor/Fair/Good/Very Good/Excellent)
- Comments textarea (optional)
- Submit button
- Success state with thank-you message

**Validation:** Rating must be selected before submitting.

---

## 8. Data Models

### Event Document (Firestore: `events/{eventId}`)
```typescript
{
  // Identity
  id: string;               // Firestore doc ID (auto)
  title: string;
  eventType: string;         // Workshop | Seminar | Technical Event | etc.
  organizingDepartment: string;
  eventMode: string;         // Online | Offline | Hybrid
  date: string;              // YYYY-MM-DD
  startTime: string;         // HH:MM
  endTime: string;           // HH:MM
  venue: string;
  description?: string;

  // Coordinator
  coordinator: {
    facultyName: string;
    facultyEmail: string;
    facultyPhone: string;
    studentName: string;
    studentRegNo: string;
    studentPhone: string;
  };

  // Resource Person
  resourcePerson: {
    name: string;
    designation: string;
    organization: string;
    email: string;
    phone: string;
  };

  // Content
  objective: string;
  targetAudience: {
    participants: string;    // All Students | First Year | etc.
    expectedCount: number;
  };

  // Budget
  budget: {
    estimatedBudget: number;
    fundingSource: string;
    expenseBreakdown: string;
  };

  // Logistics (all optional)
  logistics: {
    venue: { required: boolean; preferredVenue: string; seatingCapacity: number; };
    media: { photographyRequired: boolean; videographyRequired: boolean; socialMediaPromotion: boolean; };
    food: { guestCount: number; vipCount: number; studentCount: number; foodType: string; };
    travel: { required: boolean; mode: string; };
    accommodation: { roomsRequired: number; numberOfNights: number; };
    itSupport: { desktopCount: number; lanCount: number; wifiAccess: boolean; projectorCount: number; };
    avSupport: { collarMicCount: number; handMicCount: number; podiumRequired: boolean; displayScreenCount: number; };
  };

  // Schedule
  schedule: Array<{ time: string; activity: string; }>;

  // Poster
  posterFileName: string | null;
  posterDataUrl: string | null;  // base64 image

  // Metadata
  organizerId: string;
  organizerName: string;
  status: EventStatus;           // see status flow
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  approvedBy?: string;

  // IQAC (added when IQAC submitted)
  iqacSubmittedAt?: string;      // ISO 8601
  iqacData?: {
    eventSummary: { title, date, venue, organizer, department, description, resourcePerson, targetAudience };
    attendanceStats: { totalRegistered, approved, rejected, pending, attendanceRate };
    feedbackSummary: { totalResponses, averageRating, ratingOutOf, comments[] };
    eventOutcome: string;
    guestFeedback: string;
    documents: { [docName]: { fileName, fileType, fileSize, dataUrl, uploadedAt } };
    finalReport: { fileName, fileType, fileSize, dataUrl, uploadedAt } | null;
  };
}
```

### OD Request Document (Firestore: `odRequests/{odId}`)
```typescript
{
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
  organizerId: string;
  organizerName: string;

  studentId: string;
  studentName: string;
  rollNo: string;
  class: string;            // CSE-B | CSE-D
  email: string;
  reason: string;

  status: ODRequestStatus;  // PENDING_ORGANIZER | APPROVED | REJECTED | WITHDRAWN

  createdAt: string;
  updatedAt?: string;

  // Approval trail
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  withdrawnAt?: string;

  // Feedback (added after event completion)
  feedback?: {
    rating: number;           // 1–5
    comment: string;          // optional
    submittedAt: string;     // ISO 8601
  };
}
```

### User Document (Firestore: `users/{userId}`)
```typescript
{
  id: string;
  name: string;
  email: string;
  password: string;         // plain text (never exposed in responses)
  role: UserRole;
}
```

### Student Document (Firestore: `students/{className}/members/{studentId}`)
```typescript
{
  id: string;
  name: string;
  email: string;
  username?: string;        // alternative to email for login
  password: string;         // roll number (never exposed)
  rollNo: string;
  role: 'STUDENT_GENERAL' | 'STUDENT_ORGANIZER';
  isApprovedOrganizer: boolean;
  class: string;            // set from parent path, e.g. "CSE-B"
  updatedAt?: string;
}
```

---

## 9. Event Lifecycle (Status Flow)

```
                    [Student Organizer creates event]
                               │
                               ▼
                       PENDING_FACULTY ──── Rejected by Faculty ──► REJECTED
                               │
                        Faculty Approves
                               │
                               ▼
                         PENDING_HOD ──── Rejected by HOD ──► REJECTED
                               │
                          HOD Approves
                               │
                               ▼
                      PENDING_PRINCIPAL ── Rejected by Principal ─► REJECTED
                               │
                       Principal Approves
                               │
                               ▼
                            POSTED  ◄─── (= APPROVED, visible to students)
                               │
                        [Event takes place]
                               │
                       Staff marks COMPLETED
                               │
                               ▼
                           COMPLETED
                               │
                    Organizer submits IQAC report
                    (within 3-day deadline window)
                               │
                               ▼
                    COMPLETED + iqacSubmittedAt set
```

**Status display rules (Explore page visibility):**
- Only `POSTED`, `APPROVED`, `COMPLETED` are publicly visible on Explore
- `PENDING_*` and `REJECTED` are invisible to students browsing

---

## 10. OD Request Lifecycle

```
Student clicks "Register Now" on Explore page
                │
                ▼
         PENDING_ORGANIZER
         (Organizer sees in Registrations tab)
                │
         ┌──────┴──────┐
    Rejected        Approved
         │               │
         ▼               ▼
      REJECTED        APPROVED
                          │
                   Event completes
                          │
                   Feedback window
                   opens (1 day)
                          │
               Student submits feedback
                          │
                   myOD.feedback set

At any point (while PENDING or APPROVED):
Student can WITHDRAW → status = WITHDRAWN
→ student can re-register (creates new PENDING_ORGANIZER)
```

---

## 11. IQAC Submission Flow

```
Event must be COMPLETED before IQAC page is accessible
        │
        ▼
Organizer goes to Dashboard → clicks "Submit IQAC (Xd left)"
        │
        ▼
/iqac page loads:
  - Deadline banner shown (blue/amber/red)
  - Event summary auto-populated
  - Live attendance + feedback stats loaded from /api/iqac/:eventId

Organizer fills:
  ✓ Event Outcome (text)
  ✓ Guest Feedback (text)
  ✓ Document Uploads (1–8 files)
  ✓ Final Report (1 file)
        │
        ▼
Validation on submit:
  All 4 fields required → shows inline errors if missing
        │
        ▼
POST /api/iqac/:eventId
  → Builds eventSummary from event data
  → Builds attendanceStats + feedbackSummary from odRequests
  → Stores iqacData on event document
  → Sets event.status = "COMPLETED" (re-confirms)
  → Sets event.iqacSubmittedAt = now
        │
        ▼
Navigate to /dashboard
"IQAC Submitted" badge appears on event card
```

**Deadline enforcement:**
- 3 days from event date
- Day 0 (event day) = day 0
- Maximum submission window = event date + 3 days
- After deadline: "IQAC Deadline Missed" badge shown, page still accessible but banner warns

---

## 12. Feedback Flow

```
Event is COMPLETED
        │
        ▼
Student's OD request status must be = APPROVED
        │
        ▼
Event date + today ≤ 1 day (feedback window open)
        │
"Give Feedback" button appears on event card in Explore
        │
        ▼
FeedbackModal opens:
  - Star rating 1–5 (required)
  - Comment textarea (optional)
        │
        ▼
PATCH /api/od-requests/:odId/feedback
  { rating: number, comment: string }
        │
        ▼
myOD.feedback set in Firestore
Button changes to "Feedback Submitted ✓"

If >1 day passes without feedback → "Feedback Deadline Missed" red badge
```

---

## 13. API Reference

### Base URL
`http://localhost:5000/api`

All responses: `{ success: boolean, message?: string, ...data }`

---

### Auth

| Method | Endpoint | Body | Response |
|---|---|---|---|
| GET | `/login` | — | health check |
| POST | `/login` | `{ email, password }` | `{ success, user }` |

---

### Events

| Method | Endpoint | Query/Body | Description |
|---|---|---|---|
| POST | `/events` | Event object | Create new event |
| GET | `/events` | `?status=&organizerId=` | List all events (filtered) |
| GET | `/events/:id` | — | Get single event |
| PATCH | `/events/:id/status` | `{ status, approvedBy? }` | Update event status |
| PUT | `/events/:id` | Full event object | Full update |
| DELETE | `/events/:id` | — | Delete event |

**Allowed statuses for PATCH:**
`PENDING_FACULTY | PENDING_HOD | PENDING_PRINCIPAL | APPROVED | POSTED | REJECTED | COMPLETED`

---

### OD Requests

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/od-requests` | `{ eventId, studentId, studentName, rollNo, class?, email?, reason? }` | Register for event |
| GET | `/od-requests` | `?eventId=&studentId=&organizerId=&status=` | List requests |
| PATCH | `/od-requests/:id/status` | `{ status, approvedBy? }` | Approve / Reject |
| PATCH | `/od-requests/:id/withdraw` | — | Student withdraws |
| PATCH | `/od-requests/:id/feedback` | `{ rating (1–5), comment? }` | Submit feedback |

**409 conflict** returned if student tries to register for an already-active event.

---

### IQAC

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/iqac/:eventId` | `{ eventOutcome, guestFeedback, documents, finalReport }` | Submit IQAC + mark COMPLETED |
| GET | `/iqac/:eventId` | — | Get live stats + IQAC data |

---

### Students

| Method | Endpoint | Body / Query | Description |
|---|---|---|---|
| GET | `/students` | `?class=CSE-B` | Get all students (optional class filter) |
| PATCH | `/students/:id/role` | `{ role, className, isApprovedOrganizer }` | Update student role |

---

### Dashboard (aggregation endpoints)

| Method | Endpoint | Query | Description |
|---|---|---|---|
| GET | `/dashboard/events` | `?status=&organizerId=` | Events (same as /events) |
| GET | `/dashboard/od-requests` | `?studentId=&status=` | OD requests |
| GET | `/dashboard/students` | `?class=` | Students |

---

### Explore (public-facing)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/explore` | All POSTED/APPROVED/COMPLETED events |
| GET | `/explore/:id` | Single public event |

---

## 14. Firestore Database Structure

```
Firestore Root
│
├── events/                        ← all event documents
│   └── {eventId}/                 ← event fields (see Data Models)
│
├── odRequests/                    ← all OD request documents
│   └── {odRequestId}/             ← OD request fields
│
├── users/                         ← staff user accounts
│   └── {userId}/
│       ├── name
│       ├── email
│       ├── password (never exposed)
│       └── role
│
└── students/
    ├── CSE-B/
    │   └── members/
    │       └── {studentId}/
    │           ├── name
    │           ├── email
    │           ├── username
    │           ├── password (roll number, never exposed)
    │           ├── rollNo
    │           ├── role
    │           └── isApprovedOrganizer
    │
    └── CSE-D/
        └── members/
            └── {studentId}/       ← same structure
```

---

## 15. UI Design System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `cse-primary` | `#0f172a` | Dark navy — primary buttons, navbar background |
| `cse-accent` | `#3b82f6` | Blue-500 — links, focus rings, icons, highlights |
| Slate-50 | `#f8fafc` | Card backgrounds, input backgrounds |
| Slate-100 | `#f1f5f9` | Borders, dividers |
| Slate-200 | `#e2e8f0` | Input borders, table rows |
| Slate-400 | `#94a3b8` | Placeholder text, icons |
| Slate-500 | `#64748b` | Secondary text, labels |
| Slate-700 | `#334155` | Headings |
| Slate-900 | `#0f172a` | Body text |
| Emerald-500 | `#10b981` | Success states, approved |
| Amber-500 | `#f59e0b` | Warning states, pending |
| Red-500 | `#ef4444` | Error states, rejected |
| Purple-500 | `#8b5cf6` | OD requests |

### Typography

| Use case | Font | Weight | Size |
|---|---|---|---|
| Body text | Inter | 400 | text-sm (14px) |
| Labels | Inter | 500–600 | text-xs–text-sm |
| Section headers | Inter | 700 | text-lg–text-xl |
| Page titles | Inter | 700 | text-2xl–text-3xl |
| Stat numbers | Inter | 700 | text-2xl–text-4xl |
| Code / ids | JetBrains Mono | 400–500 | text-xs |

### Background

- Full-viewport background image: `src/assets/sece.avif` (college campus photo)
- Fixed attachment (parallax-like, doesn't scroll)
- Dark overlay: `rgba(15, 23, 42, 0.55)` — CSS `::before` pseudo-element on `body`
- All content renders above overlay via `z-index: 1` on `#root`

### Glassmorphism (`.glass-panel`)
```css
background: rgba(255, 255, 255, 0.80);
backdrop-filter: blur(12px);
border: 1px solid rgba(226, 232, 240, 1);  /* slate-200 */
box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
```
Used on: all cards, modals, panels, navbar

### Buttons

| Class | Look | Usage |
|---|---|---|
| `.btn-primary` | Dark navy bg, white text | Main actions (submit, create, approve) |
| `.btn-secondary` | White bg, slate border | Secondary actions (cancel, back, view) |

Both have `transition-all`, `active:scale-95`, `disabled:opacity-50`

### Input Fields (`.input-field`)
- Rounded-lg, slate-200 border
- Focus: `ring-2 ring-cse-accent/20 border-cse-accent`
- Error state: `border-red-500 focus:ring-red-200 focus:border-red-500`

### Animations (Framer Motion)
- Page sections: `initial={{ opacity: 0, y: 12/20 }} animate={{ opacity: 1, y: 0 }}`
- Cards: `initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}`
- Modals: scale + opacity transition
- Stagger children on landing page features grid
- All modals wrapped in `AnimatePresence` for exit animations

### Spacing & Layout
- Max content width: `max-w-7xl` (IQAC/Manage Students), `max-w-5xl` (forms), `max-w-4xl` (IQAC page)
- Horizontal padding: `px-6`
- Section gap: `space-y-6` to `space-y-8`
- Card border radius: `rounded-2xl`
- Responsive breakpoints: Mobile (1 col) → md (2 col) → lg (3 col)

---

## 16. Routing Map

| Path | Component | Guard |
|---|---|---|
| `/` | Landing | Public |
| `/login` | Login | Public |
| `/dashboard` | Dashboard | Must be logged in |
| `/create-event` | CreateEvent | Must be logged in |
| `/explore` | ExploreEvents | Must be logged in |
| `/iqac` | IQACSubmission | Must be logged in + event must be COMPLETED |
| `/manage-students` | ManageStudents | Must be FACULTY/HOD/PRINCIPAL |

**No 404 page** — unknown routes fall through to React Router without a catch-all route defined.

---

## 17. Validation Rules

### Create Event Form

| Rule | Field | Condition |
|---|---|---|
| Required | All 26 required fields | Empty → "Required field" error |
| Future date | date | Must be today or later |
| Time order | end_time | Must be strictly after start_time |
| Schedule completeness | schedule rows | At least 1 row with both time + activity filled |
| No partial rows | schedule rows | Either both or neither of time/activity filled |
| Chronological schedule | schedule rows | Times must be in ascending order across rows |

Validation fires on submit, errors cleared inline as user fixes each field.

### IQAC Submission Form

| Rule | Field | Condition |
|---|---|---|
| Required | eventOutcome | Non-empty string |
| Required | guestFeedback | Non-empty string |
| At least one | documents | `Object.keys(documents).length > 0` |
| Required | finalReport | `finalReport !== null` |

Errors cleared immediately as user types/uploads.

### Feedback Modal

| Rule | Field | Condition |
|---|---|---|
| Required | rating | Must select 1–5 stars before submitting |

### OD Request Creation (backend)

| Rule | Fields | HTTP response |
|---|---|---|
| Required | eventId, studentId, studentName, rollNo | 400 |
| No duplicate active | eventId + studentId | 409 Conflict (unless WITHDRAWN or REJECTED) |
| Event must exist | eventId | 404 |

---

## 18. Real-Time Data

The frontend uses **Firestore `onSnapshot` listeners** for three collections:

| Collection | Listener in | Updates |
|---|---|---|
| `events` | `subscribeToEvents()` | AppContext.events state |
| `odRequests` | `subscribeToODRequests()` | AppContext.odRequests state |
| `students/{class}/members` | `subscribeToStudents()` | AppContext.students state |

**Ghost Event handling:**
When Firestore reports a `not-found` error on an event that appeared in the local cache, the system:
1. Adds the event ID to `ghostIdsRef` (a `Set`)
2. Removes it from local state
3. Future snapshots filter out ghost IDs
4. Shows user-friendly error in EventDetailModal instead of crashing

**Loading state:**
- `AppContext.loading` = true until students snapshot arrives
- Dashboard shows centered spinner while loading

---

## 19. Role-Based View Summary (Per Screen)

### Landing Page
| All users | See hero, features, "Get Started" → /login |

### Login Page
| All users | Same login form. Staff uses hardcoded creds, students use Firestore auth |

### Dashboard

| Element | STUDENT_GENERAL | STUDENT_ORGANIZER | FACULTY | HOD | PRINCIPAL |
|---|:---:|:---:|:---:|:---:|:---:|
| Create Event button | ✗ | ✓ (if approved) | ✗ | ✗ | ✗ |
| Manage Students button | ✗ | ✗ | ✓ | ✓ | ✓ |
| OD Requests stat | ✓ | ✓ | ✗ | ✗ | ✗ |
| Events tab label | "Events" | "Events" | "Pending Approvals" | "Pending Approvals" | "Pending Approvals" |
| Events tab content | all events | their events + IQAC buttons | PENDING_FACULTY queue | PENDING_HOD queue | PENDING_PRINCIPAL queue |
| My OD Requests tab | ✓ | ✗ | ✗ | ✗ | ✗ |
| Registrations tab | ✗ | ✓ | ✗ | ✗ | ✗ |
| Organizer Requests sidebar | ✗ | ✗ | ✓ | ✗ | ✗ |
| Quick Actions sidebar | ✗ | ✓ | ✗ | ✗ | ✗ |
| Manage Students sidebar card | ✗ | ✗ | ✓ | ✓ | ✓ |

### Explore Events

| Element | STUDENT_GENERAL | STUDENT_ORGANIZER | Staff |
|---|:---:|:---:|:---:|
| Register Now button | ✓ | ✓ | ✗ |
| Give Feedback button | ✓ | ✓ | ✗ |
| Withdraw button | ✓ | ✓ | ✗ |
| Staff View label | ✗ | ✗ | ✓ |
| IQAC click-to-view | ✓ | ✓ | ✓ |

### IQAC Submission
| Only accessible to STUDENT_ORGANIZER when event is COMPLETED |

### Manage Students
| Only accessible to FACULTY, HOD, PRINCIPAL |

---

*End of Documentation*
