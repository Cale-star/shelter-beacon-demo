// ============================================================================================
// SHELTER BOX v0.6 (Heltec V4.3) — "HQ got it" confirmation (ACK)
//   * After every copy the box listens for HQ's reply  ACK,<n>.  The first ACK for the current message
//     stops the remaining copies (less airtime) and marks the message CONFIRMED.
//   * No ACK after a round of copies -> NOT CONFIRMED: the box retries the same message by itself
//     after 5 s, 15 s, 30 s, then every 60 s until HQ answers or the leader changes something.
//   * What the leader sees / hears:
//       2 quick beeps .................. HQ got it (confirmed)
//       1 long beep .................... HQ hasn't answered yet; the box keeps trying on its own
//       light double-blinks every 2 s .. still not confirmed (returns to normal once HQ answers)
//   * NEEDS the v0.4-ack receiver (hq_rx_v04_ack). With an older receiver nothing breaks, but the box
//     never gets an answer, so it double-blinks and resends once a minute.
// ============================================================================================
// v0.5 (Heltec V4.3) — UI upgrade
//   * Occupancy: ONE big knob (10k linear pot, 11 detents) on GPIO 3: 0 5 10 15 20 30 40 50 60 80 100+
//       (fine steps where small shelters are, coarse where exact numbers don't change the supplies)
//       pot pin 1 -> 3V3, middle (wiper) -> GPIO 3, pin 3 -> GND. Turn = "about how many people".
//   * Front status LED on GPIO 38 (+ leg / red wire -> 38, - -> GND). Same pattern as the board LED:
//       slow blip = alive, steady = a need is on, quick flash = message sent.
//   * Beeper (active buzzer module) on GPIO 39: one chirp when a message is sent, two at power-up.
//       Module S -> 39, + -> 3V3, - -> GND. If it beeps constantly, set BUZZER_ACTIVE_LOW to 1.
//   * The two thumbwheels and their 8 wires are no longer used.
// Everything else (switch pins, radio, packet) is the same as v0.4, so the receiver doesn't change.
// ============================================================================================
// Heltec WiFi LoRa 32 **V4.3** — SHELTER BOX transmitter v0.4 (event-only)
// Same behaviour and packet as shelter_tx_v03 (V3), re-pinned for the V4.3 board:
//   * GPIO 2, 5, 7 belong to the V4's radio amplifier (KCT8103L front end), so
//     MEDICAL, FOOD and FUEL moved off them.
//   * The amplifier is powered and enabled at boot (see "V4.3 RF front end" below).
//   * USB is native on the V4: in the Arduino IDE pick board "ESP32S3 Dev Module"
//     and set  Tools > USB CDC On Boot: Enabled  (otherwise the Serial Monitor is blank).
// Pin source: Meshtastic firmware variants/esp32s3/heltec_v4/variant.h
//
// Inputs — every one is a switch from the GPIO to GND. Internal pull-ups, no resistors.
//   Toggles (closed = requesting):  WATER 6   MEDICAL 33   FOOD 47   SHELTER 4   FUEL 48
//   Occupancy, two BCD thumbwheels (Omron A7D-106 style, common -> GND), 0-99 people:
//     ones digit  bit 1/2/4/8 -> GPIO 38 / 39 / 40 / 41   (GPS connector pins: free with no GPS fitted)
//     tens digit  bit 1/2/4/8 -> GPIO 42 / 3 / 45 / 46    (3/45/46 are boot-strap pins: safe because a
//                                                          switch can only pull them LOW)
//     (nothing wired = reads 0; to fake a number with jumpers, ground the bits that add up to it)
//   PRG button (GPIO 0): send a check-in right now
//
// When it transmits: once at power-up, whenever a toggle or the thumbwheel changes,
// and when PRG is pressed. Nothing else (HEARTBEAT_S 0). Each new message goes out
// COPIES times ~0.5 s apart with the same message number, so one lost packet can't
// swallow a change; HQ ignores the extra copies.
//
// Packet: PKT,<n>,W<0|1>,M<0|1>,FD<0|1>,SH<0|1>,FU<0|1>,O<0-99>,H<heartbeat s>
//   e.g.  PKT,12,W1,M0,FD0,SH0,FU0,O37,H0   (water requested, 37 people, event-only)
//
// LED (GPIO 35) — the shelter box screen is dead, so this is its status light:
//   tiny blip every 4 s ......... powered, nothing requested
//   steady on ................... at least one need switched on
//   3 quick blinks .............. a message just went out (one blink per copy)
//   fast continuous blinking .... radio failed to start
//
// Libraries (Arduino Library Manager): RadioLib, U8g2

