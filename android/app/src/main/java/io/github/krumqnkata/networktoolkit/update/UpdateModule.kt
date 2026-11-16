package io.github.krumqnkata.networktoolkit.update

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import io.github.krumqnkata.networktoolkit.specs.NativeUpdateModuleSpec
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

/**
 * Self-updater for builds distributed through GitHub Releases.
 *
 * 1. `startDownload` fetches an APK from this repository's releases (HTTPS,
 *    URL allow-listed) into the app's cache and checks its SHA-256 against the
 *    release's checksums.txt.
 * 2. `install` additionally checks that the APK is this app, newer, and signed
 *    with the same certificate, then installs it with [PackageInstaller]. On
 *    Android 12+ the update is applied without a confirmation dialog once the
 *    user has allowed "Install unknown apps" (REQUEST_INSTALL_PACKAGES +
 *    UPDATE_PACKAGES_WITHOUT_USER_ACTION, app updating itself). Otherwise
 *    Android shows its install confirmation.
 */
class UpdateModule(reactContext: ReactApplicationContext) : NativeUpdateModuleSpec(reactContext) {
    private val context = reactContext.applicationContext
    private val executor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "UpdateModule").apply { isDaemon = true }
    }
    private val updatesDir get() = File(context.cacheDir, "updates")

    override fun getName(): String = NAME

    override fun getInstallInfo(promise: Promise) {
        try {
            val info = packageInfo(context.packageName, 0)
            promise.resolve(
                Arguments.createMap().apply {
                    putString("versionName", info.versionName)
                    putDouble("versionCode", versionCode(info).toDouble())
                    putArray("abis", Arguments.createArray().apply { Build.SUPPORTED_ABIS.forEach { pushString(it) } })
                    putInt("sdkInt", Build.VERSION.SDK_INT)
                    putBoolean("canRequestInstalls", context.packageManager.canRequestPackageInstalls())
                    putBoolean("silentUpdates", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                    putBoolean(
                        "debuggable",
                        (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0,
                    )
                },
            )
        } catch (error: Exception) {
            promise.reject("E_UPDATE", error.message ?: "Could not read app info", error)
        }
    }

    override fun startDownload(url: String, sha256: String, fileName: String, promise: Promise) {
        if (!UpdateRules.isAllowedUrl(url) || !UpdateRules.isValidFileName(fileName)) {
            promise.reject("E_INVALID_INPUT", "Update URL is not an APK from this app's releases")
            return
        }
        if (!UpdateRules.isValidSha256(sha256)) {
            promise.reject("E_INVALID_INPUT", "Invalid SHA-256 checksum")
            return
        }
        if (UpdateState.download.state == "downloading") {
            promise.reject("E_BUSY", "A download is already running")
            return
        }
        UpdateState.download = DownloadStatus("downloading", 0, 0, null, null)
        executor.execute { download(url, sha256, fileName) }
        promise.resolve(null)
    }

    override fun getDownloadStatus(promise: Promise) {
        val status = UpdateState.download
        promise.resolve(
            Arguments.createMap().apply {
                putString("state", status.state)
                putDouble("bytes", status.bytes.toDouble())
                putDouble("total", status.total.toDouble())
                putString("path", status.path)
                putString("error", status.error)
            },
        )
    }

    override fun canRequestInstalls(promise: Promise) {
        promise.resolve(context.packageManager.canRequestPackageInstalls())
    }

    override fun openInstallSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            promise.resolve(null)
        } catch (error: Exception) {
            promise.reject("E_UPDATE", error.message ?: "Could not open settings", error)
        }
    }

    override fun install(path: String, promise: Promise) {
        executor.execute {
            try {
                val file = File(path).canonicalFile
                require(file.parentFile == updatesDir.canonicalFile && file.isFile) { "Unknown update file" }
                verifyApk(file)
                UpdateState.install = InstallStatus("installing", null)
                commit(file)
                promise.resolve(null)
            } catch (error: UpdateRejected) {
                UpdateState.install = InstallStatus("failure", error.message)
                promise.reject(error.code, error.message ?: "Invalid update", error)
            } catch (error: IllegalArgumentException) {
                UpdateState.install = InstallStatus("failure", error.message)
                promise.reject("E_INVALID_INPUT", error.message ?: "Invalid update", error)
            } catch (error: Exception) {
                UpdateState.install = InstallStatus("failure", error.message)
                promise.reject("E_UPDATE", error.message ?: "Install failed", error)
            }
        }
    }

    override fun getInstallStatus(promise: Promise) {
        val status = UpdateState.install
        promise.resolve(
            Arguments.createMap().apply {
                putString("state", status.state)
                putString("message", status.message)
            },
        )
    }

    private fun download(url: String, sha256: String, fileName: String) {
        val dir = updatesDir
        try {
            dir.mkdirs()
            // Only the newest update is kept.
            dir.listFiles()?.forEach { it.delete() }
            val target = File(dir, fileName)
            val partial = File(dir, "$fileName.part")
            val digest = MessageDigest.getInstance("SHA-256")
            val connection = URL(url).openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 15_000
                connection.readTimeout = 30_000
                connection.instanceFollowRedirects = true
                connection.setRequestProperty("User-Agent", USER_AGENT)
                val code = connection.responseCode
                if (code != HttpURLConnection.HTTP_OK) throw IOException("Download failed: HTTP $code")
                if (connection.url.protocol != "https") throw IOException("Download was redirected to an insecure URL")
                val total = connection.contentLengthLong.coerceAtLeast(0)
                if (total > MAX_APK_BYTES) throw IOException("Update file is unexpectedly large")
                var received = 0L
                connection.inputStream.use { input ->
                    partial.outputStream().use { output ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            val read = input.read(buffer)
                            if (read < 0) break
                            output.write(buffer, 0, read)
                            digest.update(buffer, 0, read)
                            received += read
                            if (received > MAX_APK_BYTES) throw IOException("Update file is unexpectedly large")
                            UpdateState.download = DownloadStatus("downloading", received, total, null, null)
                        }
                    }
                }
            } finally {
                connection.disconnect()
            }
            val actual = UpdateRules.hex(digest.digest())
            if (actual != sha256) {
                partial.delete()
                throw IOException("Checksum mismatch: the download is damaged or was altered")
            }
            if (!partial.renameTo(target)) throw IOException("Could not store the update")
            UpdateState.download = DownloadStatus("done", target.length(), target.length(), target.absolutePath, null)
        } catch (error: Exception) {
            UpdateState.download = DownloadStatus("error", 0, 0, null, error.message ?: error.javaClass.simpleName)
        }
    }

    /** Same package, newer version, same signing certificate as the installed app. */
    private fun verifyApk(file: File) {
        val flags = signingFlags()
        val candidate = archiveInfo(file, flags)
            ?: throw UpdateRejected("E_UPDATE_INVALID_APK", "The file is not a valid APK")
        if (candidate.packageName != context.packageName) {
            throw UpdateRejected("E_UPDATE_PACKAGE", "The APK belongs to another app")
        }
        val installed = packageInfo(context.packageName, flags)
        if (versionCode(candidate) <= versionCode(installed)) {
            throw UpdateRejected("E_UPDATE_NOT_NEWER", "The APK is not newer than the installed version")
        }
        if (!UpdateRules.sameSigners(signers(installed), signers(candidate))) {
            throw UpdateRejected("E_UPDATE_SIGNATURE", "The APK is not signed with this app's key")
        }
    }

    /** A downloaded APK that must not be installed; `code` lets the UI explain why. */
    private class UpdateRejected(val code: String, message: String) : Exception(message)

    private fun commit(file: File) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(context.packageName)
            setSize(file.length())
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
            }
        }
        val sessionId = installer.createSession(params)
        installer.openSession(sessionId).use { session ->
            file.inputStream().use { input ->
                session.openWrite("base.apk", 0, file.length()).use { output ->
                    input.copyTo(output)
                    session.fsync(output)
                }
            }
            val intent = Intent(context, InstallResultReceiver::class.java).setPackage(context.packageName)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
            val pending = PendingIntent.getBroadcast(context, sessionId, intent, flags)
            session.commit(pending.intentSender)
        }
    }

    private fun signingFlags(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            @Suppress("DEPRECATION")
            PackageManager.GET_SIGNATURES
        }

    private fun signers(info: PackageInfo): Set<String> {
        val raw = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signing = info.signingInfo ?: return emptySet()
            if (signing.hasMultipleSigners()) signing.apkContentsSigners else signing.signingCertificateHistory
        } else {
            @Suppress("DEPRECATION")
            info.signatures
        }
        return raw.orEmpty().map { UpdateRules.sha256(it.toByteArray()) }.toSet()
    }

    private fun packageInfo(name: String, flags: Int): PackageInfo =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.getPackageInfo(name, PackageManager.PackageInfoFlags.of(flags.toLong()))
        } else {
            @Suppress("DEPRECATION")
            context.packageManager.getPackageInfo(name, flags)
        }

    private fun archiveInfo(file: File, flags: Int): PackageInfo? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.getPackageArchiveInfo(file.absolutePath, PackageManager.PackageInfoFlags.of(flags.toLong()))
        } else {
            @Suppress("DEPRECATION")
            context.packageManager.getPackageArchiveInfo(file.absolutePath, flags)
        }

    private fun versionCode(info: PackageInfo): Long =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            info.versionCode.toLong()
        }

    override fun invalidate() {
        executor.shutdownNow()
        super.invalidate()
    }

    companion object {
        const val NAME = "NativeUpdateModule"
        private const val MAX_APK_BYTES = 200L * 1024 * 1024
        private const val USER_AGENT = "NetworkToolkit (Android; +https://github.com/Krumqnkata/network-toolkit)"
    }
}
