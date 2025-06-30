#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define DEVICE_NAME "Room1"          // Change this for each room ESP32
#define BUZZER_PIN 14
#define LOCK_PIN 15  // Solenoid lock pin

#define SERVICE_UUID         "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define DOOR_UUID            "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define OTP_UUID             "0a1b2c3d-4e5f-6789-1011-121314151617"

String currentOTP = "";
bool otpVerified = false;
bool deviceConnected = false;

BLECharacteristic* doorCharacteristic;
BLECharacteristic* otpCharacteristic;

class DoorControlCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) {
    if (!otpVerified) {
      Serial.println("❌ Door command denied — OTP not verified");
      return;
    }

    uint8_t* data = pChar->getData();
    if (pChar->getLength() == 1) {
      if (data[0] == 0) {
        digitalWrite(BUZZER_PIN, HIGH);
        digitalWrite(LOCK_PIN, HIGH);  // Unlock solenoid
        Serial.println("🔓 Door opened — Buzzer ON");
        delay(5000); // Ring buzzer for 5 seconds
        digitalWrite(BUZZER_PIN, LOW);
      } else if (data[0] == 1) {
        digitalWrite(BUZZER_PIN, LOW);
        digitalWrite(LOCK_PIN, LOW);   // Lock solenoid
        Serial.println("🔒 Door closed — Buzzer OFF");
      } else {
        Serial.println("❗ Invalid door command");
      }
    }
  }
};

class OTPCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) {
    String otp = String(pChar->getValue().c_str());
    currentOTP = otp;
    otpVerified = true; // Accept the OTP directly
    Serial.println("✅ OTP received and verified: " + currentOTP);
  }
};

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("✅ BLE device connected");
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    otpVerified = false;
    Serial.println("❌ BLE device disconnected");
    BLEDevice::startAdvertising();
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  pinMode(LOCK_PIN, OUTPUT);
  digitalWrite(LOCK_PIN, LOW);  // Initially locked

  BLEDevice::init(DEVICE_NAME);
  BLEServer* pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  doorCharacteristic = pService->createCharacteristic(
    DOOR_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  doorCharacteristic->setCallbacks(new DoorControlCallbacks());

  otpCharacteristic = pService->createCharacteristic(
    OTP_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  otpCharacteristic->setCallbacks(new OTPCallbacks());

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->start();

  Serial.println("🚀 BLE advertising as: " + String(DEVICE_NAME));
}

void loop() {
  // Nothing needed here
}