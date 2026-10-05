# AgriSense

Plant watering and shade system. Three separate parts that only talk over HTTPS:

```
 ESP32  ──signed HTTPS──►  server  ──service key──►  Supabase (database + auth)
                             ▲
 Phone app (React Native) ───┘  JWT over HTTPS
```

| Folder | What it is |
|---|---|
| `server/` | Node API. The only thing that touches the database. No web page is served from it any more. |
| `app/` | AgriSense mobile app (Expo / React Native). Installable APK with icon and logo. |
| `firmware/agrisense_device/` | ESP32 firmware, updated to sign its requests and verify the server's replies. |
| `supabase/schema.sql` | Database. Safe to run on top of the old SmartCultiva tables. |

## What changed from SmartCultiva

- The web page is gone. The app replaces it, with five bottom tabs: **Home, Stats, Logs, Control, Device**.
- The app never sees a Supabase key. It signs in through the server, which also logs every attempt.
- New: sensor history and charts, daily statistics, activity log, user log, editable automation settings (pushed to the ESP32), alerts, VPD (air dryness) reading, water-use estimate, device health, biometric app lock, admin / viewer roles.

## Security model

**Server**
- Fails to start if secrets are missing or weak. HTTPS only (HTTP gets 426). HSTS, strict CSP, `no-store`, no CORS (the app isn't a browser), `x-powered-by` off, 16 kB body limit.
- Every input is validated with zod; unknown fields are stripped; errors never echo request data.
- Rate limits: 240 req/min global, 20 sign-ins per 15 min per IP, 20 commands/min, 60 device calls/min.
- Sign-in lockout: 5 misses from one IP+email, or 20 from anywhere on one email, locks that for 15 min. Emails not in the allow-list never reach Supabase, and every failure gives the same answer.
- Roles: `ADMIN_EMAILS` can send commands, change settings and read everyone's logs. `VIEWER_EMAILS` are read-only and see only their own log entries. Checked on every request.
- Audit log: sign-ins (ok / failed / locked), sign-outs, commands, settings changes (old and new values), rejected device requests.
- Database: RLS on every table with **no** policies, so the public API key can read nothing. Only the server's service key works.
- Old data is purged automatically (readings 90 d, audit 1 yr).

**Device link**
- The device secret never travels. Each request carries a timestamp, a one-time nonce and an HMAC-SHA256 signature of the body.
- Server rejects: wrong id, clock off by more than 5 min, bad signature, tampered body, replayed nonce.
- The server signs every reply with the same timestamp and nonce. The ESP32 ignores any command or setting that isn't validly signed, so a fake server or a replayed reply can't make it water.
- The ESP32 pins your server's root certificate (no `setInsecure`).
- Firmware keeps its own hard limits no matter what the server says: pump max 30 s, 5 min between manual waterings, no watering on sensor fault, setting values clamped.

**App**
- Tokens live in the phone's secure storage (Keychain / Keystore), refreshed automatically. Cloud backup is disabled. Optional fingerprint / face lock, re-asked after 30 s in the background.
- HTTPS only (Android release builds block plain HTTP).

## Setup

### 1. Supabase
1. SQL editor → run `supabase/schema.sql`.
2. Authentication → create your user(s). Turn **off** public sign-ups. Use a long password; add MFA on your Supabase dashboard account.
3. Copy the URL, `anon` key and `service_role` key.

### 2. Server (Render)
1. New Web Service, root directory `server`, build `npm install`, start `npm start`, health check path `/healthz`.
2. Environment variables from `server/.env.example`. Generate the device secret with `openssl rand -hex 32`.
3. Keep the service key only here.

### 3. Firmware
1. Arduino IDE (ESP32 core 2.x/3.x). Libraries: DHT sensor library, AccelStepper, RTClib, ArduinoJson 7.
2. Edit `config.h`: Wi-Fi, `SERVER_URL`, `DEVICE_ID`, `DEVICE_SECRET` (same as the server), calibration values.
3. Paste the root certificate into `ROOT_CA`:
   `openssl s_client -showcerts -connect your-app.onrender.com:443 </dev/null` and copy the last certificate in the chain. If the host changes CA, update it.
4. Wiring and power notes are unchanged from the original (≥2 A supply, common ground, flyback diode on the pump).

The device only syncs once its clock is valid (NTP or the DS3231), because signatures need time.

### 4. Mobile app
```bash
cd app
npm install
npx expo install --fix        # aligns package versions with your Expo SDK
cp .env.example .env          # set EXPO_PUBLIC_API_URL
npx expo start                # try it in Expo Go first
```

**Installable APK with icon and logo**
```bash
npm i -g eas-cli
eas login
eas build:configure           # first time only
# put your server URL in eas.json -> build.preview.env.EXPO_PUBLIC_API_URL
eas build -p android --profile preview
```
EAS gives you a download link for the `.apk`. Open it on the phone to install. For the Play Store use `--profile production` (an `.aab`). iOS needs an Apple developer account (`eas build -p ios`).

Icon and splash are in `app/assets/` (matcha clay disc with a sprout). Replace the PNGs to rebrand; keep the sizes.

## API (all under HTTPS)

| Route | Who | Purpose |
|---|---|---|
| `POST /api/auth/login`, `/refresh`, `/logout`, `GET /me` | public / user | Session handling |
| `GET /api/status` | user | Live readings, alerts, VPD, next watering, open commands |
| `GET /api/history?range=6h\|24h\|7d\|30d` | user | Chart data |
| `GET /api/stats?days=1..90` | user | Per-day statistics and totals |
| `GET /api/events?group=&before=` | user | Activity log (paged) |
| `GET /api/audit?before=` | user | User log (admin: all, viewer: own) |
| `GET /api/settings`, `PUT /api/settings` | user / admin | Automation settings |
| `POST /api/commands` | admin | `water`, `cover`, `uncover` (idempotent) |
| `POST /api/device/sync` | device | Signed telemetry, events, commands, config |
| `GET /healthz` | anyone | Uptime check only |

## Things to know

- The sign-in lockout and replay-nonce store live in server memory. That is correct for one Render instance; if you scale to several, move them to a shared store.
- Render's free tier sleeps. The first sync after a sleep can fail and retries in 30 s; the 5-minute history may have small gaps.
- Water used is an estimate (pump seconds × the flow you enter).
- Package versions in `app/package.json` target Expo SDK 54. If your Expo version differs, `npx expo install --fix` corrects them.
- Rotate `DEVICE_SECRET` by changing it on the server and in `config.h`, then reflashing.
- No limit switch on the shade (as before): add one for homing if power can fail mid-move.
