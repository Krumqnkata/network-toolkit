import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for the Kotlin `StorageModule`
 * (android/app/src/main/java/.../storage/StorageModule.kt), a thin layer over
 * Android's built-in SQLite. Use the repositories in `src/database` instead.
 */
export interface Spec extends TurboModule {
  /** Returns the new record id. `data` is a JSON string. */
  insertRecord(kind: string, createdAt: number, data: string): Promise<number>;
  updateRecord(id: number, data: string): Promise<boolean>;
  /** Newest first. `before` = 0 for the newest page, else a `createdAt` to page from. */
  listRecords(kind: string, limit: number, before: number): Promise<Object[]>;
  deleteRecord(id: number): Promise<boolean>;
  clearRecords(kind: string): Promise<number>;
  /** Deletes all but the newest `keep` records of a kind. */
  pruneRecords(kind: string, keep: number): Promise<number>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string | null): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeStorageModule');
