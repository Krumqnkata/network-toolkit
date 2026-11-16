import { toAppError } from '../utils/errors';
import NativeExportModule from './specs/NativeExportModule';

/** Saves a file to the cache and opens the Android share sheet (Files, Drive, chats…). */
export async function shareFile(
  fileName: string,
  contents: string,
  options: { base64?: boolean; title?: string } = {},
): Promise<void> {
  try {
    await NativeExportModule.shareFile(
      fileName,
      contents,
      options.base64 ?? false,
      options.title ?? fileName,
    );
  } catch (error) {
    throw toAppError(error);
  }
}
