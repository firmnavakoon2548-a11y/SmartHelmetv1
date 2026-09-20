/**
 * Real Web Bluetooth (BLE) Service for ESP32 Smart Helmet
 * Communicates with ESP32 via BLE GATT Server
 * Supports Battery Service, Nordic UART / Custom Telemetry Stream
 */

export interface HelmetTelemetry {
  batteryLevel: number;
  frontDistanceCm: number;
  leftDistanceCm: number;
  rightDistanceCm: number;
  isBuzzerActive: boolean;
  isVibrating: boolean;
  gpsLat?: number;
  gpsLng?: number;
  rawMessage?: string;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Real Web Bluetooth (BLE) Service for ESP32 Smart Helmet
 * Communicates with ESP32 via BLE GATT Server
 * Supports Battery Service, Nordic UART, HM-10 / Serial BLE, Custom Telemetry Stream
 */

export interface HelmetTelemetry {
  batteryLevel: number;
  frontDistanceCm: number;
  leftDistanceCm: number;
  rightDistanceCm: number;
  isBuzzerActive: boolean;
  isVibrating: boolean;
  gpsLat?: number;
  gpsLng?: number;
  rawMessage?: string;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

class BleHelmetService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private batteryChar: BluetoothRemoteGATTCharacteristic | null = null;
  private rxChar: BluetoothRemoteGATTCharacteristic | null = null;
  private txChar: BluetoothRemoteGATTCharacteristic | null = null;

  private onTelemetryCallback: ((data: HelmetTelemetry) => void) | null = null;
  private onStateChangeCallback: ((state: ConnectionState, deviceName?: string, errorMsg?: string) => void) | null = null;

  // Standard BLE UUIDs
  private BATTERY_SERVICE_UUID = 0x180F;
  private BATTERY_LEVEL_CHAR_UUID = 0x2A19;
  
  // Nordic UART Service (Common in ESP32 Arduino / ESP-IDF)
  private UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  private UART_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  private UART_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

  // HM-10 / CC2541 / Generic ESP32 Serial Service
  private FFE0_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
  private FFE1_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

  // Custom SafeSight ESP32 Service
  private SAFESIGHT_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  private SAFESIGHT_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

  public isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public setCallbacks(
    onTelemetry: (data: HelmetTelemetry) => void,
    onStateChange: (state: ConnectionState, deviceName?: string, errorMsg?: string) => void
  ) {
    this.onTelemetryCallback = onTelemetry;
    this.onStateChangeCallback = onStateChange;
  }

  public async connect(filterMode: 'all' | 'prefix' = 'all', customPrefix?: string): Promise<boolean> {
    if (!this.isBluetoothSupported()) {
      this.onStateChangeCallback?.('error', undefined, 'เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth API กรุณาเปิดผ่าน Google Chrome บน Android หรือ PC');
      return false;
    }

    try {
      this.onStateChangeCallback?.('connecting');

      const optionalServices = [
        this.BATTERY_SERVICE_UUID,
        this.UART_SERVICE_UUID,
        this.FFE0_SERVICE_UUID,
        this.SAFESIGHT_SERVICE_UUID,
        'generic_access',
        'generic_attribute',
        'device_information'
      ];

      // Request device: 'all' shows all nearby Bluetooth device names so user can tap and select
      if (filterMode === 'all') {
        this.device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices
        });
      } else {
        const prefix = customPrefix || 'ESP32';
        this.device = await navigator.bluetooth.requestDevice({
          filters: [
            { namePrefix: prefix },
            { namePrefix: 'SafeSight' },
            { namePrefix: 'SmartHelmet' },
            { namePrefix: 'Helmet' },
            { namePrefix: 'ESP' }
          ],
          optionalServices
        });
      }

      if (!this.device) {
        throw new Error('ผู้ใช้ยกเลิกการเลือกอุปกรณ์บลูทูธ');
      }

      const selectedName = this.device.name || 'ESP32 Bluetooth Device';

      this.device.addEventListener('gattserverdisconnected', this.handleDisconnected);

      const server = await this.device.gatt?.connect();
      if (!server) {
        throw new Error(`ไม่สามารถเชื่อมต่อ GATT Server ของ "${selectedName}" ได้`);
      }
      this.server = server;

      let initialBattery = 95;

      // 1. Discover Battery Service (Standard 0x180F)
      try {
        const batteryService = await server.getPrimaryService(this.BATTERY_SERVICE_UUID);
        this.batteryChar = await batteryService.getCharacteristic(this.BATTERY_LEVEL_CHAR_UUID);
        
        const battValue = await this.batteryChar.readValue();
        initialBattery = battValue.getUint8(0);

        await this.batteryChar.startNotifications();
        this.batteryChar.addEventListener('characteristicvaluechanged', (e: any) => {
          const value = e.target.value.getUint8(0);
          this.onTelemetryCallback?.({
            batteryLevel: value,
            frontDistanceCm: 250,
            leftDistanceCm: 250,
            rightDistanceCm: 250,
            isBuzzerActive: false,
            isVibrating: false
          });
        });
      } catch (_battErr) {
        // Battery service optional
      }

