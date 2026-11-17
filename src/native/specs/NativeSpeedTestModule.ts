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
  /**
   * Automatic tests every 6, 12 or 24 hours on an unmetered network (0 = off).
   * Resolves with the schedule now in effect.
   */
  setSchedule(hours: number): Promise<number>;
  /** Hours between automatic tests, or 0 when off. */
  getSchedule(): Promise<number>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeSpeedTestModule');
