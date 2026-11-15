import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for the Kotlin `WifiModule`
 * (android/app/src/main/java/.../wifi/WifiModule.kt).
 *
 * Results are validated in `src/native/wifi.ts`; use that wrapper instead.
 */
export interface Spec extends TurboModule {
  /**
   * Requests a new scan and waits (up to ~12 s) for it to complete, then
   * returns the scan results. When Android throttles the request, the most
   * recent cached results are returned with `scanStarted: false`.
   */
  scan(): Promise<Object>;
  /** Returns the most recent results without requesting a scan. */
  getCachedScanResults(): Promise<Object>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeWifiModule');
