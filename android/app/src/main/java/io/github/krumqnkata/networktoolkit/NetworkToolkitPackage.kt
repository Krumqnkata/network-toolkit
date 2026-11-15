package io.github.krumqnkata.networktoolkit

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import io.github.krumqnkata.networktoolkit.network.NetworkModule

/** Registers the app's own Turbo Native Modules. Modules are created lazily on first use. */
class NetworkToolkitPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        when (name) {
            NetworkModule.NAME -> NetworkModule(reactContext)
            else -> null
        }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
        ReactModuleInfoProvider {
            listOf(NetworkModule.NAME).associateWith { name ->
                ReactModuleInfo(
                    name = name,
                    className = name,
                    canOverrideExistingModule = false,
                    needsEagerInit = false,
                    isCxxModule = false,
                    isTurboModule = true,
                )
            }
        }
}
