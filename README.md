# Coinbase Onramp Compatibility Tester

A web app for testing Coinbase Onramp payment methods across browsers and devices. Visit the hosted app on any device, enter your name, click a button, and the compatibility matrix updates in real-time based on what actually renders.

## What it does

- **Generates sandbox payment links on the fly** — no copy-pasting URLs between devices
- **Auto-detects browser, OS, and device** — highlights your row in the matrix with a "YOU" badge
- **Tests two integration types:**
  - **Apple Pay (Headless)** — renders the Apple Pay button in an iframe via the Onramp Orders API
  - **Hosted Onramp** — generates a hosted checkout link with all payment methods (Apple Pay, debit card, Coinbase login)
- **Live matrix updates** — listens for `postMessage` events from the Coinbase iframe and updates the matrix based on what actually loads (`load_success`, `load_error`, etc.)
- **Multi-tester support** — each tester enters their name; shared results aggregate across all testers so you can see who tested what
- **Dual view** — toggle between "All Testers" (shared aggregated results) and "My Results" (personal localStorage results)

## Compatibility matrix

Tests these browsers against three payment methods:

| Browser | Apple Pay (Guest) | Debit Card (Guest) | Coinbase Login |
|---------|:-:|:-:|:-:|
| Chrome | | | |
| Arc | | | |
| Dia | | | |
| Edge | | | |
| Firefox | | | |
| Opera | | | |
| Safari | | | |
| Chrome on iOS 16+ | | | |
| Safari on iOS 16+ | | | |
| Firefox on iOS 16+ | | | |
| Edge on iOS 16+ | | | |
| Chrome on Android | | | |

> Apple Pay on desktop Chromium browsers (Chrome, Edge, Arc, Dia, Opera) is supported on macOS only.

## Setup

### Prerequisites

- Node.js 18+
- A [CDP API key](https://portal.cdp.coinbase.com/) with Onramp permissions

### Local development

```bash
cd onramp-compat-app
npm install
```

Create `.env.local` with your CDP credentials:

```
CDP_API_KEY_ID=your-api-key-id
CDP_API_KEY_SECRET=your-api-key-secret
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deploy to Vercel

```bash
vercel deploy
```

Set environment variables in Vercel:

- `CDP_API_KEY_ID` — from your CDP API key JSON (`id` field)
- `CDP_API_KEY_SECRET` — from your CDP API key JSON (`privateKey` field)

For persistent shared results across deploys, add [Vercel KV](https://vercel.com/docs/storage/vercel-kv):

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Without Vercel KV, shared results use in-memory storage (resets on redeploy). Personal results always persist via localStorage.

## How it works

1. **User visits the app** and enters their name
2. **Browser detection** auto-identifies browser, OS, device, and Apple Pay API availability
3. **Click "Test Apple Pay"** — the server generates a JWT using `@coinbase/cdp-sdk/auth`, calls the CDP Onramp Orders API with `GUEST_CHECKOUT_APPLE_PAY`, and returns the payment link
4. **The payment link renders in an iframe** — the app listens for `postMessage` events:
   - `onramp_api.load_success` — marks Apple Pay as "Supported"
   - `onramp_api.load_error` with `NOT_SUPPORTED` — marks as "Not supported"
   - `onramp_api.load_error` with `NOT_SETUP` — marks as "Fallback"
5. **Results update both views** — personal (localStorage) and shared (server-side)
6. **Repeat on different browsers/devices** to fill in the full matrix

## Project structure

```
onramp-compat-app/
├── app/
│   ├── layout.js              # Root layout
│   ├── page.js                # Main UI (browser detection, test buttons, matrix)
│   ├── globals.css            # Tailwind CSS
│   └── api/
│       ├── generate-link/
│       │   └── route.js       # POST — generates payment links via CDP API
│       └── results/
│           └── route.js       # GET/POST/DELETE — shared results API
├── lib/
│   ├── cdp.js                 # JWT generation + CDP API calls
│   └── store.js               # Shared results storage (in-memory or Vercel KV)
├── postcss.config.mjs
├── next.config.mjs
└── package.json
```

## Domain allowlisting

For the Apple Pay iframe to load, the domain where this app is hosted must be added to the allowlist in the [CDP Portal](https://portal.cdp.coinbase.com/). Add:

- `localhost` (for local dev)
- Your Vercel deployment domain (e.g., `onramp-compat-app.vercel.app`)

## All transactions use sandbox mode

The app creates orders with a `sandbox-` prefix on `partnerUserRef`, which puts them in sandbox/test mode. No real money is charged.
