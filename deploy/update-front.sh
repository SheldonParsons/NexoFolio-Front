#!/usr/bin/env bash
# Standalone Linux updater: Bash + curl + unzip, with a persistent release channel.
set +x
set -euo pipefail
export LC_ALL=C
umask 022
DEPLOY_DIR=${DEPLOY_DIR:-/home/nexofolio/front}
OSS_BUCKET=${OSS_BUCKET:-asynctest}
OSS_ENDPOINT=${OSS_ENDPOINT:-oss-cn-shenzhen.aliyuncs.com}
OSS_PATH=${OSS_PATH:-linux_files/nexofolio/front}; OSS_PATH=${OSS_PATH%/}
ACTION=update
REQUESTED_ENV=''
REQUESTED_RELEASE=''
die() { printf '%s\n' "$*" >&2; exit 1; }
while (( $# )); do
  case "$1" in
    update|status) ACTION=$1; shift ;;
    --rollback|rollback) ACTION=rollback; shift ;;
    --env) [[ $# -ge 2 ]] || die 'Missing environment.'; REQUESTED_ENV=$2; shift 2 ;;
    --release) [[ $# -ge 2 ]] || die 'Missing release.'; REQUESTED_RELEASE=$2; shift 2 ;;
    -h|--help) printf 'Usage: bash update-front.sh [update|status|--rollback] [--env public|intranet] [--release ID]\n'; exit 0 ;;
    *) die 'Unknown argument; use --help.' ;;
  esac
done
case "$REQUESTED_ENV" in ''|public|intranet) ;; *) die 'Unknown environment.' ;; esac
[[ -z $REQUESTED_RELEASE || $REQUESTED_RELEASE =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ ]] || die 'Invalid release ID.'
[[ $ACTION == update || -z $REQUESTED_RELEASE ]] || die '--release is only valid for update.'
[[ $DEPLOY_DIR == /* && $DEPLOY_DIR != / && $OSS_BUCKET =~ ^[a-z0-9][a-z0-9-]+$ && $OSS_ENDPOINT =~ ^[A-Za-z0-9.-]+$ && $OSS_PATH =~ ^[A-Za-z0-9/_-]+$ && $OSS_PATH != *..* ]] || die 'Invalid deployment path or OSS destination.'
mkdir -p "$DEPLOY_DIR/releases"
DEPLOY_DIR=$(cd "$DEPLOY_DIR" && pwd -P)
CHANNEL_FILE="$DEPLOY_DIR/.environment"
if [[ -e $CHANNEL_FILE || -L $CHANNEL_FILE ]]; then
  [[ -f $CHANNEL_FILE && ! -L $CHANNEL_FILE ]] || die 'Invalid environment binding.'
  ENVIRONMENT=$(cat "$CHANNEL_FILE")
  case "$ENVIRONMENT" in public|intranet) ;; *) die 'Invalid environment binding.' ;; esac
elif [[ -e $DEPLOY_DIR/current || -L $DEPLOY_DIR/current ]]; then
  ENVIRONMENT=public
else
  ENVIRONMENT=${REQUESTED_ENV:-public}
fi
[[ -z $REQUESTED_ENV || $REQUESTED_ENV == "$ENVIRONMENT" ]] || die 'This directory belongs to another environment; refusing to switch channels.'
case "$ENVIRONMENT" in
  public) APP_BASE=/; API_BASE=/api; SUFFIX='' ;;
  intranet) APP_BASE=/nexofolio/; API_BASE=/nexofolio/api; SUFFIX=/intranet ;;
esac
OSS_ROOT="https://$OSS_BUCKET.$OSS_ENDPOINT/$OSS_PATH$SUFFIX"
LOCK_DIR="$DEPLOY_DIR/.update-lock"
mkdir "$LOCK_DIR" 2>/dev/null || die 'Another frontend update is running.'
WORK=''
trap 'code=$?; trap - EXIT; [[ -z $WORK ]] || rm -rf -- "$WORK"; rmdir "$LOCK_DIR" 2>/dev/null || true; exit "$code"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
WORK=$(mktemp -d "$DEPLOY_DIR/.update.XXXXXX")
for name in current previous; do
  [[ ! -e $DEPLOY_DIR/$name || -L $DEPLOY_DIR/$name ]] || die "$name must be a symlink."
done
hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'; else shasum -a 256 "$1" | awk '{print $1}'; fi
}
validate_tree() {
  local root=$1 key value extra seen='|' format='' environment='' app_base='' api_base='' source_sha='' git_head=''
  [[ -d $root/dist && ! -L $root/dist && -s $root/dist/index.html && ! -L $root/dist/index.html ]] || die 'Release entry point is missing or invalid.'
  if [[ ! -e $root/dist/.nexofolio-release.tsv && ! -L $root/dist/.nexofolio-release.tsv ]]; then
    [[ $ENVIRONMENT == public ]] || die 'Intranet packages require an environment manifest.'
    return
  fi
  [[ -f $root/dist/.nexofolio-release.tsv && ! -L $root/dist/.nexofolio-release.tsv ]] || die 'Invalid package environment manifest.'
  while IFS=$'\t' read -r key value extra || [[ -n $key ]]; do
    [[ -n $key && -n $value && -z $extra && $seen != *"|$key|"* ]] || die 'Invalid package environment fields.'
    seen="$seen$key|"
    case "$key" in
      format) format=$value ;; environment) environment=$value ;; app_base) app_base=$value ;;
      api_base) api_base=$value ;; source_sha) source_sha=$value ;; git_head) git_head=$value ;;
      *) die 'Unknown package environment field.' ;;
    esac
  done < "$root/dist/.nexofolio-release.tsv"
  [[ $format == 1 && $environment == "$ENVIRONMENT" && $app_base == "$APP_BASE" && $api_base == "$API_BASE" && $source_sha =~ ^[a-f0-9]{64}$ && $git_head =~ ^[a-f0-9]{40,64}$ ]] || die 'Package environment/base path does not match this server.'
}
read_link() {
  local target
  target=$(readlink "$DEPLOY_DIR/$1")
  [[ $target =~ ^releases/[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ ]] || die "Invalid $1 release link."
  validate_tree "$DEPLOY_DIR/$target"
  printf '%s\n' "$target"
}
atomic_file() {
  case "$(uname -s)" in
    Linux) mv -Tf "$1" "$2" ;;
    Darwin) mv -fh "$1" "$2" ;;
    *) die 'Unsupported operating system.' ;;
  esac
}
atomic_link() {
  rm -f "$WORK/$1"
  ln -s "$2" "$WORK/$1"
  atomic_file "$WORK/$1" "$DEPLOY_DIR/$1"
}
CURRENT=''
[[ ! -L $DEPLOY_DIR/current ]] || CURRENT=$(read_link current)
if [[ $ACTION == status ]]; then
  printf 'Environment: %s\nCurrent: %s\n' "$ENVIRONMENT" "${CURRENT:-not deployed}"
  exit 0
fi
if [[ $ACTION == rollback ]]; then
  [[ -n $CURRENT && -L $DEPLOY_DIR/previous ]] || die 'No completed previous release.'
  PREVIOUS=$(read_link previous)
  atomic_link current "$PREVIOUS"
  atomic_link previous "$CURRENT"
  printf 'Rolled back %s to: %s\n' "$ENVIRONMENT" "$PREVIOUS"
  exit 0
fi
for cmd in curl unzip awk diff sort; do command -v "$cmd" >/dev/null || die "Missing command: $cmd"; done
if ! command -v sha256sum >/dev/null; then command -v shasum >/dev/null || die 'SHA-256 utility is required.'; fi
download() {
  curl --disable --fail --silent --show-error --noproxy '*' --proto '=https' --max-redirs 0 \
    --connect-timeout 15 --max-time 300 --retry 2 --output "$2" "$OSS_ROOT/$1"
}
manifest=latest.txt
[[ -z $REQUESTED_RELEASE ]] || manifest="releases/$REQUESTED_RELEASE/release.txt"
download "$manifest" "$WORK/release.txt"
metadata=$(cat "$WORK/release.txt")
read -r RELEASE_ID CHECKSUM EXTRA <<< "$metadata"
[[ $RELEASE_ID =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ && $CHECKSUM =~ ^[a-f0-9]{64}$ && -z $EXTRA && $metadata == "$RELEASE_ID $CHECKSUM" && ${RELEASE_ID##*-} == "${CHECKSUM:0:12}" ]] || die 'Invalid release manifest.'
[[ -z $REQUESTED_RELEASE || $REQUESTED_RELEASE == "$RELEASE_ID" ]] || die 'Requested release differs from its manifest.'
TARGET="releases/$RELEASE_ID"
if [[ $CURRENT == "$TARGET" ]]; then printf 'Already deployed %s: %s\n' "$ENVIRONMENT" "$RELEASE_ID"; exit 0; fi
download "releases/$RELEASE_ID/dist.zip" "$WORK/dist.zip"
[[ $(hash_file "$WORK/dist.zip") == "$CHECKSUM" ]] || die 'SHA-256 mismatch; current release was retained.'
unzip -Z -1 "$WORK/dist.zip" > "$WORK/paths"
awk '
  !/^dist\// || /\\/ || /(^|\/)\.\.($|\/)/ || /\/\.\/|\/\// || /[^A-Za-z0-9_.\/-]/ {bad=1}
  seen[$0]++ {bad=1}
  $0=="dist/index.html" {entry++}
  END {if(bad || entry!=1 || NR==0)exit 1}
' "$WORK/paths" || die 'Unsafe ZIP path; current release was retained.'
unzip -Z -l "$WORK/dist.zip" > "$WORK/types"
entries=$(wc -l < "$WORK/paths" | tr -d '[:space:]')
awk -v expected="$entries" 'length($1)==10 && substr($1,2)~/^[rwxstST?-]+$/ {n++; if(substr($1,1,1)!="d" && substr($1,1,1)!="-")bad=1} END {if(bad || n!=expected)exit 1}' "$WORK/types" || die 'Unsafe ZIP entry type; current release was retained.'
unzip -tq "$WORK/dist.zip" >/dev/null || die 'ZIP integrity check failed.'
mkdir "$WORK/release"
unzip -q "$WORK/dist.zip" -d "$WORK/release"
validate_tree "$WORK/release"
chmod -R u=rwX,go=rX "$WORK/release"
if [[ -e $DEPLOY_DIR/$TARGET || -L $DEPLOY_DIR/$TARGET ]]; then
  [[ -d $DEPLOY_DIR/$TARGET && ! -L $DEPLOY_DIR/$TARGET ]] || die 'Invalid cached release.'
  diff -qr "$WORK/release" "$DEPLOY_DIR/$TARGET" >/dev/null || die 'Existing immutable release differs.'
else
  mv "$WORK/release" "$DEPLOY_DIR/$TARGET"
fi
if [[ ! -e $CHANNEL_FILE ]]; then
  printf '%s\n' "$ENVIRONMENT" > "$WORK/environment"
  chmod 600 "$WORK/environment"
  atomic_file "$WORK/environment" "$CHANNEL_FILE"
fi
[[ -z $CURRENT ]] || atomic_link previous "$CURRENT"
atomic_link current "$TARGET"
printf 'Deployed %s: %s\nApp base: %s\nNginx files: %s/current/dist\n' "$ENVIRONMENT" "$RELEASE_ID" "$APP_BASE" "$DEPLOY_DIR"
