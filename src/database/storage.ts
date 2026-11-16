import { z } from 'zod';

import NativeStorageModule from '../native/specs/NativeStorageModule';
import { logError, toAppError } from '../utils/errors';

/** Record kinds stored in SQLite. Adding a kind needs no migration. */
export type RecordKind = 'speed-result' | 'monitor-session' | 'health-report' | 'wifi-survey';

export interface StoredRecord<T> {
  id: number;
  createdAt: number;
  data: T;
}

const rawRecordSchema = z.object({
  id: z.number(),
  kind: z.string(),
  createdAt: z.number(),
  data: z.string(),
});

async function native<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toAppError(error);
  }
}

/**
 * Typed access to one record kind. Every document is validated on read;
 * documents that no longer match the schema (e.g. after a format change) are
 * skipped instead of breaking the screen.
 */
export class Repository<T> {
  constructor(
    private readonly kind: RecordKind,
    private readonly schema: z.ZodType<T>,
    /** Oldest records beyond this count are deleted after each insert. */
    private readonly maxRecords: number,
  ) {}

  async add(data: T, createdAt = Date.now()): Promise<StoredRecord<T>> {
    const id = await native(() =>
      NativeStorageModule.insertRecord(this.kind, createdAt, JSON.stringify(data)),
    );
    native(() => NativeStorageModule.pruneRecords(this.kind, this.maxRecords)).catch(error =>
      logError('storage', error),
    );
    return { id, createdAt, data };
  }

  async update(id: number, data: T): Promise<void> {
    await native(() => NativeStorageModule.updateRecord(id, JSON.stringify(data)));
  }

  async list(limit = 50, before?: number): Promise<StoredRecord<T>[]> {
    const rows = await native(() => NativeStorageModule.listRecords(this.kind, limit, before ?? 0));
    const records: StoredRecord<T>[] = [];
    for (const row of rows) {
      const raw = rawRecordSchema.safeParse(row);
      if (!raw.success) continue;
      let json: unknown;
      try {
        json = JSON.parse(raw.data.data);
      } catch {
        continue;
      }
      const parsed = this.schema.safeParse(json);
      if (parsed.success) {
        records.push({ id: raw.data.id, createdAt: raw.data.createdAt, data: parsed.data });
      } else {
        logError('storage', `Skipping invalid ${this.kind} record ${raw.data.id}`);
      }
    }
    return records;
  }

  async remove(id: number): Promise<void> {
    await native(() => NativeStorageModule.deleteRecord(id));
  }

  async clear(): Promise<void> {
    await native(() => NativeStorageModule.clearRecords(this.kind));
  }
}

export function getSetting(key: string): Promise<string | null> {
  return native(() => NativeStorageModule.getSetting(key));
}

export function setSetting(key: string, value: string | null): Promise<void> {
  return native(() => NativeStorageModule.setSetting(key, value));
}
