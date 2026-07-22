#!/usr/bin/env bash
set -euo pipefail

backend_pid=""

cleanup() {
  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if ! command -v php >/dev/null 2>&1; then
  echo "PHP 8.4 is required for the local MacCMS preview backend." >&2
  exit 1
fi

echo "Starting the local PHP backend at http://127.0.0.1:8084/index.php"
php -S 127.0.0.1:8084 -t . &
backend_pid=$!
backend_ready=false

for ((attempt = 0; attempt < 50; attempt += 1)); do
  if php -r '$context = stream_context_create(["http" => ["timeout" => 0.2, "ignore_errors" => true]]); exit(@file_get_contents("http://127.0.0.1:8084/server/react-api.php?action=home", false, $context) === false ? 1 : 0);'; then
    backend_ready=true
    break
  fi

  if ! kill -0 "$backend_pid" 2>/dev/null; then
    wait "$backend_pid" 2>/dev/null || true
    echo "The local PHP backend failed to start on 127.0.0.1:8084." >&2
    exit 1
  fi

  sleep 0.1
done

if [[ "$backend_ready" != true ]]; then
  echo "The local PHP backend did not become ready on 127.0.0.1:8084." >&2
  exit 1
fi

echo "Starting the Next.js frontend at http://127.0.0.1:5173/"
npm run dev:web
