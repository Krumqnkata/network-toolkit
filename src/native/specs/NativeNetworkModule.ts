import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for the Kotlin `NetworkModule`
 * (android/app/src/main/java/.../network/NetworkModule.kt).
 *
 * Results are returned as untyped objects and validated in `src/native/network.ts`;
 * the rest of the app must use that wrapper, never this module directly.
 */
export interface Spec extends TurboModule {
  /** Snapshot of the active network: transport, addresses, routes, DNS and Wi-Fi link. */
  getNetworkSnapshot(): Promise<Object>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeNetworkModule');
