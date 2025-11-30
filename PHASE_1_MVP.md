# PHASE_1_MVP.md — Salesforce Layout → CSV SaaS (Cyberpunk Edition)

**Version:** 1.0
**Author:** Fuhad
**Purpose:** Specification for MVP build (Phase 1) to hand off to AI coder
**Deployment:** Vercel (serverless)
**Authentication:** Firebase Auth (client-side)
**Salesforce Auth:** Session ID (sid) for MVP testing
**UI Theme:** Cyberpunk Neon

---

## 1. High-Level Summary

We are building a fully online web application that:
1. Authenticates users with Firebase Auth (Google/Auth).
2. Allows user to paste Salesforce Instance URL + SID.
3. Calls Salesforce from server-side (Vercel API routes) using the SID.
4. Lets user select:
   - Object
   - Record Type (optional)
   - Layout or FlexiPage
5. Extracts ONLY the fields used in the layout.
6. Merges with Describe metadata:
   - type
   - picklist values
   - length / precision
   - help text
   - required / read-only
   - reference objects
7. Generates a transposed CSV.
8. Returns CSV as file download.

This Phase 1 MVP should be fast, reliable, secure behind Firebase login, and visually designed in a cyberpunk neon terminal UI.

---

## 2. Tech Stack

### 2.1 Frontend
- Next.js 15+ (App Router NOT needed; use Pages Router)
- React 18
- Cyberpunk CSS theme (custom)
- Firebase Auth Web SDK

### 2.2 Backend (hidden on Vercel)
- Next.js API routes
- Node.js (built into Vercel)
- node-fetch
- JWT (HMAC) for server-side session cookie
- No database required

### 2.3 Deployment
- Vercel Free Tier
- Environment variables:
  - SESSION_SECRET
  - Firebase config embedded in frontend

---

## 3. Authentication Flow

### 3.1 Firebase Login (client-side)
- App loads with cyberpunk login screen.
- User must login with Google or email/password via Firebase.
- On success → show the main UI.
- Firebase ID token must be sent to backend (via cookie or header) for all API requests.

### 3.2 Backend access control

Each serverless API route must:
1. Read Firebase token from cookie or request header.
2. Verify with Firebase Admin SDK OR (MVP) trust client token if it's valid format.
3. Reject all unauthenticated calls.

---

## 4. SID Authentication Flow (MVP only)

No Salesforce Connected App needed.

User provides:
- instanceUrl
- sid (session ID)

Backend:
1. Calls GET {instanceUrl}/services/data/v59.0/ using Authorization: Bearer <sid>.
2. If response OK → SID is valid.
3. Store { instanceUrl, sid } in HTTP-only signed cookie.

If invalid, return error.

---

## 5. User Flow (End-to-End)
1. User logs in via Firebase.
2. UI shows two fields:
   - Instance URL
   - Salesforce Session ID (sid)
3. User clicks "Start Session".
4. Backend validates sid and stores session.
5. UI now unlocks data explorer section:
   - Load Objects
   - Load Record Types
   - Load Layouts
   - Export CSV
6. User selects Object → Backend gets object list.
7. User selects Layout → Backend loads layout metadata.
8. User clicks Export → Generates CSV and downloads file.

---

## 6. API Routes (Backend)

**Base Path:** `/api/*`

---

### 6.1 /api/login

**Purpose:**

Validate SID + instance URL and create server session.

**Input:**

```json
{
  "instanceUrl": "https://yourorg.my.salesforce.com",
  "sid": "00Dxxxxxxxx..."
}
```

**Actions:**
- Validate SID with Salesforce API.
- On success → set encrypted cookie with { instanceUrl, sid }.

**Output:**

200 OK, { ok: true } or error.

---

### 6.2 /api/sf/objects

**Purpose:**

List all objects.

**Output:**

```json
[
  { "name": "Account", "label": "Account" },
  { "name": "Contact", "label": "Contact" }
]
```

---

### 6.3 /api/sf/recordTypes?object=Account

**Output:**

```json
[
  { "id": "012xxxx", "name": "Business" },
  { "id": "012xxxx", "name": "Person" }
]
```

---

### 6.4 /api/sf/layouts?object=Account

**Output:**

```json
[
  { "id": "00hxxxx", "label": "Account Layout", "type": "Layout" },
  { "id": "0NQxxxx", "label": "Account_Record_Page", "type": "FlexiPage" }
]
```

---

### 6.5 /api/sf/export?object=Account&layoutId=00hxxxx

**Output:**
- Returns CSV as file download.
- Content-Type: text/csv
- Content-Disposition: attachment; filename="Account_layout.csv"

CSV is transposed like:

| Field | Value 1 | Value 2 | … |

---

## 7. Core Logic (Backend Only)

Must be server-side (hidden) for IP protection.

Functions to port from CLI:
- getFieldDetails(field)
- parseLayoutMetadata(layoutJson, describeJson)
- parseFlexiPageMetadata(flexiJson, describeJson)
- generateTransposedCsv(columns)

This logic stays private inside:

```
/pages/api/sf/export.js
```

---

## 8. Cyberpunk Neon UI (Frontend)

**Requirements:**
- Dark background (#000)
- Neon lines (green/pink/blue)
- Terminal-like fonts (Orbitron, Rajdhani)
- Components:
  - Login card (Firebase)
  - SID form
  - Neon buttons
  - Glowing borders
  - Animated effects (optional)

**UI sections:**
1. Login
2. Paste SID
3. Object selection
4. Layout selection
5. Export button

---

## 9. Security Requirements
- All Salesforce calls must be server-side.
- SID must be stored in HTTP-only cookie (jwt signed).
- Do not store SID in localStorage or client.
- Validate Firebase user for every route.
- No console.log of SID.

---

## 10. What is NOT in Phase 1 (intentional exclusions)

❌ No Auth0
❌ No OAuth
❌ No Stripe billing
❌ No Org-level database
❌ No Export JSON / sample data
❌ No Chrome extension
❌ No layout comparison
❌ No schema diagram

These come in Phase 2+.

---

## 11. Acceptance Criteria (MVP must pass)

### Functional
- User must log in with Firebase to use app.
- SID must validate successfully.
- Must load:
  - Objects
  - Record Types
  - Layouts
- Must export CSV correctly with:
  - Section
  - Field API name
  - Field type
  - Length/precision
  - Required/read-only
  - Picklist values

### UX
- Cyberpunk theme present.
- Smooth flow.
- Clear errors (invalid SID, expired SID, etc.)

### Backend
- All Salesforce logic hidden.
- Clean API route structure.
- Session cookie secure and signed.

---