#include <RadioLib.h>
#include <SPI.h>
#include <Wire.h>
#include <U8g2lib.h>

// ---- Heltec V3 SX1262 pin map ----
#define LORA_SCK   9
#define LORA_MISO  11
#define LORA_MOSI  10
#define LORA_NSS   8
#define LORA_DIO1  14
#define LORA_RST   12
#define LORA_BUSY  13

// ---- Heltec V3 OLED pins ----
#define OLED_SDA   17
#define OLED_SCL   18
#define OLED_RST   21
#define VEXT_PIN   36   // powers the OLED; must be driven LOW

// ---- Other board pins ----
#define LED_PIN    35
#define PRG_PIN    0    // onboard PRG button, pressed = LOW

// ---- V4.3 RF front end (KCT8103L amplifier) ----
#define FEM_POWER  7    // amplifier supply (LDO) enable: HIGH = on
#define FEM_CSD    2    // amplifier chip enable:          HIGH = on
#define FEM_CTX    5    // receive mode select:            LOW = LNA (normal), HIGH = bypass
                        // TX/RX switching itself is automatic: radio DIO2 drives the amp's CPS pin

// ---- Radio settings: MUST be identical on transmitter and receiver ----
#define FREQ_MHZ     915.0
#define BW_KHZ       125.0
#define SPREAD_FACT  9
#define CODING_RATE  7
#define SYNC_WORD    0x12
#define TX_POWER     12      // dBm INTO the V4 amplifier, which adds roughly +7 to +11 dB.
                             // 12 gives about 21-23 dBm at the antenna: the same as the V3 at 22,
                             // so range numbers stay comparable. Up to 22 (~28 dBm out) is allowed
                             // under US 915 MHz rules; Japan's 920 MHz band allows far less.
#define PREAMBLE     8
#define TCXO_VOLTAGE 1.8

// ---- Reporting behaviour ----
#define HEARTBEAT_S      0     // 0 = event-only. Set e.g. 300 to also check in every 5 min.
#define COPIES           3     // times each new message is sent
#define COPY_GAP_MS      700   // spacing between copies (plus jitter). Long enough for HQ's ACK
                               // (~0.14 s on air, sent ~80 ms after a copy lands) to fit in between.
#define ACK_WAIT_MS      900   // after a round's last copy, how long to keep listening for the ACK
#define CONFIRM_GLOW_MS 1500   // light stays on this long when HQ confirms
#define DEBOUNCE_MS      40    // toggles and PRG
#define THUMB_SETTLE_MS 1500   // knob must rest on one click this long before it sends (turning past clicks sends once)
#define LED_FLASH_MS     80

// ---- Types and tables (kept above every function so Arduino's auto-prototypes compile) ----
struct Input {
  const char *key;     // field name in the packet
  const char *label;   // name on screen / serial
  uint8_t     pin;
  bool        stable;  // debounced state, true = switch closed
  bool        lastRaw;
  uint32_t    changedMs;
};

Input toggles[] = {
  {"W",  "WATR",  6, false, false, 0},   // water
  {"M",  "MED",  33, false, false, 0},   // medical   (was 7 on V3)
  {"FD", "FOOD", 47, false, false, 0},   // food      (was 5 on V3)
  {"SH", "SHLT",  4, false, false, 0},   // shelter: blankets, bedding, tarps
  {"FU", "FUEL", 48, false, false, 0},   // fuel      (was 2 on V3)
};
const uint8_t N_TOGGLES = sizeof(toggles) / sizeof(toggles[0]);

Input prgButton = {"", "PRG", PRG_PIN, false, false, 0};

#define OCC_POT_PIN        3    // ADC1 channel: wiper of the occupancy knob
#define OCC_STEPS         11    // knob positions (Alpha 9 mm pot with 11 detents, 300 degrees)
const int OCC_TABLE[OCC_STEPS] = {0, 5, 10, 15, 20, 30, 40, 50, 60, 80, 100};   // 100 = "100 or more"
#define EXT_LED_PIN       38    // front-panel status LED
#define BUZZER_PIN        39    // active buzzer module signal
#define BUZZER_ACTIVE_LOW  0    // 1 if your module beeps when S is LOW
#define CHIRP_MS          60

