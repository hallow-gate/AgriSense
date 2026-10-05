// AgriSense device firmware 2.0
// Libraries: DHT sensor library (Adafruit), AccelStepper, RTClib, ArduinoJson 7
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <AccelStepper.h>
#include <RTClib.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <esp_task_wdt.h>
#include <mbedtls/md.h>
#include <vector>
#include "config.h"

const uint32_t MIN_VALID = 1700000000UL;
DHT dht(PIN_DHT, DHT22);
AccelStepper st(AccelStepper::HALF4WIRE, PIN_IN1, PIN_IN3, PIN_IN2, PIN_IN4);
RTC_DS3231 rtc; bool rtcPresent = false;
Preferences pf;

// settings pushed from the app (clamped here, so a bad server can't exceed safe limits)
struct Cfg { bool autoWater = true, autoShade = true; int soilDry = DEF_SOIL_DRY_PCT; float hotC = DEF_HOT_C, coolC = DEF_COOL_C; int pumpSec = DEF_PUMP_SECONDS, h1 = DEF_HOUR_1, h2 = DEF_HOUR_2; } cfg;

float tC = NAN, hum = NAN; int soilPct = -1; bool soilFault = false;
bool shadeClosed = false, shadeMoving = false, hold = false;
String shSrc, shId, shCmd; uint32_t lastShade = 0, holdUntil = 0;
bool pumpOn = false, everWatered = false; uint32_t pumpT0 = 0, pumpMs = 0, lastWater = 0; String pSrc, pId, pCmd;
uint32_t lastDht = 0, lastSync = 0, lastSched = 0, lastRtc = 0, lastWifi = 0, boots = 0; int hotN = 0, coolN = 0;

bool timeOk() { return time(nullptr) > MIN_VALID; }
String uid() { return timeOk() ? String((uint32_t)time(nullptr)) : "b" + String(boots) + "-" + String(millis() / 1000); }

// ---------- request signing (HMAC-SHA256) ----------
String hmacHex(const String& msg) {
  uint8_t out[32];
  mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), (const uint8_t*)DEVICE_SECRET, strlen(DEVICE_SECRET),
                  (const uint8_t*)msg.c_str(), msg.length(), out);
  char hex[65]; for (int i = 0; i < 32; i++) sprintf(hex + i * 2, "%02x", out[i]); hex[64] = 0; return String(hex);
}
String nonceHex() { char b[33]; for (int i = 0; i < 4; i++) sprintf(b + i * 8, "%08x", (unsigned)esp_random()); b[32] = 0; return String(b); }
bool constEq(const String& a, const String& b) {
  if (a.length() != b.length()) return false; uint8_t d = 0;
  for (size_t i = 0; i < a.length(); i++) d |= a[i] ^ b[i]; return d == 0;
}

// ---------- persistent settings ----------
void loadCfg() {
  cfg.autoWater = pf.getBool("aw", true); cfg.autoShade = pf.getBool("as", true);
  cfg.soilDry = pf.getInt("sd", DEF_SOIL_DRY_PCT); cfg.hotC = pf.getFloat("hot", DEF_HOT_C); cfg.coolC = pf.getFloat("cool", DEF_COOL_C);
  cfg.pumpSec = pf.getInt("ps", DEF_PUMP_SECONDS); cfg.h1 = pf.getInt("h1", DEF_HOUR_1); cfg.h2 = pf.getInt("h2", DEF_HOUR_2);
}
void applyCfg(JsonObjectConst c) {
  if (c.isNull()) return;
  Cfg n = cfg;
  n.autoWater = c["auto_water"] | cfg.autoWater; n.autoShade = c["auto_shade"] | cfg.autoShade;
  n.soilDry = constrain((int)(c["soil_dry_pct"] | cfg.soilDry), 10, 80);
  n.hotC = constrain((float)(c["hot_c"] | cfg.hotC), 30.0f, 45.0f);
  n.coolC = constrain((float)(c["cool_c"] | cfg.coolC), 25.0f, n.hotC - 1.0f);
  n.pumpSec = constrain((int)(c["pump_seconds"] | cfg.pumpSec), 5, (int)(PUMP_HARD_MAX_MS / 1000));
  n.h1 = constrain((int)(c["water_hour_1"] | cfg.h1), 0, 23); n.h2 = constrain((int)(c["water_hour_2"] | cfg.h2), 0, 23);
  if (n.h1 == n.h2) return;                                   // nonsense -> ignore the whole update
  if (n.autoWater == cfg.autoWater && n.autoShade == cfg.autoShade && n.soilDry == cfg.soilDry && n.hotC == cfg.hotC &&
      n.coolC == cfg.coolC && n.pumpSec == cfg.pumpSec && n.h1 == cfg.h1 && n.h2 == cfg.h2) return;
  cfg = n;
  pf.putBool("aw", n.autoWater); pf.putBool("as", n.autoShade); pf.putInt("sd", n.soilDry); pf.putFloat("hot", n.hotC);
  pf.putFloat("cool", n.coolC); pf.putInt("ps", n.pumpSec); pf.putInt("h1", n.h1); pf.putInt("h2", n.h2);
}

