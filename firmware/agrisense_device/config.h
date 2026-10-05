#pragma once
// ---------- network ----------
#define WIFI_SSID   "your-wifi"
#define WIFI_PASS   "your-password"
#define SERVER_URL  "https://your-agrisense-server.onrender.com/api/device/sync"
#define TZ_INFO     "PST-8"            // Philippines UTC+8

// ---------- identity (must match the server's DEVICE_ID / DEVICE_SECRET) ----------
// The secret is never sent over the network: every request is signed with it (HMAC-SHA256).
#define DEVICE_ID     "agrisense-01"
#define DEVICE_SECRET "paste-the-64-char-hex-secret-here"
#define FW_VERSION    "2.0.0"

// ---------- TLS ----------
// Pin the root CA of your server so a fake server on the same Wi-Fi can't impersonate it.
// Get it with:  openssl s_client -showcerts -connect your-app.onrender.com:443 </dev/null
// and copy the LAST certificate (the root/intermediate issuer) into ROOT_CA below.
// Leave ALLOW_INSECURE_TLS at 0 for real use.
#define ALLOW_INSECURE_TLS 0
static const char ROOT_CA[] = R"EOF(
-----BEGIN CERTIFICATE-----
PASTE YOUR SERVER'S ROOT CERTIFICATE HERE
-----END CERTIFICATE-----
)EOF";

// ---------- pins ----------
#define PIN_DHT 4
#define PIN_SOIL 34
#define PIN_RELAY 26
#define RELAY_ON LOW                   // most relay boards are active-LOW
#define RELAY_OFF HIGH
#define PIN_IN1 16
#define PIN_IN2 17
#define PIN_IN3 18
#define PIN_IN4 19

// ---------- calibration ----------
#define SOIL_DRY_RAW 3000              // sensor in air
#define SOIL_WET_RAW 1300              // sensor in water
#define SHADE_STEPS 8192L              // 28BYJ-48 half-steps -> tune
#define SHADE_SPEED 150                // steps/s = slow

// ---------- defaults (the app can change these; they are used until the first sync) ----------
#define DEF_SOIL_DRY_PCT 40
#define DEF_HOT_C 37.0f
#define DEF_COOL_C 35.0f
#define DEF_PUMP_SECONDS 30
#define DEF_HOUR_1 7
#define DEF_HOUR_2 17

// ---------- fixed safety limits (the server can never push past these) ----------
#define PUMP_HARD_MAX_MS 30000UL       // pump never runs longer than 30 s
#define WATER_GAP_MS 300000UL          // min 5 min between manual waterings
#define WINDOW_MIN 15                  // catch-up window after a scheduled hour
#define CONFIRM_READS 6                // consecutive readings before moving the cover
#define DHT_MS 5000UL
#define MIN_DWELL_MS 600000UL          // 10 min between auto cover moves
#define MANUAL_HOLD_MS 3600000UL       // manual cover/uncover pauses auto for 1 h
#define SYNC_MS 30000UL