// Retry schedule when HQ doesn't answer: seconds before round 2, 3, 4, then the last value forever
const uint16_t RETRY_S[] = {5, 15, 30, 60};
const uint8_t  N_RETRY   = sizeof(RETRY_S) / sizeof(RETRY_S[0]);

// Beeper patterns: on, off, on, ... in ms
const uint16_t PAT_CHIRP[]   = {CHIRP_MS};
const uint16_t PAT_CONFIRM[] = {60, 90, 60};     // two quick beeps = HQ got it
const uint16_t PAT_NOCONF[]  = {450};            // one long beep   = not confirmed yet

enum AckState { ACK_IDLE, ACK_WAITING, ACK_CONFIRMED, ACK_MISSING };

SX1262 radio = new Module(LORA_NSS, LORA_DIO1, LORA_RST, LORA_BUSY);
U8G2_SSD1306_128X64_NONAME_F_HW_I2C display(U8G2_R0, OLED_RST, OLED_SCL, OLED_SDA);

bool     radioOk   = false;
int      lastState = RADIOLIB_ERR_NONE;

int      occupancy    = 0;     // debounced thumbwheel value
int      occRaw       = 0;
uint32_t occChangedMs = 0;

uint32_t    nextMsgNum   = 0;  // number the next new message gets
uint32_t    curMsgNum    = 0;
String      curMsg;
const char *curReason    = "";
uint8_t     copiesTotal  = 0;
uint8_t     copiesLeft   = 0;
uint32_t    nextCopyMs   = 0;
uint32_t    lastMsgMs    = 0;  // when the latest new message was queued
uint32_t    sentOk = 0, sentFail = 0;
uint32_t    ledFlashUntil = 0;

// ---- confirmation (ACK) state ----
volatile bool radioIrq = false;           // set by the radio interrupt (packet received, or TX done)
void IRAM_ATTR onRadioIrq() { radioIrq = true; }

AckState ackState    = ACK_IDLE;
uint8_t  roundNo     = 0;                 // 1 = first round of copies for this message
uint32_t roundEndMs  = 0;                 // listening window after a round's last copy closes here
uint32_t retryAtMs   = 0;                 // next retry round starts here
uint32_t confirmedMs = 0;
uint32_t confirmedTotal = 0, retryRounds = 0;

// ---------- inputs ----------
bool readActive(uint8_t pin) { return digitalRead(pin) == LOW; }   // closed to GND = on

// Returns true if the debounced state changed
bool updateInput(Input &s) {
  bool raw = readActive(s.pin);
  if (raw != s.lastRaw) {
    s.lastRaw = raw;
    s.changedMs = millis();
  }
  if (raw != s.stable && millis() - s.changedMs >= DEBOUNCE_MS) {
    s.stable = raw;
    return true;
  }
  return false;
}

// Knob -> people, using the uneven scale above. Averages 8 readings and adds hysteresis so the value
// doesn't flicker when the knob sits right between two steps.
int knobStep = -1;
int readOccupancyRaw() {
  uint32_t sum = 0;
  for (uint8_t i = 0; i < 8; i++) sum += analogRead(OCC_POT_PIN);
  float pos = (sum / 8.0f) / 4095.0f * (OCC_STEPS - 1);      // 0.0 .. 10.0
  int nearest = (int)(pos + 0.5f);
  if (knobStep < 0 || fabsf(pos - knobStep) > 0.65f) knobStep = nearest;
  return OCC_TABLE[knobStep];
}

// ---------- beeper (non-blocking) ----------
const uint16_t *bzPat = nullptr;
uint8_t  bzLen = 0, bzIdx = 0;
uint32_t bzNextMs = 0;
void buzzer(bool on) { digitalWrite(BUZZER_PIN, (on != (bool)BUZZER_ACTIVE_LOW) ? HIGH : LOW); }
void playPattern(const uint16_t *p, uint8_t n) { bzPat = p; bzLen = n; bzIdx = 0; buzzer(true); bzNextMs = millis() + p[0]; }
void chirp() { playPattern(PAT_CHIRP, 1); }
void serviceBuzzer() {
  if (!bzPat || (int32_t)(millis() - bzNextMs) < 0) return;
  if (++bzIdx >= bzLen) { bzPat = nullptr; buzzer(false); return; }
  buzzer(bzIdx % 2 == 0);                      // even steps sound, odd steps are gaps
  bzNextMs = millis() + bzPat[bzIdx];
}