      // 2. Discover Nordic UART Service (6e400001-...)
      try {
        const uartService = await server.getPrimaryService(this.UART_SERVICE_UUID);
        this.txChar = await uartService.getCharacteristic(this.UART_TX_CHAR_UUID);
        this.rxChar = await uartService.getCharacteristic(this.UART_RX_CHAR_UUID);

        await this.txChar.startNotifications();
        this.txChar.addEventListener('characteristicvaluechanged', this.handleUartData);
      } catch (_uartErr) {
        // 3. Fallback: Discover FFE0 Serial Service
        try {
          const ffe0Service = await server.getPrimaryService(this.FFE0_SERVICE_UUID);
          const ffe1Char = await ffe0Service.getCharacteristic(this.FFE1_CHAR_UUID);
          this.txChar = ffe1Char;
          this.rxChar = ffe1Char;
          await ffe1Char.startNotifications();
          ffe1Char.addEventListener('characteristicvaluechanged', this.handleUartData);
        } catch (_ffeErr) {
          // 4. Fallback: Discover SafeSight Custom Service
          try {
            const ssService = await server.getPrimaryService(this.SAFESIGHT_SERVICE_UUID);
            const ssChar = await ssService.getCharacteristic(this.SAFESIGHT_CHAR_UUID);
            this.txChar = ssChar;
            this.rxChar = ssChar;
            await ssChar.startNotifications();
            ssChar.addEventListener('characteristicvaluechanged', this.handleUartData);
          } catch (_ssErr) {
            console.log('Using generic connected BLE GATT channel');
          }
        }
      }

      this.onStateChangeCallback?.('connected', selectedName);
      
      // Emit initial telemetry
      this.onTelemetryCallback?.({
        batteryLevel: initialBattery,
        frontDistanceCm: 200,
        leftDistanceCm: 220,
        rightDistanceCm: 220,
        isBuzzerActive: false,
        isVibrating: false
      });

      return true;
    } catch (err: any) {
      console.error('BLE connection error:', err);
      const isUserCancelled = err.name === 'NotFoundError' || err.message?.includes('User cancelled') || err.message?.includes('cancelled');
      const msg = isUserCancelled ? 'ยกเลิกการเลือกอุปกรณ์บลูทูธ' : (err.message || 'เชื่อมต่อบลูทูธล้มเหลว');
      this.onStateChangeCallback?.('error', undefined, msg);
      return false;
    }
  }

  private handleUartData = (event: any) => {
    try {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(event.target.value);
      // Example expected JSON from ESP32: {"f":120,"l":180,"r":200,"b":85,"buzzer":0}
      if (text.startsWith('{') && text.endsWith('}')) {
        const parsed = JSON.parse(text);
        this.onTelemetryCallback?.({
          batteryLevel: parsed.b ?? parsed.battery ?? 90,
          frontDistanceCm: parsed.f ?? parsed.front ?? 200,
          leftDistanceCm: parsed.l ?? parsed.left ?? 200,
          rightDistanceCm: parsed.r ?? parsed.right ?? 200,
          isBuzzerActive: Boolean(parsed.buzzer),
          isVibrating: Boolean(parsed.vibrate),
          gpsLat: parsed.lat,
          gpsLng: parsed.lng,
          rawMessage: text
        });
      }
    } catch (err) {
      console.warn('Error parsing BLE UART text', err);
    }
  };

  private handleDisconnected = () => {
    this.onStateChangeCallback?.('disconnected', this.device?.name);
    this.device = null;
    this.server = null;
    this.batteryChar = null;
    this.txChar = null;
    this.rxChar = null;
  };

  public async sendCommand(commandString: string): Promise<boolean> {
    const targetChar = this.rxChar || this.txChar;
    if (!targetChar) {
      console.warn('BLE sendCommand: No writable characteristic available');
      return false;
    }
    try {
      const encoder = new TextEncoder();
      const payload = encoder.encode(commandString);
      if ('writeValueWithoutResponse' in targetChar && typeof (targetChar as any).writeValueWithoutResponse === 'function') {
        try {
          await (targetChar as any).writeValueWithoutResponse(payload);
          return true;
        } catch (_e) {
          // fallback to writeValue
        }
      }
      await targetChar.writeValue(payload);
      return true;
    } catch (err) {
      console.error('Failed to send command to ESP32', err);
      return false;
    }
  }

  public disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.handleDisconnected();
  }

  public isConnected(): boolean {
    return Boolean(this.server && this.server.connected);
  }

  public getDeviceName(): string {
    return this.device?.name || 'ESP32 Smart Helmet';
  }
}

export const bleHelmetService = new BleHelmetService();
