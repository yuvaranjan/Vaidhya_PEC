#include <Wire.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include "heartRate.h"
#include <OneWire.h>
#include <DallasTemperature.h>

// DS18B20 on GPIO 4
#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);

MAX30105 particleSensor;

#define MAX_BRIGHTNESS 255

uint32_t irBuffer[100];
uint32_t redBuffer[100];

int32_t bufferLength;
int32_t spo2;
int8_t validSPO2;
int32_t heartRate;
int8_t validHeartRate;

byte readLED = 19;

long lastBeat = 0;
float beatsPerMinute;
const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
int beatAvg = 0, sp02Avg = 0;

float bodyTemp = 0.0;
unsigned long lastTempRequest = 0;
const unsigned long tempInterval = 1000;
unsigned long lastSerialSend = 0;
const unsigned long serialInterval = 500;

void setup()
{
  Serial.begin(115200);
  pinMode(readLED, OUTPUT);

  Serial.println("Initializing sensors...");

  // Initialize MAX30102
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST))
  {
    Serial.println("{\"error\":\"MAX30102 not found\"}");
    while (1);
  }
  Serial.println("MAX30102 initialized");

  // Sensor config (from your working Blynk code)
  byte ledBrightness = 50;
  byte sampleAverage = 1;
  byte ledMode = 2;
  byte sampleRate = 100;
  int pulseWidth = 69;
  int adcRange = 4096;

  particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);

  // Initialize DS18B20
  tempSensor.begin();
  tempSensor.setWaitForConversion(false);
  tempSensor.requestTemperatures();
  lastTempRequest = millis();

  Serial.println("DS18B20 initialized");
  Serial.println("Place finger on sensor...");
}

void loop()
{
  bufferLength = 100;

  // Read first 100 samples
  for (byte i = 0; i < bufferLength; i++)
  {
    while (particleSensor.available() == false)
      particleSensor.check();

    redBuffer[i] = particleSensor.getRed();
    irBuffer[i] = particleSensor.getIR();
    particleSensor.nextSample();
  }

  // Calculate HR and SpO2 after first 100 samples
  maxim_heart_rate_and_oxygen_saturation(irBuffer, bufferLength, redBuffer, &spo2, &validSPO2, &heartRate, &validHeartRate);

  // Continuously taking samples
  while (1)
  {
    // Read temperature every 1 second (non-blocking)
    if (millis() - lastTempRequest >= tempInterval) {
      float rawTemp = tempSensor.getTempCByIndex(0);
      if (rawTemp > 0.0 && rawTemp < 80.0) {
        bodyTemp = rawTemp;
      }
      tempSensor.requestTemperatures();
      lastTempRequest = millis();
    }

    // Shift buffer: discard oldest 25, keep newest 75
    for (byte i = 25; i < 100; i++)
    {
      redBuffer[i - 25] = redBuffer[i];
      irBuffer[i - 25] = irBuffer[i];
    }

    // Collect 25 new samples
    for (byte i = 75; i < 100; i++)
    {
      while (particleSensor.available() == false)
        particleSensor.check();

      digitalWrite(readLED, !digitalRead(readLED));

      redBuffer[i] = particleSensor.getRed();
      irBuffer[i] = particleSensor.getIR();
      particleSensor.nextSample();

      long irValue = irBuffer[i];

      // Calculate BPM independent of Maxim Algorithm
      if (checkForBeat(irValue) == true)
      {
        long delta = millis() - lastBeat;
        lastBeat = millis();
        
        beatsPerMinute = 60 / (delta / 1000.0);

        // Filter out obviously bad readings (like severely missed beats)
        if (beatsPerMinute > 40 && beatsPerMinute < 200) {
          rates[rateSpot++] = (byte)beatsPerMinute;
          rateSpot %= RATE_SIZE;
          
          beatAvg = 0;
          int validRates = 0;
          for (byte x = 0; x < RATE_SIZE; x++) {
            if (rates[x] > 0) {
              beatAvg += rates[x];
              validRates++;
            }
          }
          if (validRates > 0) {
            beatAvg /= validRates;
          }
        }
      }

      // Reset if no beat for 5 seconds (shorter reset time)
      if (millis() - lastBeat > 5000)
      {
        beatsPerMinute = 0;
        beatAvg = 0;
        for (byte x = 0; x < RATE_SIZE; x++) rates[x] = 0;
      }

      // Stream JSON every 500ms so the dashboard stays responsive
      if (millis() - lastSerialSend >= serialInterval)
      {
        lastSerialSend = millis();
        Serial.printf("{\"hr\":%d,\"spo2\":%d,\"temp\":%.2f}\n", beatAvg, sp02Avg, bodyTemp);
      }
    }

    // Recalculate HR and SpO2 with new samples
    maxim_heart_rate_and_oxygen_saturation(irBuffer, bufferLength, redBuffer, &spo2, &validSPO2, &heartRate, &validHeartRate);

    // Smooth SpO2 average
    if (validSPO2 == 1 && spo2 < 100 && spo2 > 0)
    {
      sp02Avg = (sp02Avg + spo2) / 2;
    }
    else
    {
      spo2 = 0;
      sp02Avg = (sp02Avg + spo2) / 2;
    }

    // Output JSON with all three readings
    int displayHR = beatAvg;
    if (displayHR == 0 && validHeartRate == 1 && heartRate > 0) {
      displayHR = heartRate;
    }
    
    Serial.printf("{\"hr\":%d,\"spo2\":%d,\"temp\":%.2f}\n", displayHR, sp02Avg, bodyTemp);
  }
}