// ---------- persistent outbox: events survive reboot/offline, deduped server-side by event_id ----------
void queueEvent(const String& type, const String& src, const String& id, const String& detail, const String& cmd = "") {
  JsonDocument d; d["event_id"] = id; d["type"] = type; d["source"] = src; d["ts"] = (uint32_t)time(nullptr);
  if (cmd.length()) d["command_id"] = cmd;
  d["detail"] = serialized(detail);
  File f = LittleFS.open("/outbox.txt", "a"); serializeJson(d, f); f.println(); f.close();
  lastSync = millis() - SYNC_MS + 2000;                       // sync soon
}
std::vector<String> readOutbox() {
  std::vector<String> v; File f = LittleFS.open("/outbox.txt", "r");
  if (f) { while (f.available()) { String l = f.readStringUntil('\n'); l.trim(); if (l.length()) v.push_back(l); } f.close(); }
  if (v.size() > 100) v.erase(v.begin(), v.end() - 100);
  return v;
}
void writeOutbox(const std::vector<String>& v, size_t from) {
  File f = LittleFS.open("/outbox.txt", "w");
  for (size_t i = from; i < v.size(); i++) f.println(v[i]);
  f.close();
}

// ---------- soil ----------
int soilRaw() { long s = 0; for (int i = 0; i < 16; i++) { s += analogRead(PIN_SOIL); delay(5); } return s / 16; }
int soilPercent(int raw) { return constrain(map(raw, SOIL_DRY_RAW, SOIL_WET_RAW, 0, 100), 0, 100); }
bool rawFault(int raw) { return raw < 200 || raw > 4000; }
void readSoil() { int raw = soilRaw(); soilFault = rawFault(raw); soilPct = soilFault ? -1 : soilPercent(raw); }

// ---------- pump (non-blocking, hard cap) ----------
void pumpStart(const String& src, const String& id, const String& cmd) {
  pumpMs = min((uint32_t)cfg.pumpSec * 1000UL, PUMP_HARD_MAX_MS);
  pumpOn = true; pumpT0 = millis(); pSrc = src; pId = id; pCmd = cmd; digitalWrite(PIN_RELAY, RELAY_ON);
}
void pumpStop() {
  digitalWrite(PIN_RELAY, RELAY_OFF); pumpOn = false; lastWater = millis(); everWatered = true;
  queueEvent(pSrc == "schedule" ? "water_auto" : "water_manual", pSrc, pId,
             "{\"result\":\"ok\",\"seconds\":" + String(pumpMs / 1000) + ",\"soil_pct\":" + String(soilPct) + "}", pCmd);
}

// ---------- shade (stepper, slow, non-blocking) ----------
void moveShade(bool close, const String& src, const String& id, const String& cmd) {
  shadeMoving = true; shSrc = src; shId = id; shCmd = cmd; shadeClosed = close;
  st.moveTo(close ? SHADE_STEPS : 0);
}
void shadeDone() {
  shadeMoving = false; lastShade = millis(); st.disableOutputs();
  pf.putBool("closed", shadeClosed);
  queueEvent(shadeClosed ? "shade_close" : "shade_open", shSrc, shId,
             "{\"result\":\"ok\",\"temp_c\":" + String(isnan(tC) ? 0 : tC, 1) + "}", shCmd);
}

