# MediTrack

MediTrack is a web application prototype for organizing household medicines and making basic medicine-management tasks easier. It combines a medicine inventory and expiry tracker with image-based label extraction, an AI information assistant, symptom-information prompts, and a nearby healthcare-services finder.

The application is intended for demonstration and educational use. It is not a medical device, does not provide a diagnosis, and should not be used to decide whether to start, stop, or change a medicine. Verify information on medicine packaging and consult a qualified healthcare professional.

## What is included

- **Medicine capture:** upload or take a medicine-package photo; Gemini can extract a name, dosage, expiry date, manufacturer, and quantity for review before saving.
- **Inventory and expiry:** add medicine details manually or from a scan, search the inventory, and group records by expired, expiring soon, and valid status.
- **Health assistant and symptom information:** optional Gemini-powered responses. These are general information only and are not a substitute for clinical advice.
- **Nearby services:** browser geolocation and OpenStreetMap's Overpass API are used to find nearby pharmacies and doctors. Data completeness depends on OpenStreetMap coverage; ratings are not provided.
- **Firebase support:** Firebase Authentication state, Firestore profile/medicine helpers, and Storage helpers are present in the codebase.
- **Optional Python chatbot:** a separate Flask API that predicts a response from a pre-trained scikit-learn model. The web UI currently uses Gemini and does not call this Flask API.
- **Interface:** responsive Next.js App Router UI, shared components, and a dark theme.

Some screens remain prototypes: the profile page and portions of the recommendations experience use hard-coded sample data, and there is no sign-in/sign-up interface or reminder scheduler.

## Technology

- Next.js 15, React, TypeScript, Tailwind CSS, and shadcn/Radix UI components
- Supabase JavaScript client for the browser-based inventory screens
- Firebase Authentication, Firestore, and Storage helpers
- Google Gemini API, called through a server-side Next.js route
- Optional Python Flask, NLTK, pandas, and scikit-learn chatbot backend

## Prerequisites

- Node.js 18.18 or newer and npm
- A Firebase project and a Supabase project for the corresponding features
- A Gemini API key for AI responses and image extraction
- Python 3.10+ only if you want to run the optional Flask chatbot

## Configure the services

1. Copy `.env.example` to `.env.local`.
2. Fill in the Firebase web-app values, Supabase project URL and anon key, and Gemini API key.
3. Keep `.env.local` private. It is ignored by Git. `GEMINI_API_KEY` is server-only; do not rename it to a `NEXT_PUBLIC_` variable.

The frontend initializes Firebase globally, so Firebase settings are required to run the application even if you are only testing the Supabase-backed inventory pages. The public Firebase and Supabase client settings are not substitutes for database security rules.

### Supabase inventory table

The inventory and expiry pages read from the Supabase `medicines` table; the scan page inserts these fields:

| Column | Suggested type | Notes |
| --- | --- | --- |
| `id` | `bigint` identity primary key | Used to update records |
| `name` | `text` | Medicine name |
| `dosage` | `text` | |
| `expiry_date` | `date` | Nullable if your schema permits it |
| `quantity` | `integer` | |
| `frequency` | `text` | |
| `notes` | `text` | |
| `created_at` | `timestamptz` | Default to `now()`; used for sorting by the inventory helper |

Set up Row Level Security and appropriate authorization before using real data. The current Supabase browser code does not associate inventory rows with a signed-in Supabase user, and the Firebase authentication state is not exchanged for a Supabase session. Do not make health records publicly readable or writable to make the demo work.

The Firebase rules are provided in `firestore.rules` and `storage.rules`; review and deploy them to your own Firebase project. Firebase configuration values in the browser are public by design, so access control must be enforced by Firebase rules.

## Start the web application

From the project directory:

```powershell
Copy-Item .env.example .env.local
# Edit .env.local and enter your service credentials
npm ci --legacy-peer-deps
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Geolocation generally requires HTTPS or localhost and user permission.

The legacy peer-dependency flag is currently needed because the project uses React 19 with `react-day-picker` 8, whose published peer range excludes React 19.

### Production and checks

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm start
```

`npm start` serves the production build. Configure all required environment values in the deployment environment before building and running the app.

## Optional Flask chatbot

The pre-trained artifact `health_chatbot_model.pkl` is included, so model training is not required to start the API. From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python backend\chatbot_api.py
```

The API listens on `http://127.0.0.1:5000`. `GET /` reports service status and `POST /predict` accepts JSON such as:

```json
{"message": "What can cause a headache?"}
```

To retrain the model from `chatbot_data\medquad.csv`:

```powershell
python backend\train_chatbot.py
```

Training replaces the root-level `health_chatbot_model.pkl`. The model is a simple text classifier, not a medical reasoning system; its output can be inaccurate. Run the Flask service only in a trusted development environment unless you add appropriate production security and operational controls.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/scan` | Scan or manually add a medicine |
| `/inventory` | Search inventory |
| `/expiry` | Review expiry categories and update records |
| `/recommendations` | Symptom-information and sample medicine search |
| `/assistant` | Gemini health-information chat |
| `/nearby` | Find nearby pharmacies and doctors |
| `/profile` | Sample family/profile interface |
| `/api` | Basic Next.js API health response |
| `/api/ai` | Server-side Gemini requests |
| `/api/nearby` | Nearby-service lookup endpoint |
| `/api/test-env` | Reports whether selected services are configured; does not return credentials |

## Data and privacy notes

- The scan page sends the selected image to the configured Gemini service for extraction.
- The AI endpoint is unauthenticated and has no durable rate limit in this prototype. Do not deploy it publicly with a billable Gemini key until access controls and usage limits are in place.
- The inventory UI currently uses the Supabase anon client directly from the browser. Restrict database access with proper authorization before storing personal or health information.
- Firebase profile and medicine helpers are separate from the Supabase-backed inventory screens; the app does not currently synchronize those stores.
- The Python chatbot endpoint is a separate prototype and is not wired into the Next.js assistant.
- AI output, OCR, scraped map data, and sample screens may be incomplete or incorrect. Check information with a qualified professional.
