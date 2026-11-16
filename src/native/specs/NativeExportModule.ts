import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for the Kotlin `ExportModule`
 * (android/app/src/main/java/.../export/ExportModule.kt).
 */
export interface Spec extends TurboModule {
  /**
   * Writes `contents` (UTF-8 text, or base64 when `base64` is true) to a cache
   * file named `fileName` (.png, .svg, .txt or .json) and opens the share sheet.
   */
  shareFile(fileName: string, contents: string, base64: boolean, title: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeExportModule');