// Returns true if the settled thumbwheel value changed
bool updateOccupancy() {
  int raw = readOccupancyRaw();
  if (raw < 0) return false;                     // mid-turn or miswired: ignore
  if (raw != occRaw) {
    occRaw = raw;
    occChangedMs = millis();
  }
  if (raw != occupancy && millis() - occChangedMs >= THUMB_SETTLE_MS) {
    occupancy = raw;
    return true;
  }
  return false;
}

bool anyNeed() {
  for (uint8_t i = 0; i < N_TOGGLES; i++) if (toggles[i].stable) return true;
  return false;
}

// ---------- LED ----------
void updateLed() {
  uint32_t now = millis();
  bool flashing = now < ledFlashUntil;
  bool steady;
  if (ackState == ACK_MISSING) {                         // not confirmed: double blink every 2 s
    uint32_t t = now % 2000;
    steady = (t < 120) || (t >= 300 && t < 420);
  } else if (ackState == ACK_CONFIRMED && now - confirmedMs < CONFIRM_GLOW_MS) {
    steady = true;                                       // HQ got it: solid glow for a moment
  } else if (anyNeed()) steady = true;                   // a need is on: steady
  else           steady = (now % 4000) < 20;             // idle: tiny blip = powered
  digitalWrite(LED_PIN, (steady != flashing) ? HIGH : LOW);  // a send inverts the light briefly
  digitalWrite(EXT_LED_PIN, (steady != flashing) ? HIGH : LOW);
}

// ---------- screen (in case this board's OLED works) ----------
void drawNeedBoxes(int y) {
  display.setFont(u8g2_font_5x7_tf);
  for (uint8_t i = 0; i < N_TOGGLES; i++) {
    int x = i * 26;
    if (toggles[i].stable) {
      display.drawBox(x, y, 24, 11);
      display.setDrawColor(0);
    } else {
      display.drawFrame(x, y, 24, 11);
    }
    int w = display.getStrWidth(toggles[i].label);
    display.drawStr(x + (24 - w) / 2, y + 9, toggles[i].label);
    display.setDrawColor(1);
  }
}

void drawScreen() {
  display.clearBuffer();

  display.setFont(u8g2_font_6x12_tf);
  display.drawBox(0, 0, 128, 12);
  display.setDrawColor(0);
  display.drawStr(2, 10, "TX  SHELTER BOX");
  display.setDrawColor(1);

  if (!radioOk) {
    display.drawStr(0, 30, "RADIO INIT FAILED");
    display.setCursor(0, 44);
    display.print("code ");
    display.print(lastState);
    display.sendBuffer();
    return;
  }

  display.setFont(u8g2_font_6x10_tf);
  display.setCursor(0, 22);
  display.print("msg #");
  display.print(curMsgNum);
  display.print("  sent ");
  display.print(copiesTotal - copiesLeft);
  display.print("/");
  display.print(copiesTotal);

  drawNeedBoxes(25);

  display.setFont(u8g2_font_6x10_tf);
  display.setCursor(0, 46);
  display.print("OCCUPANCY ");
  display.print(occupancy);

  display.setCursor(0, 56);
  if (lastState != RADIOLIB_ERR_NONE)   display.print("last send FAIL");
  else if (ackState == ACK_CONFIRMED)   display.print("HQ CONFIRMED");
  else if (ackState == ACK_MISSING)   { display.print("NOT CONFIRMED r"); display.print(roundNo); }
  else if (ackState == ACK_WAITING)     display.print("waiting for HQ...");
  else                                  display.print("last send OK");

  display.setFont(u8g2_font_5x7_tf);
  display.setCursor(0, 64);
  if (HEARTBEAT_S == 0) display.print("EVENT MODE  PRG=send now");
  else { display.print("check-in every "); display.print(HEARTBEAT_S); display.print("s"); }

  display.sendBuffer();
}

// ---------- sending ----------
String buildMsg(uint32_t n) {
  String msg = "PKT," + String(n);
  for (uint8_t i = 0; i < N_TOGGLES; i++) {
    msg += ",";
    msg += toggles[i].key;
    msg += toggles[i].stable ? "1" : "0";
  }
  msg += ",O" + String(occupancy);
  msg += ",H" + String(HEARTBEAT_S);
  return msg;
}

