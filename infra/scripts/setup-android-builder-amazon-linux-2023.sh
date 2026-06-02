#!/usr/bin/env bash
# One-time setup on Amazon Linux 2023 EC2 for Expo / Gradle Android builds.
# Run as ec2-user with sudo where noted.
set -euo pipefail

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
JAVA_VER="${JAVA_VER:-17}"

sudo dnf install -y git gcc gcc-c++ make zlib-devel zip unzip

# Node.js + npm (Amazon Linux 2023). Expo 54 expects Node 18+.
if ! command -v node >/dev/null 2>&1; then
  sudo dnf install -y nodejs npm
fi
node --version

sudo dnf install -y "java-${JAVA_VER}-amazon-corretto-devel"

sudo mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
CMD_TOOLS_ZIP="/tmp/cmdline-tools.zip"
curl -fsSL -o "$CMD_TOOLS_ZIP" "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
sudo unzip -oq "$CMD_TOOLS_ZIP" -d "$ANDROID_SDK_ROOT/cmdline-tools"
sudo mv "$ANDROID_SDK_ROOT/cmdline-tools/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
rm -f "$CMD_TOOLS_ZIP"

export ANDROID_SDK_ROOT
export PATH="$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools"

yes | sdkmanager --sdk_root="$ANDROID_SDK_ROOT" \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0" \
  "ndk;26.1.10909125"

echo "Append these lines to ~/.bashrc:"
cat <<EOF

export ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT
export ANDROID_HOME=\$ANDROID_SDK_ROOT
export PATH=\$PATH:\$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:\$ANDROID_SDK_ROOT/platform-tools
EOF
