#!/usr/bin/env bash
# Build a debug APK on EC2 after setup-android-builder-amazon-linux-2023.sh
# Set API_PUBLIC_URL to http://YOUR_ELASTIC_IP:5020 (no trailing slash).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_PUBLIC_URL="${API_PUBLIC_URL:?Set API_PUBLIC_URL e.g. http://1.2.3.4:5020}"

cd "$ROOT/frontCrops"

export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools"

echo "EXPO_PUBLIC_API_URL=$API_PUBLIC_URL" > .env.local

npm ci
npx expo prebuild --platform android --non-interactive
cd android
chmod +x gradlew
./gradlew assembleDebug

APK="$(find app/build/outputs/apk/debug -name '*.apk' | head -1)"
echo "APK: $APK"
ls -la "$APK"