// Start a new message carrying the full current state. Replaces any copies still pending.
void queueMessage(const char *reason, uint8_t copies) {
  curMsgNum   = nextMsgNum++;
  curMsg      = buildMsg(curMsgNum);
  curReason   = reason;
  copiesTotal = copies;
  copiesLeft  = copies;
  nextCopyMs  = millis() + CHIRP_MS + 20;    // let the chirp finish first (transmit() blocks ~0.3 s)
  lastMsgMs   = millis();
  ackState    = ACK_WAITING;
  roundNo     = 1;
  roundEndMs  = 0;
  retryAtMs   = 0;
  chirp();                                   // "I heard you": one beep per new message
}

// Listen for HQ's answer between copies. transmit() leaves the radio in standby and its TX-done
// interrupt has already set the flag, so clear it first.
void listenForAck() {
  radioIrq = false;
  radio.startReceive();
}

void confirmed(int16_t rssi) {
  uint8_t copiesSent = copiesTotal - copiesLeft;
  copiesLeft  = 0;                           // no need for the rest
  roundEndMs  = 0;
  retryAtMs   = 0;
  ackState    = ACK_CONFIRMED;
  confirmedMs = millis();
  confirmedTotal++;
  radio.standby();                           // stop listening until the next message
  playPattern(PAT_CONFIRM, 3);
  Serial.print("[TX] HQ confirmed msg #");
  Serial.print(curMsgNum);
  Serial.print(" (round ");
  Serial.print(roundNo);
  Serial.print(", after copy ");
  Serial.print(copiesSent);
  Serial.print(", ACK RSSI ");
  Serial.print(rssi);
  Serial.println(" dBm)");
  drawScreen();
}

// Handles a received ACK, the end of a listening window, and retry rounds
void serviceAck() {
  if (radioIrq) {
    radioIrq = false;
    String reply;
    int st = radio.readData(reply);
    if (st == RADIOLIB_ERR_NONE && reply.startsWith("ACK,")) {
      long n = reply.substring(4).toInt();
      if ((ackState == ACK_WAITING || ackState == ACK_MISSING) && n == (long)curMsgNum) {
        confirmed((int16_t)radio.getRSSI());
        return;                              // radio is in standby now
      }
    }
    if (ackState == ACK_WAITING || ackState == ACK_MISSING) radio.startReceive();   // keep listening
  }

  // Round finished and nobody answered
  if ((ackState == ACK_WAITING || ackState == ACK_MISSING) && copiesLeft == 0 &&
      roundEndMs && (int32_t)(millis() - roundEndMs) >= 0) {
    roundEndMs = 0;
    uint16_t waitS = RETRY_S[min((int)roundNo - 1, (int)N_RETRY - 1)];
    retryAtMs = millis() + waitS * 1000UL;
    if (ackState == ACK_WAITING) playPattern(PAT_NOCONF, 1);   // long beep once per message, not every retry
    ackState = ACK_MISSING;
    radio.standby();
    Serial.print("[TX] No confirmation for msg #");
    Serial.print(curMsgNum);
    Serial.print(" after round ");
    Serial.print(roundNo);
    Serial.print(", retrying in ");
    Serial.print(waitS);
    Serial.println(" s");
    drawScreen();
  }

  // Time for the next try: same message, same number (HQ counts it as a copy if it already has it)
  if (ackState == ACK_MISSING && retryAtMs && (int32_t)(millis() - retryAtMs) >= 0) {
    retryAtMs   = 0;
    roundNo++;
    retryRounds++;
    copiesTotal = COPIES;
    copiesLeft  = COPIES;
    nextCopyMs  = millis();
    curReason   = "retry";
  }
}

void serviceSend() {
  if (copiesLeft == 0 || (int32_t)(millis() - nextCopyMs) < 0) return;

  lastState = radio.transmit(curMsg);
  uint8_t copyNo = copiesTotal - copiesLeft + 1;
  copiesLeft--;

  if (lastState == RADIOLIB_ERR_NONE) {
    sentOk++;
    Serial.print("[TX] Sent (");
    Serial.print(curReason);
    Serial.print(", copy ");
    Serial.print(copyNo);
    Serial.print("/");
    Serial.print(copiesTotal);
    Serial.print("): ");
    Serial.println(curMsg);
  } else {
    sentFail++;
    Serial.print("[TX] Send failed, code ");
    Serial.println(lastState);
  }

  nextCopyMs = millis() + COPY_GAP_MS + random(0, 150);
  listenForAck();
  if (copiesLeft == 0) roundEndMs = millis() + ACK_WAIT_MS;
  ledFlashUntil = millis() + LED_FLASH_MS;
  updateLed();
  drawScreen();
}

