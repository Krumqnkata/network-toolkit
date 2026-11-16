#!/usr/bin/env bash
# Installs the NDK and CMake versions the Android build needs, with retries.
#
# The Android Gradle Plugin downloads a missing NDK on its own, but a corrupt
# download ("Error reading Zip content") then fails the whole build. Installing
# it up front lets us retry and verify that the NDK is complete.
set -euo pipefail

NDK_VERSION="$(sed -n 's/.*ndkVersion *= *"\([^"]*\)".*/\1/p' android/build.gradle)"
CMAKE_VERSION="3.22.1"
SDKMANAGER="${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager"

if [[ -z "${NDK_VERSION}" ]]; then
  echo "::error::Could not read ndkVersion from android/build.gradle"
  exit 1
fi

NDK_DIR="${ANDROID_HOME}/ndk/${NDK_VERSION}"
CMAKE_DIR="${ANDROID_HOME}/cmake/${CMAKE_VERSION}"

installed() {
  [[ -f "${NDK_DIR}/source.properties" ]] && [[ -x "${CMAKE_DIR}/bin/cmake" ]]
}

if installed; then
  echo "NDK ${NDK_VERSION} and CMake ${CMAKE_VERSION} are already installed."
  exit 0
fi

for attempt in 1 2 3; do
  echo "Installing NDK ${NDK_VERSION} and CMake ${CMAKE_VERSION} (attempt ${attempt})"
  "${SDKMANAGER}" --install "ndk;${NDK_VERSION}" "cmake;${CMAKE_VERSION}" > sdkmanager.log 2>&1 || true
  if installed; then
    echo "Installed."
    rm -f sdkmanager.log
    exit 0
  fi
  echo "::warning::Attempt ${attempt} did not produce a complete install:"
  tail -n 20 sdkmanager.log || true
  rm -rf "${NDK_DIR}"
  sleep $((attempt * 15))
done

echo "::error::Could not install NDK ${NDK_VERSION} after 3 attempts"
exit 1
