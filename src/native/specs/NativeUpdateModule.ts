import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for the Kotlin `UpdateModule`
 * (android/app/src/main/java/.../update/UpdateModule.kt). Use `src/native/update.ts`.
 */
export interface Spec extends TurboModule {
  getInstallInfo(): Promise<Object>;
  /** Starts downloading an APK from this app's GitHub releases; poll `getDownloadStatus`. */
  startDownload(url: string, sha256: string, fileName: string): Promise<void>;
  getDownloadStatus(): Promise<Object>;
  /** Whether "Install unknown apps" is allowed for this app. */
  canRequestInstalls(): Promise<boolean>;
  openInstallSettings(): Promise<void>;
  /** Verifies the downloaded APK (package, version, signature) and installs it. */
  install(path: string): Promise<void>;
  getInstallStatus(): Promise<Object>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeUpdateModule');