void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  pinMode(EXT_LED_PIN, OUTPUT);
  digitalWrite(EXT_LED_PIN, LOW);
  pinMode(BUZZER_PIN, OUTPUT);
  buzzer(false);
  analogReadResolution(12);
  analogSetPinAttenuation(OCC_POT_PIN, ADC_11db);           // full 0-3.3 V range

  for (uint8_t i = 0; i < N_TOGGLES; i++) pinMode(toggles[i].pin, INPUT_PULLUP);
  pinMode(PRG_PIN, INPUT_PULLUP);
  delay(5);

  // Start from whatever the switches are set to now
  for (uint8_t i = 0; i < N_TOGGLES; i++) {
    toggles[i].stable = toggles[i].lastRaw = readActive(toggles[i].pin);
  }
  prgButton.stable = prgButton.lastRaw = readActive(PRG_PIN);
  int occ = readOccupancyRaw();
  occupancy = occRaw = (occ < 0 ? 0 : occ);

  // Vext (LOW = on) powers the OLED, if fitted, and the V4's antenna-side circuitry
  pinMode(VEXT_PIN, OUTPUT);
  digitalWrite(VEXT_PIN, LOW);

  // Power and enable the V4.3 amplifier BEFORE starting the radio.
  // Skip this and the box reports "Sent" while barely transmitting.
  pinMode(FEM_POWER, OUTPUT);
  digitalWrite(FEM_POWER, HIGH);
  delay(5);                                // let the amplifier's supply settle
  pinMode(FEM_CSD, OUTPUT);
  digitalWrite(FEM_CSD, HIGH);
  pinMode(FEM_CTX, OUTPUT);
  digitalWrite(FEM_CTX, LOW);              // receive through the low-noise amp
  delay(50);
  display.begin();

  delay(1500);
  Serial.println("\n[TX] Starting...");

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);

  lastState = radio.begin(FREQ_MHZ, BW_KHZ, SPREAD_FACT, CODING_RATE,
                          SYNC_WORD, TX_POWER, PREAMBLE, TCXO_VOLTAGE);
  radioOk = (lastState == RADIOLIB_ERR_NONE);

  if (!radioOk) {
    Serial.print("[TX] Radio init FAILED, code ");
    Serial.println(lastState);
    drawScreen();
    while (true) {                         // fast blink = radio failed (screen may be dead)
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      digitalWrite(EXT_LED_PIN, digitalRead(LED_PIN));
      delay(150);
    }
  }

  radio.setPacketReceivedAction(onRadioIrq);
  randomSeed(esp_random());
  Serial.println("[TX] Radio OK (Heltec V4.3, amplifier on)");
  Serial.println(HEARTBEAT_S == 0 ? "[TX] Event-only: sends on change or PRG press"
                                  : "[TX] Sends on change, PRG press, and on a timer");
  buzzer(true); delay(70); buzzer(false); delay(90);      // power-up: two chirps
  queueMessage("boot", COPIES);            // tell HQ the box is up and what it's set to (2nd chirp)
  Serial.println("[TX] v0.6: waits for HQ's ACK after each copy, retries until confirmed");
  drawScreen();
}

void loop() {
  bool changed = false;
  for (uint8_t i = 0; i < N_TOGGLES; i++) {
    if (updateInput(toggles[i])) {
      changed = true;
      Serial.print("[TX] ");
      Serial.print(toggles[i].label);
      Serial.println(toggles[i].stable ? " ON" : " off");
    }
  }
  if (updateOccupancy()) {
    changed = true;
    Serial.print("[TX] Occupancy ");
    Serial.println(occupancy);
  }

  if (changed) {
    queueMessage("change", COPIES);
    drawScreen();
  } else if (updateInput(prgButton) && prgButton.stable) {
    queueMessage("button", COPIES);
  } else if (HEARTBEAT_S > 0 && copiesLeft == 0 &&
             millis() - lastMsgMs >= (uint32_t)HEARTBEAT_S * 1000UL) {
    queueMessage("heartbeat", 1);
  }

  serviceSend();
  serviceAck();
  updateLed();
  serviceBuzzer();
  delay(5);
}
