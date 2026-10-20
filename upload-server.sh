#!/usr/bin/env bash
# One source snapshot, independent public/intranet artifacts and latest pointers.
set +x
set -euo pipefail
export LC_ALL=C
umask 077
PROJECT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
cd "$PROJECT_DIR"
ENVIRONMENT=all
BUILD_ONLY=false
while (( $# )); do
  case "$1" in
    --env) [[ $# -ge 2 ]] || exit 1; ENVIRONMENT=$2; shift 2 ;;
    --build-only) BUILD_ONLY=true; shift ;;
    -h|--help) printf 'Usage: ./upload-server.sh [--env all|public|intranet] [--build-only]\n'; exit 0 ;;
    *) printf 'Unknown argument; use --help.\n' >&2; exit 1 ;;
  esac
done
case "$ENVIRONMENT" in all) TARGETS=(public intranet) ;; public|intranet) TARGETS=("$ENVIRONMENT") ;; *) printf 'Unknown environment.\n' >&2; exit 1 ;; esac
die() { printf '%s\n' "$*" >&2; exit 1; }
hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'; else shasum -a 256 "$1" | awk '{print $1}'; fi
}
node_is_supported() {
  command -v node >/dev/null && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)'
}
if ! node_is_supported || ! command -v pnpm >/dev/null; then
  NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [[ -s $NVM_SCRIPT ]]; then
    set +u
    . "$NVM_SCRIPT" --no-use && nvm use --silent || die 'Could not activate the installed project Node version.'
    set -u
  fi
