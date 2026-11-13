// Heltec WiFi LoRa 32 V3 — HQ RECEIVER v0.4-ack
// NEW in v0.4-ack: answers every box packet it hears with  ACK,<n>  (~80 ms later), so the box
// knows HQ got the message ("HQ got it" beeps) and stops resending. Every copy is answered, because
// the box may have missed the first ACK. Prints "[RX] ACK sent #n" for each one (the dashboard
// shows these as status lines). Pair with box firmware shelter_tx_v06_heltecV4.
// Everything else is the same as v0.3.
//
// Listens for shelter-box packets, prints one CSV line per packet over USB for the
// dashboard / logger, and shows the shelter's status on the OLED:
//   five needs (WATR MED FOOD SHLT FUEL — filled box = requested), occupancy,
//   signal, how long since the box was last heard, and message loss.
//
// Understands v0.3 packets  PKT,<n>,W1,M0,FD0,SH0,FU0,O37,H0
// and the older             PKT,<n>,W1,M0   and   PKT,<n>
// H<s> is the box's check-in interval; H0 = event-only, so a quiet box is normal
// and the screen does not warn NO SIGNAL. Older boxes are assumed to send every 2 s.
// Repeated copies of the same message (same number and contents) are counted once.
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

// ---- Radio settings: MUST match the transmitter exactly ----
#define FREQ_MHZ     915.0
#define BW_KHZ       125.0
#define SPREAD_FACT  9
#define CODING_RATE  7
#define SYNC_WORD    0x12
#define TX_POWER     22
#define PREAMBLE     8
#define TCXO_VOLTAGE 1.8

#define LEGACY_INTERVAL_S 2
#define ACK_DELAY_MS 80       // give the box time to switch from transmit to listen
#define SEND_ACKS    1        // 0 = behave exactly like v0.3 (listen only)   // boxes that don't send H<s> check in every 2 s

// ---- Types and tables (kept above every function so Arduino's auto-prototypes compile) ----
struct Need {
  const char *key;     // field name in the packet
  const char *label;   // name on screen
  int8_t      val;     // -1 = not reported, 0 = ok, 1 = requested
};

Need needs[] = {
  {"W",  "WATR", -1},
  {"M",  "MED",  -1},
  {"FD", "FOOD", -1},
  {"SH", "SHLT", -1},
  {"FU", "FUEL", -1},
};
const uint8_t N_NEEDS = sizeof(needs) / sizeof(needs[0]);

SX1262 radio = new Module(LORA_NSS, LORA_DIO1, LORA_RST, LORA_BUSY);
U8G2_SSD1306_128X64_NONAME_F_HW_I2C display(U8G2_R0, OLED_RST, OLED_SCL, OLED_SDA);

volatile bool packetReady = false;
void IRAM_ATTR onPacket() { packetReady = true; }

bool     radioOk     = false;
int      initState   = RADIOLIB_ERR_NONE;
uint32_t received    = 0;     // distinct messages
uint32_t copies      = 0;     // repeated copies heard (ignored)
uint32_t crcErrors   = 0;
uint32_t missed      = 0;     // gaps in the message numbers = lost messages
long     lastPktNum  = -1;
String   lastPayload;
float    lastRssi    = 0;
float    lastSnr     = 0;
uint32_t lastRxMs    = 0;
uint32_t lastDrawMs  = 0;
uint32_t acksSent    = 0;
int      occupancy   = -1;    // -1 = not reported
long     heartbeatS  = -1;    // -1 = not reported (older box)

// ---------- parsing ----------
// Applies one "KEY<number>" field such as "FD1", "O37" or "H0"
void applyField(const String &tok) {
  int i = 0;
  while (i < (int)tok.length() && isUpperCase(tok.charAt(i))) i++;
  if (i == 0 || i == (int)tok.length()) return;
  String key = tok.substring(0, i);
  long val = tok.substring(i).toInt();

  for (uint8_t n = 0; n < N_NEEDS; n++) {
    if (key == needs[n].key) { needs[n].val = (val == 1) ? 1 : 0; return; }
  }
  if (key == "O") occupancy = (int)val;
  else if (key == "H") heartbeatS = val;
}

void parsePayload(const String &payload) {
  int start = 0, field = 0;
  while (start <= (int)payload.length()) {
    int comma = payload.indexOf(',', start);
    if (comma < 0) comma = payload.length();
    String tok = payload.substring(start, comma);
    if (field >= 2) applyField(tok);              // fields 0 and 1 are "PKT" and the number
    field++;
    start = comma + 1;
  }
}

// ---------- screen ----------
void fmtAgo(char *buf, size_t len, uint32_t s) {
  if (s < 100)        snprintf(buf, len, "%lus", (unsigned long)s);
  else if (s < 6000)  snprintf(buf, len, "%lum", (unsigned long)(s / 60));
  else                snprintf(buf, len, "%luh", (unsigned long)(s / 3600));
}

void drawNeedBoxes(int y) {
  display.setFont(u8g2_font_5x7_tf);
  for (uint8_t i = 0; i < N_NEEDS; i++) {
    int x = i * 26;
    if (needs[i].val == 1) {
      display.drawBox(x, y, 24, 11);
      display.setDrawColor(0);
    } else if (needs[i].val == 0) {
      display.drawFrame(x, y, 24, 11);
    }                                             // not reported: label only, no box
    int w = display.getStrWidth(needs[i].label);
    display.drawStr(x + (24 - w) / 2, y + 9, needs[i].label);
    display.setDrawColor(1);
  }
}

