package io.github.krumqnkata.networktoolkit

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import io.github.krumqnkata.networktoolkit.lan.LanModule
import io.github.krumqnkata.networktoolkit.network.NetworkModule
import io.github.krumqnkata.networktoolkit.tools.NetToolsModule
import io.github.krumqnkata.networktoolkit.wifi.WifiModule

/** Registers the app's own Turbo Native Modules. Modules are created lazily on first use. */
class NetworkToolkitPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        when (name) {
            NetworkModule.NAME -> NetworkModule(reactContext)
            WifiModule.NAME -> WifiModule(reactContext)
            NetToolsModule.NAME -> NetToolsModule(reactContext)
            LanModule.NAME -> LanModule(reactContext)
            else -> null
        }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
        ReactModuleInfoProvider {
            listOf(NetworkModule.NAME, WifiModule.NAME, NetToolsModule.NAME, LanModule.NAME).associateWith { name ->
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