// ---------- automatic heat logic with hysteresis + confirmation ----------
void heatLogic() {
  if (millis() - lastDht < DHT_MS) return; lastDht = millis();
  float t = dht.readTemperature(), h = dht.readHumidity();
  if (isnan(t) || t < -40 || t > 80) return;
  tC = t; if (!isnan(h)) hum = h;
  if (!cfg.autoShade) { hotN = coolN = 0; return; }
  if (hold && (int32_t)(millis() - holdUntil) < 0) return;    // manual override active
  hold = false;
  if (t >= cfg.hotC) { hotN++; coolN = 0; } else if (t <= cfg.coolC) { coolN++; hotN = 0; } else hotN = coolN = 0;
  bool dwell = lastShade == 0 || millis() - lastShade > MIN_DWELL_MS;
  if (!shadeClosed && hotN >= CONFIRM_READS && dwell) moveShade(true, "auto_heat", "shade-close-" + uid(), "");
  else if (shadeClosed && coolN >= CONFIRM_READS && dwell) moveShade(false, "auto_heat", "shade-open-" + uid(), "");
}

// ---------- scheduled watering, once per slot (persisted BEFORE acting) ----------
void skip(const String& slot, int raw, const char* why) {
  queueEvent("water_skipped", "schedule", "water-skip-" + slot,
             "{\"result\":\"ok\",\"reason\":\"" + String(why) + "\",\"soil_pct\":" + String(soilPct) + ",\"raw\":" + String(raw) + "}");
}
void scheduleCheck() {
  if (!cfg.autoWater || !timeOk() || millis() - lastSched < 10000) return; lastSched = millis();
  time_t n = time(nullptr); struct tm t; localtime_r(&n, &t);
  int hours[2] = {cfg.h1, cfg.h2};
  for (int h : hours) {
    if (t.tm_hour != h || t.tm_min >= WINDOW_MIN) continue;
    char slot[16]; snprintf(slot, sizeof slot, "%04d%02d%02d-%02d", t.tm_year + 1900, t.tm_mon + 1, t.tm_mday, h);
    if (pf.getString("slot", "") == slot) return;
    pf.putString("slot", slot);
    int raw = soilRaw(); soilFault = rawFault(raw); soilPct = soilFault ? -1 : soilPercent(raw);
    if (pumpOn) skip(slot, raw, "busy");
    else if (soilFault) skip(slot, raw, "sensor_fault");        // fail safe: never water on a faulty sensor
    else if (soilPct >= cfg.soilDry) skip(slot, raw, "wet");
    else pumpStart("schedule", "water-" + String(slot), "");
    return;
  }
}

// ---------- commands from the app (deduped across reboots) ----------
bool seen(const String& id) { return pf.getString("cmds", "").indexOf(id) >= 0; }
void remember(const String& id) {
  String s = pf.getString("cmds", "") + id + ","; if (s.length() > 400) s = s.substring(s.length() - 370); pf.putString("cmds", s);
}
void reject(const char* type, const String& eid, const String& id, const char* why) {
  queueEvent(type, "manual", eid, "{\"result\":\"" + String(why) + "\"}", id);
}
void handleCmd(const String& id, const String& a) {
  if (id.length() < 8 || seen(id)) return; remember(id);
  String eid = "cmd-" + id;
  if (a == "water") {
    if (pumpOn) return reject("water_manual", eid, id, "busy");
    if (everWatered && millis() - lastWater < WATER_GAP_MS) return reject("water_manual", eid, id, "cooldown");
    readSoil(); pumpStart("manual", eid, id);
  } else if (a == "cover" || a == "uncover") {
    bool want = a == "cover"; const char* ty = want ? "shade_close" : "shade_open";
    if (shadeMoving) return reject(ty, eid, id, "busy");
    hold = true; holdUntil = millis() + MANUAL_HOLD_MS;
    if (shadeClosed == want) queueEvent(ty, "manual", eid, "{\"result\":\"ok\",\"noop\":true}", id);
    else moveShade(want, "manual", eid, id);
  }
}