void drawScreen() {
  display.clearBuffer();

  display.setFont(u8g2_font_6x12_tf);
  display.drawBox(0, 0, 128, 12);
  display.setDrawColor(0);
  display.drawStr(2, 10, "RX  HQ RECEIVER");
  display.setDrawColor(1);

  if (!radioOk) {
    display.drawStr(0, 30, "RADIO INIT FAILED");
    display.setCursor(0, 44);
    display.print("code ");
    display.print(initState);
    display.sendBuffer();
    return;
  }

  if (received == 0) {
    display.drawStr(0, 32, "Listening...");
    display.drawStr(0, 46, "no packets yet");
    display.sendBuffer();
    return;
  }

  uint32_t ago = (millis() - lastRxMs) / 1000;
  char agoTxt[8];
  fmtAgo(agoTxt, sizeof(agoTxt), ago);

  // Signal
  display.setFont(u8g2_font_6x10_tf);
  display.setCursor(0, 22);
  display.print((int)lastRssi);
  display.print("dBm SNR ");
  display.print(lastSnr, 1);

  // Needs
  drawNeedBoxes(25);

  // Occupancy + last heard
  display.setFont(u8g2_font_6x10_tf);
  display.setCursor(0, 46);
  display.print("OCC ");
  if (occupancy < 0) display.print("--");
  else display.print(occupancy);
  display.print("  heard ");
  display.print(agoTxt);
  display.print(" ago");

  // Message number + loss
  uint32_t expected = received + missed;
  float lossPct = expected ? (100.0f * missed / expected) : 0;
  display.setCursor(0, 56);
  display.print("msg #");
  display.print(lastPktNum);
  display.print("  lost ");
  display.print(lossPct, 0);
  display.print("%");

  // Link status
  display.setFont(u8g2_font_5x7_tf);
  display.setCursor(0, 64);
  long interval = heartbeatS < 0 ? LEGACY_INTERVAL_S : heartbeatS;
  if (interval == 0) {
    display.print("EVENT MODE: quiet = ok");     // 5x7 font: max ~25 characters
  } else if (ago > (uint32_t)(3 * interval)) {
    display.print("!! NO SIGNAL-check range");
  } else {
    display.print("LINK OK  crc err ");
    display.print(crcErrors);
  }

  display.sendBuffer();
}

void setup() {
  Serial.begin(115200);

  pinMode(VEXT_PIN, OUTPUT);
  digitalWrite(VEXT_PIN, LOW);
  delay(50);
  display.begin();

  delay(1500);
  Serial.println("\n[RX] Starting...");

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);

  initState = radio.begin(FREQ_MHZ, BW_KHZ, SPREAD_FACT, CODING_RATE,
                          SYNC_WORD, TX_POWER, PREAMBLE, TCXO_VOLTAGE);
  radioOk = (initState == RADIOLIB_ERR_NONE);

  if (!radioOk) {
    Serial.print("[RX] Radio init FAILED, code ");
    Serial.println(initState);
    drawScreen();
    while (true) delay(1000);
  }

  radio.setPacketReceivedAction(onPacket);
  radio.startReceive();

  Serial.println("[RX] Radio OK, listening (v0.4-ack: answers every packet)");
  Serial.println("ms,payload,rssi_dbm,snr_db");  // CSV header
  drawScreen();
}

void loop() {
  if (packetReady) {
    packetReady = false;

    String payload;
    int state = radio.readData(payload);

    if (state == RADIOLIB_ERR_NONE) {
      lastRssi = radio.getRSSI();
      lastSnr  = radio.getSNR();
      lastRxMs = millis();

      long n = -1;
      int comma = payload.indexOf(',');
      if (payload.startsWith("PKT") && comma > 0) n = payload.substring(comma + 1).toInt();

      bool isCopy = (n >= 0 && n == lastPktNum && payload == lastPayload);
      if (isCopy) {
        copies++;
      } else {
        received++;
        if (n >= 0) {
          if (lastPktNum >= 0 && n > lastPktNum + 1) missed += (n - lastPktNum - 1);
          lastPktNum = n;                         // a lower number = box restarted; start over from it
        }
        lastPayload = payload;
        parsePayload(payload);
      }

      // Every copy goes to the laptop; the dashboard does its own de-duplication
      Serial.print(millis());
      Serial.print(",");
      Serial.print(payload);
      Serial.print(",");
      Serial.print(lastRssi);
      Serial.print(",");
      Serial.println(lastSnr);

      // Answer the box. Same number for every copy, so whichever ACK gets through confirms it.
      if (SEND_ACKS && n >= 0) {
        delay(ACK_DELAY_MS);
        String ack = "ACK," + String(n);
        int ackState = radio.transmit(ack);
        if (ackState == RADIOLIB_ERR_NONE) {
          acksSent++;
          Serial.print("[RX] ACK sent #");
          Serial.println(n);
        } else {
          Serial.print("[RX] ACK failed, code ");
          Serial.println(ackState);
        }
      }
    } else if (state == RADIOLIB_ERR_CRC_MISMATCH) {
      crcErrors++;
      Serial.println("[RX] Packet arrived corrupted (CRC error)");
    } else {
      Serial.print("[RX] Read failed, code ");
      Serial.println(state);
    }

    packetReady = false;                  // transmit()'s TX-done interrupt also sets the flag
    radio.startReceive();
    drawScreen();
  }

  // Refresh once a second so "heard ... ago" and the link status stay live
  if (millis() - lastDrawMs > 1000) {
    lastDrawMs = millis();
    drawScreen();
  }
}
