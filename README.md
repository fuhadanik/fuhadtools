# SF Layout CSV - Salesforce Layout to CSV Extractor (Cyberpunk Edition)

A serverless web application that extracts Salesforce page layout and FlexiPage metadata and exports it as a transposed CSV with full field details.

**Phase 1 MVP** - Built with Next.js, Firebase Auth, and deployed on Vercel.

## Features

- 🔐 **Firebase Authentication** - Secure login with Google or Email/Password
- ⚡ **Serverless Architecture** - Runs entirely on Vercel, no backend needed
- 🎨 **Cyberpunk Neon UI** - Terminal-style interface with glowing effects
- 📊 **Layout Extraction** - Supports both Page Layouts and Lightning FlexiPages
- 📝 **Rich Metadata** - Exports field type, picklist values, length, required, read-only, help text, and more
- 🔄 **Transposed CSV** - Fields as columns, attributes as rows for easy analysis
- 🔒 **Secure** - All Salesforce calls server-side, SID stored in HTTP-only cookies

## Tech Stack

- **Frontend:** Next.js 15 (Pages Router), React 18
- **Authentication:** Firebase Auth
- **Deployment:** Vercel (Serverless)
- **Styling:** Custom Cyberpunk CSS with Orbitron & Rajdhani fonts
- **Backend:** Next.js API Routes (Node.js)

## Prerequisites

1. **Node.js** 18+ installed
2. **Firebase Project** - Create one at [Firebase Console](https://console.firebase.google.com/)
3. **Vercel Account** (free tier works) - Sign up at [vercel.com](https://vercel.com)

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd fuhadtools
npm install
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Authentication** → **Sign-in method** → Enable:
   - Email/Password
   - Google
4. Go to **Project Settings** → **General** → **Your apps** → **Web app**
5. Copy the Firebase config values

### 3. Environment Variables

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your Firebase config:
   ```env
   SESSION_SECRET=<generate-random-secret>
   NEXT_PUBLIC_FIREBASE_API_KEY=your-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

3. Generate a secure `SESSION_SECRET`:
   ```bash
   openssl rand -base64 32
   ```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How to Use

### Step 1: Login
- Login with Google or Email/Password via Firebase

### Step 2: Get Salesforce Session ID (SID)

You can get your SID from:

**Option A: Browser Developer Console**
1. Login to Salesforce
2. Open Developer Tools (F12)
3. Go to Application → Cookies
4. Find `sid` cookie value

**Option B: Execute Anonymous (Developer Console)**
```apex
System.debug('SID: ' + UserInfo.getSessionId());
```

### Step 3: Connect to Salesforce
1. Paste your **Instance URL** (e.g., `https://yourorg.my.salesforce.com`)
2. Paste your **Session ID**
3. Click **START SESSION**

### Step 4: Select Object & Layout
1. Choose an **Object** (e.g., Account, Contact)
2. Choose a **Layout** (Page Layout or FlexiPage)

### Step 5: Export CSV
- Click **EXPORT CSV** to download the transposed CSV file

## CSV Output Format

The CSV is transposed with fields as columns:

| Attribute        | Field 1 | Field 2 | Field 3 |
|------------------|---------|---------|---------|
| Section          | Details | Details | Details |
| API Name         | Name    | Email   | Phone   |
| Label            | Account Name | Email Address | Phone Number |
| Type             | string  | email   | phone   |
| Length           | 255     | 80      | 40      |
| Required         | Yes     | No      | No      |
| Read Only        | No      | No      | No      |
| Picklist Values  |         |         |         |
| Reference To     |         |         |         |
| Help Text        | ...     | ...     | ...     |

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Phase 1 MVP complete"
git push origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Add environment variables:
   - `SESSION_SECRET`
   - All `NEXT_PUBLIC_FIREBASE_*` variables
4. Click **Deploy**

### 3. Configure Firebase for Production

In Firebase Console:
1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Add your Vercel domain (e.g., `your-app.vercel.app`)

## Project Structure

```
fuhadtools/
├── components/
│   ├── LoginForm.js       # Firebase login UI
│   └── MainApp.js         # Main application interface
├── lib/
│   ├── firebase.js        # Firebase config
│   ├── session.js         # JWT session management
│   ├── salesforce.js      # Salesforce API client
│   ├── csvGenerator.js    # CSV generation logic
│   └── apiMiddleware.js   # API route middleware
├── pages/
│   ├── api/
│   │   ├── login.js       # POST /api/login - Validate SID
│   │   └── sf/
│   │       ├── objects.js     # GET /api/sf/objects
│   │       ├── recordTypes.js # GET /api/sf/recordTypes
│   │       ├── layouts.js     # GET /api/sf/layouts
│   │       └── export.js      # GET /api/sf/export
│   ├── _app.js            # Next.js app wrapper
│   └── index.js           # Main page
├── styles/
│   └── globals.css        # Cyberpunk theme
├── PHASE_1_MVP.md         # Full specification
├── package.json
└── next.config.js
```

## API Routes

### POST `/api/login`
Validates Salesforce SID and creates session

**Body:**
```json
{
  "instanceUrl": "https://yourorg.my.salesforce.com",
  "sid": "00Dxxxxx..."
}
```

### GET `/api/sf/objects`
Returns list of all Salesforce objects

### GET `/api/sf/recordTypes?object=Account`
Returns record types for object

### GET `/api/sf/layouts?object=Account`
Returns layouts (Page Layouts + FlexiPages)

### GET `/api/sf/export?object=Account&layoutId=00hxxxx&layoutType=Layout`
Exports CSV file with layout metadata

## Security

✅ All Salesforce API calls are server-side
✅ SID stored in HTTP-only signed JWT cookie
✅ Firebase token required for all API routes
✅ No sensitive data in client-side code
✅ HTTPS enforced in production

## Known Limitations (Phase 1 MVP)

- Uses SID authentication (no OAuth)
- No database (stateless sessions)
- Basic Firebase token validation (not using Admin SDK)
- No multi-org support
- No export history

These will be addressed in Phase 2+.

## Troubleshooting

### "Unauthorized" errors
- Make sure you're logged in with Firebase
- Check that your SID is valid and not expired
- Verify environment variables are set correctly

### SID expired
- Salesforce SIDs expire after a few hours
- Get a fresh SID from Salesforce and reconnect

### Firebase errors
- Verify Firebase config in `.env.local`
- Check authorized domains in Firebase Console
- Enable Email/Password and Google auth methods

## Contributing

This is Phase 1 MVP. Future phases will include:
- OAuth authentication
- Multi-org support
- Export history and comparison
- JSON export
- Schema diagrams
- Chrome extension

## License

MIT License - See LICENSE file

## Author

Fuhad Hossain

---

**Built with** ⚡ **Next.js** | 🔥 **Firebase** | 🎨 **Cyberpunk Aesthetics**
