# ClipRewards

Pay-per-view clipping for India. Brands launch campaigns; creators connect Instagram/YouTube, post clips, and get paid for verified views.

- `client/`: React + Vite + Tailwind (mobile-first, dark grey-glass UI)
- `server/`: Express + MongoDB (Mongoose). In production it also serves the built web app, so **the site, the API and the Instagram callback share one domain**.

## Run locally

```bash
npm install
cp .env.example .env      # fill in what you need (see below)
npm run dev               # web on http://localhost:5173, API on :3000
npm run seed              # optional demo data (works while dev is running)
npm test                  # server tests
```

Without `MONGODB_URI`, dev uses an embedded MongoDB that saves to `server/.data`.
In dev you can sign in as demo users with “Dev only: sign in with an email code” (e.g. `creator1@demo.local`).

### Testing Instagram connect locally
Instagram only accepts **https** redirect URLs, so use a tunnel:

```bash
ngrok http --url=<your-static-domain>.ngrok-free.dev 5173
```

Set `INSTAGRAM_REDIRECT_URI=https://<your-static-domain>.ngrok-free.dev/api/social/instagram/callback` and register the same URL in Meta.
You can start the connect from `localhost` or the tunnel; after Instagram you’re sent back to the same site you started on.

## Deploy to production (one service)

Any Node host works (Render, Railway, Fly, a VPS). Example: **Render → New Web Service**.

| Setting | Value |
|---|---|
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Node | 24.12+ (the Dockerfile uses node:24) |

`npm ci` installs dev dependencies too (needed for the Vite build). The embedded test database is never used in production.

### Required environment variables

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | Your https domain, e.g. `https://cliprewards.in` |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | 32+ random characters |
| `TOKEN_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ADMIN_EMAILS` | Your email(s), comma-separated |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | Firebase web config. **Must be set at build time** (Vite bakes them in). |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | From Meta → Instagram → API setup with Instagram login |
| `YOUTUBE_API_KEY` | Google Cloud API key restricted to YouTube Data API v3 |
| `CLOUDINARY_URL` | Cloudinary → API Keys → API environment variable (`cloudinary://key:secret@cloud`), for campaign image uploads. Or set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` separately |

Optional: `INSTAGRAM_REDIRECT_URI` (defaults to `<CLIENT_ORIGIN>/api/social/instagram/callback`), `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `ALLOWED_ORIGINS` (extra comma-separated origins).

The server refuses to start in production if `CLIENT_ORIGIN`, `MONGODB_URI`, `JWT_SECRET` or `TOKEN_ENCRYPTION_KEY` is missing, and logs which optional features are off.

### Point the providers at your domain

Replace `cliprewards.in` with your domain.

**Meta (Instagram)**
1. Instagram → API setup with Instagram login → Business login settings → **OAuth redirect URIs**: `https://cliprewards.in/api/social/instagram/callback`
2. (Optional) Webhooks: callback `https://cliprewards.in/api/social/instagram/webhook`, verify token = `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`.
3. Until App Review is approved, only Instagram accounts added as **testers** can connect. Submit App Review for `instagram_business_basic` and `instagram_business_manage_insights` (needs Business Verification, a privacy policy URL and a screen recording of the connect + insights flow).

**Firebase (Google sign-in)**
- Authentication → Settings → **Authorized domains**: add `cliprewards.in`.
- Google Cloud → APIs & Services → Credentials → the **Web client (auto created by Google Service)** → **Authorized redirect URIs**: add `https://cliprewards.in/__/auth/handler`. Then set `VITE_AUTH_ON_OWN_DOMAIN=true` and redeploy: the app will run Google sign-in through your own domain (the server serves Firebase’s sign-in pages at /__/auth), which works better in Safari and when popups are blocked. Until then it uses Firebase’s own domain, which works without this step.

**Google Cloud (YouTube)**
- Enable **YouTube Data API v3**; OAuth consent screen: add scope `youtube.readonly` and your domain. Until Google verifies the app, users see an “unverified app” warning (max 100 users).
- If the consent screen is in **Testing**, only the Google accounts listed under **Test users** can connect YouTube. Add yours, or set it to **In production**.
- On Google’s permission screen creators must tick **View your YouTube account**; the app explains this if they don’t.

### Running the business

Sign in with an email listed in `ADMIN_EMAILS`, then use **Admin → Campaigns**: pick a verified brand (or **Add brand**), fill in the brief, rate, budget, dates and images, then **Save and go live**. Live campaigns appear on the home feed and `/campaigns` immediately. Pause or End from the campaign page.

### Health check
`GET /api/health` returns `{"status":"ok"}`.
