import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for the Kotlin `SpeedTestModule`
 * (android/app/src/main/java/.../speed/SpeedTestModule.kt).
 * Validated in `src/native/speedTest.ts`; use that wrapper.
 */
export interface Spec extends TurboModule {
  /** Starts a test in the background and resolves with the first status. */
  start(phaseSeconds: number, streams: number): Promise<Object>;
  /** Snapshot of the running or last test. */
  getStatus(): Promise<Object>;
  cancel(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeSpeedTestModule');
