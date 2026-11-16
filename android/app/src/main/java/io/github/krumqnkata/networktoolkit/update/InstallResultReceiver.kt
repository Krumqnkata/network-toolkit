package io.github.krumqnkata.networktoolkit.update

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

/**
 * Receives the result of a self-update install session. When Android needs the
 * user to confirm (Android 8–11, or before "Install unknown apps" is allowed),
 * it starts the system confirmation screen.
 */
class InstallResultReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        when (status) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val confirm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                }
                UpdateState.install = InstallStatus("pending-user-action", null)
                confirm?.let {
                    it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(it)
                }
            }
            PackageInstaller.STATUS_SUCCESS -> UpdateState.install = InstallStatus("success", null)
            else -> UpdateState.install = InstallStatus(
                "failure",
                intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "Install failed ($status)",
            )
        }
    }
}

data class InstallStatus(val state: String, val message: String?)

data class DownloadStatus(
    /** `idle`, `downloading`, `done` or `error`. */
    val state: String,
    val bytes: Long,
    val total: Long,
    val path: String?,
    val error: String?,
)

/** Process-wide state shared by the module and the receiver. */
object UpdateState {
    @Volatile var download = DownloadStatus("idle", 0, 0, null, null)
    @Volatile var install = InstallStatus("idle", null)
}
