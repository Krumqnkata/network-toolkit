package io.github.krumqnkata.networktoolkit.export

import android.content.ClipData
import android.content.Intent
import android.util.Base64
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import io.github.krumqnkata.networktoolkit.specs.NativeExportModuleSpec
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Writes an exported file (map image, report) to the app's cache and opens
 * the Android share sheet for it, so it can be saved to Files or Drive or sent
 * in a chat. Other apps can read it only through a temporary URI grant.
 */
class ExportModule(reactContext: ReactApplicationContext) : NativeExportModuleSpec(reactContext) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "ExportModule").apply { isDaemon = true }
    }

    override fun getName(): String = NAME

    override fun shareFile(fileName: String, contents: String, base64: Boolean, title: String, promise: Promise) {
        executor.execute {
            try {
                val name = ExportFiles.safeName(fileName)
                val bytes = if (base64) Base64.decode(contents, Base64.DEFAULT) else contents.toByteArray(Charsets.UTF_8)
                require(bytes.size <= ExportFiles.MAX_BYTES) { "File is too large" }
                val directory = File(reactApplicationContext.cacheDir, ExportFiles.DIRECTORY).apply { mkdirs() }
                // Earlier exports are not needed once shared; keep the cache small.
                directory.listFiles()?.forEach { it.delete() }
                val file = File(directory, name)
                file.writeBytes(bytes)
                val uri = FileProvider.getUriForFile(
                    reactApplicationContext,
                    "${reactApplicationContext.packageName}.exports",
                    file,
                )
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = ExportFiles.mimeType(name)
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_TITLE, title)
                    clipData = ClipData.newRawUri(title, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                val chooser = Intent.createChooser(send, title).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                val activity = reactApplicationContext.currentActivity
                if (activity != null) activity.startActivity(chooser) else reactApplicationContext.startActivity(chooser)
                promise.resolve(null)
            } catch (error: IllegalArgumentException) {
                promise.reject("E_INVALID_INPUT", error.message ?: "Invalid export", error)
            } catch (error: Exception) {
                promise.reject("E_EXPORT", error.message ?: "Export failed", error)
            }
        }
    }

    override fun invalidate() {
        executor.shutdownNow()
        super.invalidate()
    }

    companion object {
        const val NAME = "NativeExportModule"
    }
}
