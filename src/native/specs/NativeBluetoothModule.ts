import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for the Kotlin `BluetoothModule`
 * (android/app/src/main/java/.../bluetooth/BluetoothModule.kt). Use `src/native/bluetooth.ts`.
 */
export interface Spec extends TurboModule {
  getState(): Promise<Object>;
  /** Starts a Bluetooth Low Energy scan; results accumulate until `stopScan`. */
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  getScanResults(): Promise<Object>;
  /** Paired devices (needs BLUETOOTH_CONNECT on Android 12+; empty otherwise). */
  getBondedDevices(): Promise<Object[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeBluetoothModule');
