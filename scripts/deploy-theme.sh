#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Set DEPLOY_HOST to the SSH host or IP address.}"
: "${DEPLOY_USER:?Set DEPLOY_USER to the SSH user.}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH to the remote MacCMS template directory.}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
THEME_NAME="pingfangvideo"
ARCHIVE="dist/pingfangvideo.tar.gz"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
REMOTE_TMP="${DEPLOY_REMOTE_TMP:-/tmp/${THEME_NAME}.$(date +%Y%m%d%H%M%S).tar.gz}"

ssh_options=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)
scp_options=(-P "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)

if [[ -n "${DEPLOY_PASSWORD:-}" ]]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "DEPLOY_PASSWORD requires sshpass. Install sshpass or configure SSH key authentication." >&2
    exit 1
  fi

  export SSHPASS="$DEPLOY_PASSWORD"
  ssh_command=(sshpass -e ssh "${ssh_options[@]}")
  scp_command=(sshpass -e scp "${scp_options[@]}")
else
  ssh_command=(ssh "${ssh_options[@]}")
  scp_command=(scp "${scp_options[@]}")
fi

npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run package
npm run verify:release

"${scp_command[@]}" "$ARCHIVE" "${REMOTE}:${REMOTE_TMP}"

remote_env=(
  "DEPLOY_PATH=$(printf "%q" "$DEPLOY_PATH")"
  "REMOTE_TMP=$(printf "%q" "$REMOTE_TMP")"
  "THEME_NAME=$(printf "%q" "$THEME_NAME")"
)

"${ssh_command[@]}" "$REMOTE" "${remote_env[*]} bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

if [[ ! -d "$DEPLOY_PATH" ]]; then
  echo "Remote template directory does not exist: $DEPLOY_PATH" >&2
  exit 1
fi

cd "$DEPLOY_PATH"

if [[ -d "$THEME_NAME" ]]; then
  backup="pingfangvideo.backup.$(date +%Y%m%d%H%M%S)"
  cp -a "$THEME_NAME" "$backup"
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir" "$REMOTE_TMP"' EXIT

tar -xzf "$REMOTE_TMP" -C "$tmp_dir"

if [[ ! -f "$tmp_dir/$THEME_NAME/info.ini" ]]; then
  echo "Uploaded archive does not contain $THEME_NAME/info.ini" >&2
  exit 1
fi

rm -rf "$THEME_NAME"
mv "$tmp_dir/$THEME_NAME" "$THEME_NAME"
REMOTE_SCRIPT

echo "Deployed ${THEME_NAME} to ${REMOTE}:${DEPLOY_PATH}/${THEME_NAME}"