// ---------- server sync: signed request out, signed response in ----------
void syncServer() {
  if (WiFi.status() != WL_CONNECTED || !timeOk()) return;     // signatures need a valid clock
  readSoil();
  auto lines = readOutbox(); size_t n = min(lines.size(), (size_t)10);
  JsonDocument req; JsonObject t = req["telemetry"].to<JsonObject>();
  if (!isnan(tC)) t["temp_c"] = tC;
  if (!isnan(hum)) t["humidity"] = hum;
  if (soilFault) t["soil_fault"] = true; else t["soil_pct"] = soilPct;
  t["shade"] = shadeClosed ? "closed" : "open"; t["pump"] = pumpOn;
  t["rssi"] = WiFi.RSSI(); t["uptime_s"] = (uint32_t)(millis() / 1000); t["heap"] = (uint32_t)ESP.getFreeHeap(); t["boots"] = boots; t["fw"] = FW_VERSION;
  JsonArray ev = req["events"].to<JsonArray>();
  for (size_t i = 0; i < n; i++) { JsonDocument e; if (!deserializeJson(e, lines[i])) ev.add(e); }
  String body; serializeJson(req, body);

  String ts = String((uint32_t)time(nullptr)), nonce = nonceHex();
  String sig = hmacHex(ts + "." + nonce + "." + body);

  WiFiClientSecure c;
#if ALLOW_INSECURE_TLS
  c.setInsecure();
#else
  c.setCACert(ROOT_CA);
#endif
  HTTPClient http; http.setTimeout(15000); http.begin(c, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-id", DEVICE_ID); http.addHeader("x-ts", ts); http.addHeader("x-nonce", nonce); http.addHeader("x-sig", sig);
  const char* want[] = {"x-sig"}; http.collectHeaders(want, 1);
  int code = http.POST(body);
  if (code == 200) {
    String resBody = http.getString(), rsig = http.header("x-sig");
    // only trust the answer if it is signed with our secret for THIS request
    if (constEq(rsig, hmacHex(ts + "." + nonce + "." + resBody))) {
      JsonDocument res;
      if (!deserializeJson(res, resBody)) {
        writeOutbox(lines, n);                                // drop sent events only after a verified confirmation
        applyCfg(res["config"].as<JsonObjectConst>());
        for (JsonObject cmd : res["commands"].as<JsonArray>()) handleCmd(cmd["id"].as<String>(), cmd["action"].as<String>());
      }
    } else Serial.println("bad response signature, ignored");
  } else Serial.printf("sync failed: %d\n", code);
  http.end();
}

void setup() {
  pinMode(PIN_RELAY, OUTPUT); digitalWrite(PIN_RELAY, RELAY_OFF);   // pump OFF first
  Serial.begin(115200); LittleFS.begin(true);
  pf.begin("plant", false); boots = pf.getUInt("boots", 0) + 1; pf.putUInt("boots", boots); loadCfg();
  analogSetPinAttenuation(PIN_SOIL, ADC_11db); dht.begin();
  shadeClosed = pf.getBool("closed", false);
  st.setMaxSpeed(SHADE_SPEED); st.setAcceleration(100); st.setCurrentPosition(shadeClosed ? SHADE_STEPS : 0); st.disableOutputs();
  Wire.begin(21, 22); rtcPresent = rtc.begin();
  WiFi.mode(WIFI_STA); WiFi.setAutoReconnect(true); WiFi.begin(WIFI_SSID, WIFI_PASS);
  configTzTime(TZ_INFO, "pool.ntp.org", "time.google.com");
  uint32_t t0 = millis(); while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) delay(250);
  struct tm tm; bool ntp = WiFi.status() == WL_CONNECTED && getLocalTime(&tm, 8000);
  if (ntp && rtcPresent) rtc.adjust(DateTime((uint32_t)time(nullptr)));
  else if (!ntp && rtcPresent && !rtc.lostPower()) { struct timeval tv = {(time_t)rtc.now().unixtime(), 0}; settimeofday(&tv, nullptr); }
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t wc = {.timeout_ms = 45000, .idle_core_mask = 0, .trigger_panic = true}; esp_task_wdt_reconfigure(&wc);
#else
  esp_task_wdt_init(45, true);
#endif
  esp_task_wdt_add(NULL);
}

void loop() {
  esp_task_wdt_reset();
  st.run();
  if (pumpOn && millis() - pumpT0 >= pumpMs) pumpStop();
  if (shadeMoving && st.distanceToGo() == 0) shadeDone();
  if (!shadeMoving) heatLogic();
  scheduleCheck();
  if (!pumpOn && !shadeMoving && millis() - lastSync >= SYNC_MS) { lastSync = millis(); syncServer(); }
  if (WiFi.status() != WL_CONNECTED && millis() - lastWifi > 30000) { lastWifi = millis(); WiFi.reconnect(); }
  if (rtcPresent && timeOk() && WiFi.status() == WL_CONNECTED && millis() - lastRtc > 21600000UL) { lastRtc = millis(); rtc.adjust(DateTime((uint32_t)time(nullptr))); }
}