fi
node_is_supported || die 'Node.js >= 22.13.0 is required.'
for cmd in git pnpm zip curl cmp sort cp; do command -v "$cmd" >/dev/null || die "Missing command: $cmd"; done
OSS_BUCKET=${OSS_BUCKET:-asynctest}
OSS_ENDPOINT=${OSS_ENDPOINT:-oss-cn-shenzhen.aliyuncs.com}
OSS_PATH=${OSS_PATH:-linux_files/nexofolio/front}; OSS_PATH=${OSS_PATH%/}
OSSUTIL_BIN=${OSSUTIL_BIN:-ossutil}
[[ $OSS_BUCKET =~ ^[a-z0-9][a-z0-9-]+$ && $OSS_ENDPOINT =~ ^[A-Za-z0-9.-]+$ && $OSS_PATH =~ ^[A-Za-z0-9/_-]+$ && $OSS_PATH != *..* ]] || die 'Invalid OSS destination.'
if [[ -z ${OSS_CONFIG_FILE:-} && -f $HOME/.config/nexofolio/ossutil.config ]]; then OSS_CONFIG_FILE="$HOME/.config/nexofolio/ossutil.config"; fi
if [[ $BUILD_ONLY == false ]]; then command -v "$OSSUTIL_BIN" >/dev/null || die 'Install/configure ossutil first.'; fi
WORKSPACE_ENABLED=${VITE_WORKSPACE_ENABLED:-true}
PROJECTS_QUERY_API=${VITE_PROJECTS_QUERY_API:-false}
case "$WORKSPACE_ENABLED:$PROJECTS_QUERY_API" in true:true|true:false|false:true|false:false) ;; *) die 'Build feature flags must be true or false.' ;; esac
ARTIFACTS="$PROJECT_DIR/artifacts/front-releases"
mkdir -p "$ARTIFACTS"
LOCK_DIR="$ARTIFACTS/.publish-lock"
mkdir "$LOCK_DIR" 2>/dev/null || die 'A frontend publication is already running.'
WORK=''
cleanup() {
  local code=$?
  trap - EXIT
  set +e
  if (( code )) && [[ -n $WORK ]]; then
    local logs="$ARTIFACTS/failed-$(date -u +%Y%m%dT%H%M%SZ)-$$" file
    mkdir -p "$logs"
    for file in "$WORK/"*.log; do [[ ! -f $file ]] || cp "$file" "$logs/"; done
    printf 'Build/publication failed. Protected logs: %s\n' "$logs" >&2
  fi
  [[ -z $WORK ]] || rm -rf -- "$WORK"
  rmdir "$LOCK_DIR" 2>/dev/null || true
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
WORK=$(mktemp -d "$ARTIFACTS/.build.XXXXXX")
source_inventory() {
  local name parent
  git ls-files -z --cached --others --exclude-standard > "$WORK/git-files"
  : > "$WORK/names"
  while IFS= read -r -d '' name; do
    case "$name" in */.*|.*) [[ $name == .nvmrc ]] || continue ;; esac
    case "$name" in src/*|public/*|build/*|tests/*|scripts/*|index.html|package.json|pnpm-lock.yaml|pnpm-workspace.yaml|tsconfig*.json|vite.config.ts|vitest.config.ts|.nvmrc|upload-server.sh|deploy/update-front.sh) ;; *) continue ;; esac
    [[ -e $name || -L $name ]] || continue
    [[ $name =~ ^[A-Za-z0-9_./-]+$ && $name != *..* && $name != /* && -f $name && ! -L $name ]] || die 'Unsupported or symlinked build source.'
    parent=$name
    while [[ $parent == */* ]]; do parent=${parent%/*}; [[ ! -L $parent ]] || die 'Symlinked build source directory.'; done
    printf '%s\n' "$name" >> "$WORK/names"
  done < "$WORK/git-files"
  sort -u "$WORK/names" -o "$WORK/names"
  while IFS= read -r name; do printf '%s\t%s\n' "$(hash_file "$name")" "$name"; done < "$WORK/names"
}
printf 'Capturing one stable frontend source snapshot...\n'
source_inventory > "$WORK/sources.tsv"
mkdir "$WORK/source"
while IFS=$'\t' read -r digest name; do
  mkdir -p "$WORK/source/$(dirname "$name")"
  cp "$name" "$WORK/source/$name"
  [[ $(hash_file "$WORK/source/$name") == "$digest" ]] || die 'Source changed while copying; retry after edits finish.'
done < "$WORK/sources.tsv"
source_inventory > "$WORK/after.tsv"
cmp -s "$WORK/sources.tsv" "$WORK/after.tsv" || die 'Source changed during snapshot creation.'
SOURCE_SHA=$(hash_file "$WORK/sources.tsv")
GIT_HEAD=$(git rev-parse HEAD)
printf 'Installing locked dependencies in the isolated snapshot...\n'
(cd "$WORK/source" && pnpm install --frozen-lockfile) > "$WORK/dependencies.log" 2>&1 || die 'Snapshot dependency installation failed; raw output withheld.'
printf 'Checking shared source types...\n'
(cd "$WORK/source" && pnpm typecheck) > "$WORK/typecheck.log" 2>&1 || die 'Frontend typecheck failed; raw output withheld.'
PACKAGES=()
for target in "${TARGETS[@]}"; do
  case "$target" in public) base=/; api=/api ;; intranet) base=/nexofolio/; api=/nexofolio/api ;; esac
  build_dir="$WORK/$target"
  mkdir "$build_dir"
  printf 'Building %s: app=%s api=%s\n' "$target" "$base" "$api"
  (
    while IFS= read -r variable; do case "$variable" in VITE_*) unset "$variable" ;; esac; done < <(compgen -v)
    export VITE_API_BASE_URL="$api" VITE_PROJECTS_SOURCE=live VITE_DOCUMENTS_SOURCE=live
    export VITE_WORKSPACE_ENABLED="$WORKSPACE_ENABLED" VITE_PROJECTS_QUERY_API="$PROJECTS_QUERY_API"
    cd "$WORK/source"
    pnpm exec vite build --base "$base" --outDir "$build_dir/dist" --emptyOutDir
  ) > "$WORK/build-$target.log" 2>&1 || die "Frontend $target build failed; raw output withheld."
  [[ -s $build_dir/dist/index.html && -s $build_dir/dist/mcp.md && -s $build_dir/dist/api.md ]] || die 'Frontend build output is incomplete.'
  printf 'format\t1\nenvironment\t%s\napp_base\t%s\napi_base\t%s\nsource_sha\t%s\ngit_head\t%s\n' "$target" "$base" "$api" "$SOURCE_SHA" "$GIT_HEAD" > "$build_dir/dist/.nexofolio-release.tsv"
  (cd "$build_dir" && zip -X -qr "$WORK/$target.zip" dist -x '*.DS_Store')
  checksum=$(hash_file "$WORK/$target.zip")
  release="$(date -u +%Y%m%dT%H%M%SZ)-${checksum:0:12}"
  package="$ARTIFACTS/$release"
  [[ ! -e $package ]] || die 'Release directory already exists.'
  mkdir "$package"
  mv "$WORK/$target.zip" "$package/dist.zip"
  printf '%s %s\n' "$release" "$checksum" > "$package/latest.txt"
  cp "$build_dir/dist/.nexofolio-release.tsv" "$package/manifest.tsv"
  printf 'release\t%s\npackage_sha\t%s\n' "$release" "$checksum" >> "$package/manifest.tsv"
  cp "$WORK/source/deploy/update-front.sh" "$package/update-front.sh"
  cp "$WORK/sources.tsv" "$package/sources.tsv"
  PACKAGES+=("$package")
  printf 'Built %s: %s\nSHA-256: %s\n' "$target" "$package/dist.zip" "$checksum"
done
while IFS=$'\t' read -r digest name; do [[ $(hash_file "$WORK/source/$name") == "$digest" ]] || die 'Build modified the captured source.'; done < "$WORK/sources.tsv"
printf 'Shared source SHA-256: %s\n' "$SOURCE_SHA"
[[ $BUILD_ONLY == false ]] || exit 0
OSS_ARGS=(-e "$OSS_ENDPOINT")
[[ -z ${OSS_CONFIG_FILE:-} ]] || OSS_ARGS+=(-c "$OSS_CONFIG_FILE")
upload() {
  local file=$1 relative=$2 immutable=${3:-true} output
  if [[ $immutable == true ]]; then
    if output=$("$OSSUTIL_BIN" stat "$CHANNEL_OSS/$relative" "${OSS_ARGS[@]}" 2>&1); then return; fi
    [[ $output == *NoSuchKey* ]] || die 'Cannot verify OSS object existence; publication stopped.'
  fi
  "$OSSUTIL_BIN" cp "$file" "$CHANNEL_OSS/$relative" "${OSS_ARGS[@]}" -f > "$WORK/upload.log" 2>&1 || die 'OSS upload failed; raw output withheld.'
}
verify_download() {
  curl --disable -fSs --noproxy '*' --proto '=https' --max-redirs 0 --connect-timeout 15 --max-time 300 --retry 2 --output "$WORK/download" "$CHANNEL_HTTP/$2" 2>/dev/null || die 'OSS read-back failed; publication stopped.'
  [[ $(hash_file "$WORK/download") == "$(hash_file "$1")" ]] || die 'OSS read-back checksum mismatch.'
}
channel() {
  local target=$1 suffix=''
  [[ $target != intranet ]] || suffix=/intranet
  CHANNEL_OSS="oss://$OSS_BUCKET/$OSS_PATH$suffix"
  CHANNEL_HTTP="https://$OSS_BUCKET.$OSS_ENDPOINT/$OSS_PATH$suffix"
}
# Both artifacts are verified before either latest pointer is changed.
for package in "${PACKAGES[@]}"; do
  target=$(awk -F '\t' '$1=="environment"{print $2}' "$package/manifest.tsv")
  channel "$target"; release=$(basename "$package")
  for file in dist.zip manifest.tsv update-front.sh; do upload "$package/$file" "releases/$release/$file"; verify_download "$package/$file" "releases/$release/$file"; done
  upload "$package/latest.txt" "releases/$release/release.txt"; verify_download "$package/latest.txt" "releases/$release/release.txt"
done
for package in "${PACKAGES[@]}"; do
  target=$(awk -F '\t' '$1=="environment"{print $2}' "$package/manifest.tsv")
  channel "$target"
  upload "$package/latest.txt" latest.txt false
  verify_download "$package/latest.txt" latest.txt
  printf 'Published %s: %s/releases/%s/dist.zip\nUpdater: %s/releases/%s/update-front.sh\nUpdater SHA-256: %s\n' "$target" "$CHANNEL_HTTP" "$(basename "$package")" "$CHANNEL_HTTP" "$(basename "$package")" "$(hash_file "$package/update-front.sh")"
done
printf 'After downloading the updater, enable execution once: chmod 755 /home/nexofolio/front/update-front.sh\n'
printf 'Server rollout remains manual: cd /home/nexofolio/front && ./update-front.sh\n'
