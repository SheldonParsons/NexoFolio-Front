#!/usr/bin/env bash
# Standalone Linux server updater. Requires bash, curl and Python 3.
# Downloads public-read OSS objects over HTTPS without credentials.
set -euo pipefail
umask 022

DEPLOY_DIR="${DEPLOY_DIR:-/home/nexofolio/front}"
OSS_BUCKET="${OSS_BUCKET:-asynctest}"
OSS_ENDPOINT="${OSS_ENDPOINT:-oss-cn-shenzhen.aliyuncs.com}"
OSS_PATH="${OSS_PATH:-linux_files/nexofolio/front}"
OSS_PATH="${OSS_PATH%/}"
ACTION="${1:-update}"
case "$ACTION" in update|--rollback) ;; *) echo "Usage: $0 [--rollback]" >&2; exit 1 ;; esac
command -v python3 >/dev/null || { echo 'Python 3 is required.' >&2; exit 1; }
mkdir -p "$DEPLOY_DIR/releases"
DEPLOY_DIR="$(cd "$DEPLOY_DIR" && pwd)"
LOCK_DIR="$DEPLOY_DIR/.update-lock"
mkdir "$LOCK_DIR" 2>/dev/null || { echo "Another deployment is running (lock: $LOCK_DIR)." >&2; exit 1; }
WORK_DIR=''
cleanup() {
  if [[ -n "$WORK_DIR" ]]; then rm -rf "$WORK_DIR"; fi
  rmdir "$LOCK_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
WORK_DIR="$(mktemp -d "$DEPLOY_DIR/.update.XXXXXX")"

for name in current previous; do
  if [[ -e "$DEPLOY_DIR/$name" && ! -L "$DEPLOY_DIR/$name" ]]; then
    echo "$DEPLOY_DIR/$name must be a symlink, refusing to replace a real directory." >&2
    exit 1
  fi
done

read_release_link() {
  local target
  target="$(readlink "$DEPLOY_DIR/$1")"
  [[ "$target" =~ ^releases/[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ ]] || {
    echo "Unexpected release link: $1" >&2; return 1;
  }
  test -s "$DEPLOY_DIR/$target/dist/index.html"
  printf '%s\n' "$target"
}
atomic_link() {
  python3 - "$DEPLOY_DIR" "$WORK_DIR" "$1" "$2" <<'PY'
import os, sys
root, work, name, target = sys.argv[1:]
temporary = os.path.join(work, name)
os.symlink(target, temporary)
os.replace(temporary, os.path.join(root, name))
PY
}
CURRENT=''
if [[ -L "$DEPLOY_DIR/current" ]]; then CURRENT="$(read_release_link current)"; fi

if [[ "$ACTION" == --rollback ]]; then
  PREVIOUS="$(read_release_link previous)"
  [[ -n "$CURRENT" ]] || { echo 'No current release to roll back.' >&2; exit 1; }
  atomic_link current "$PREVIOUS"
  atomic_link previous "$CURRENT"
  echo "Rolled back to: $PREVIOUS"
  exit 0
fi

command -v curl >/dev/null || { echo 'curl is required.' >&2; exit 1; }
OSS_ROOT="https://$OSS_BUCKET.$OSS_ENDPOINT/$OSS_PATH"
download() {
  curl --fail --silent --show-error --location \
    --proto '=https' --proto-redir '=https' \
    --connect-timeout 15 --max-time 300 --retry 2 \
    --output "$2" "$OSS_ROOT/$1"
}
download latest.txt "$WORK_DIR/latest.txt"
read -r RELEASE_ID CHECKSUM EXTRA < "$WORK_DIR/latest.txt"
[[ "$RELEASE_ID" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ && "$CHECKSUM" =~ ^[a-f0-9]{64}$ && -z "$EXTRA" ]] || {
  echo 'Invalid release manifest.' >&2; exit 1;
}
[[ "${RELEASE_ID##*-}" == "${CHECKSUM:0:12}" ]] || { echo 'Release ID/checksum mismatch.' >&2; exit 1; }
TARGET="releases/$RELEASE_ID"
if [[ "$CURRENT" == "$TARGET" ]]; then echo "Already deployed: $RELEASE_ID"; exit 0; fi

download "releases/$RELEASE_ID/dist.zip" "$WORK_DIR/dist.zip"
# Validate hash, paths and entry types before extracting anything.
python3 - "$WORK_DIR/dist.zip" "$WORK_DIR/release" "$CHECKSUM" <<'PY'
import hashlib, pathlib, stat, sys, zipfile
archive, destination, expected = sys.argv[1:]
digest = hashlib.sha256()
with open(archive, 'rb') as source:
    for chunk in iter(lambda: source.read(1024 * 1024), b''):
        digest.update(chunk)
if digest.hexdigest() != expected:
    raise SystemExit('SHA-256 mismatch; current release was not changed.')
with zipfile.ZipFile(archive) as bundle:
    entries = bundle.infolist()
    for entry in entries:
        path = pathlib.PurePosixPath(entry.filename)
        kind = stat.S_IFMT(entry.external_attr >> 16)
        if (path.is_absolute() or '..' in path.parts or '\\' in entry.filename
                or not path.parts or path.parts[0] != 'dist'
                or kind not in (0, stat.S_IFREG, stat.S_IFDIR)):
            raise SystemExit('Unsafe archive entry; current release was not changed.')
    if 'dist/index.html' not in bundle.namelist():
        raise SystemExit('Archive is missing dist/index.html.')
    bundle.extractall(destination)
if not (pathlib.Path(destination) / 'dist/index.html').stat().st_size:
    raise SystemExit('Empty index.html; current release was not changed.')
PY
chmod -R u=rwX,go=rX "$WORK_DIR/release"
if [[ -e "$DEPLOY_DIR/$TARGET" || -L "$DEPLOY_DIR/$TARGET" ]]; then
  # Existing versions are immutable. Reuse only when the entire tree matches.
  diff -qr "$WORK_DIR/release" "$DEPLOY_DIR/$TARGET" >/dev/null || {
    echo 'Existing release differs; refusing to overwrite it.' >&2; exit 1;
  }
else
  mv "$WORK_DIR/release" "$DEPLOY_DIR/$TARGET"
fi
if [[ -n "$CURRENT" ]]; then atomic_link previous "$CURRENT"; fi
atomic_link current "$TARGET"
echo "Deployed: $RELEASE_ID"
echo "Nginx root: $DEPLOY_DIR/current/dist"
echo 'Static files switched successfully; Nginx reload is not required for code updates.'
