package io.github.krumqnkata.networktoolkit

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(NetworkToolkitPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // App fonts (res/font), used from JS as fontFamily "Inter" and "JetBrains Mono".
    ReactFontManager.getInstance().addCustomFont(this, "Inter", R.font.inter)
    ReactFontManager.getInstance().addCustomFont(this, "JetBrains Mono", R.font.jetbrains_mono)
    loadReactNative(this)
  }
}
