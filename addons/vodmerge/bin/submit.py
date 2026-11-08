#!/usr/bin/env python3
"""Submit one MacCMS video object; credentials stay in environment variables."""

import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Refusing to redirect a signed request")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="HTTPS endpoint ending in /api.php/vodmerge/submit")
    parser.add_argument("--source", required=True, help="Stable source identifier, not a player name")
    parser.add_argument("--source-id", required=True, help="Original video ID in that source")
    parser.add_argument("--file", required=True, type=Path, help="UTF-8 JSON file containing one video object")
    args = parser.parse_args()
    try:
        url = urllib.parse.urlsplit(args.url)
        if url.scheme != "https" or not url.hostname or url.username or url.password or url.fragment:
            raise ValueError("An HTTPS endpoint without embedded credentials is required")
        secret = os.environ.get("VODMERGE_INGEST_SECRET", "")
        if len(secret.encode()) < 32:
            raise ValueError("Set VODMERGE_INGEST_SECRET to the server's intake secret (at least 32 bytes)")
        if args.file.stat().st_size > 2 * 1024 * 1024:
            raise ValueError("Input exceeds 2 MiB")
        video = json.loads(args.file.read_text(encoding="utf-8"))
        if not isinstance(video, dict):
            raise ValueError("Input must be one JSON video object")
        body = json.dumps({"source": args.source, "source_id": args.source_id, "video": video}, ensure_ascii=False, separators=(",", ":")).encode()
        if len(body) > 2 * 1024 * 1024:
            raise ValueError("Request exceeds 2 MiB")
        timestamp = str(int(time.time()))
        signature = hmac.new(secret.encode(), timestamp.encode() + b"\n" + body, hashlib.sha256).hexdigest()
        request = urllib.request.Request(args.url, data=body, method="POST", headers={
            "Content-Type": "application/json", "X-Vodmerge-Time": timestamp, "X-Vodmerge-Signature": signature,
        })
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=30) as response:
            result = json.load(response)
        if result.get("code") != 1:
            raise ValueError("Submission was not accepted")
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except urllib.error.HTTPError as error:
        print(json.dumps({"error": "Server rejected the request", "status": error.code}), file=sys.stderr)
    except urllib.error.URLError:
        print("Connection failed; retrying the identical payload is safe", file=sys.stderr)
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
