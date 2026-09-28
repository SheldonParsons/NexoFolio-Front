#!/usr/bin/env bash
# Build and publish a versioned frontend bundle; publish latest.txt last.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
OSS_BUCKET="${OSS_BUCKET:-asynctest}"
OSS_ENDPOINT="${OSS_ENDPOINT:-oss-cn-shenzhen.aliyuncs.com}"
OSS_PATH="${OSS_PATH:-linux_files/nexofolio/front}"
OSS_PATH="${OSS_PATH%/}"
OSSUTIL_BIN="${OSSUTIL_BIN:-ossutil}"
BUILD_ONLY=false
case "${1:-}" in
  --build-only) BUILD_ONLY=true ;;
  '') ;;
  *) echo "Usage: $0 [--build-only]" >&2; exit 1 ;;
esac

# New VSCode terminals may not load nvm. Recover the project's installed Node
# environment inside this script only, without changing shell startup files.
node_is_supported() {
  command -v node >/dev/null && node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)'
}
if ! node_is_supported || ! command -v pnpm >/dev/null; then
  NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [[ -s "$NVM_SCRIPT" ]]; then
    echo 'Loading the installed Node version from .nvmrc...'
    # nvm can reference unset variables during initialization.
    set +u
    if ! . "$NVM_SCRIPT" --no-use || ! nvm use --silent; then
      echo 'Could not activate project Node. Run: nvm install && corepack enable pnpm' >&2
      exit 1
    fi
    set -u
  fi
fi
for cmd in node pnpm zip shasum; do
  command -v "$cmd" >/dev/null || { echo "Missing command: $cmd" >&2; exit 1; }
done
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 13)) { console.error("Node.js >= 22.13.0 is required"); process.exit(1) }'
# Prefer the dedicated configuration created for this deployment; an explicit
# OSS_CONFIG_FILE still wins, and ossutil's default remains the final fallback.
if [[ -z "${OSS_CONFIG_FILE:-}" && -f "$HOME/.config/nexofolio/ossutil.config" ]]; then
  OSS_CONFIG_FILE="$HOME/.config/nexofolio/ossutil.config"
fi
if ! "$BUILD_ONLY"; then
  command -v "$OSSUTIL_BIN" >/dev/null || { echo 'Install/configure ossutil first.' >&2; exit 1; }
fi

mkdir -p artifacts/front-releases
WORK_DIR="$(mktemp -d "$PROJECT_DIR/artifacts/front-releases/.build.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

echo 'Installing locked dependencies and building production frontend...'
pnpm install --frozen-lockfile
# Explicit public values prevent local dev overrides leaking into deployment.
VITE_API_BASE_URL=/api VITE_PROJECTS_SOURCE=live VITE_DOCUMENTS_SOURCE=live \
  VITE_PROJECTS_QUERY_API="${VITE_PROJECTS_QUERY_API:-false}" pnpm build
test -s dist/index.html
zip -qr "$WORK_DIR/dist.zip" dist -x '*.DS_Store'
CHECKSUM="$(shasum -a 256 "$WORK_DIR/dist.zip" | awk '{print $1}')"
RELEASE_ID="$(date -u +%Y%m%dT%H%M%SZ)-${CHECKSUM:0:12}"
PACKAGE_DIR="$PROJECT_DIR/artifacts/front-releases/$RELEASE_ID"
mkdir "$PACKAGE_DIR"
mv "$WORK_DIR/dist.zip" "$PACKAGE_DIR/dist.zip"
printf '%s %s\n' "$RELEASE_ID" "$CHECKSUM" > "$PACKAGE_DIR/latest.txt"
echo "Built: $PACKAGE_DIR/dist.zip"
echo "SHA-256: $CHECKSUM"
if "$BUILD_ONLY"; then exit 0; fi

# Credentials come from ossutil config, never from source-controlled scripts.
OSS_ARGS=(-e "$OSS_ENDPOINT")
if [[ -n "${OSS_CONFIG_FILE:-}" ]]; then OSS_ARGS+=(-c "$OSS_CONFIG_FILE"); fi
OSS_ROOT="oss://$OSS_BUCKET/$OSS_PATH"
"$OSSUTIL_BIN" cp "$PACKAGE_DIR/dist.zip" "$OSS_ROOT/releases/$RELEASE_ID/dist.zip" "${OSS_ARGS[@]}" -f
"$OSSUTIL_BIN" cp "$PACKAGE_DIR/latest.txt" "$OSS_ROOT/latest.txt" "${OSS_ARGS[@]}" -f
echo "Published: $OSS_ROOT/releases/$RELEASE_ID/dist.zip"
echo 'On the server, run: bash /home/nexofolio/front/update-front.sh'
