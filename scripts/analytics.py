"""Visitor stats for isotherms.org from Cloudflare Web Analytics.

Usage (from the repo root):
    python3 scripts/analytics.py        # the last 7 days
    python3 scripts/analytics.py 30     # the last 30 days

Uses Cloudflare's GraphQL Analytics API (rumPageloadEventsAdaptiveGroups).
The API token needs Account Analytics Read; it is read from
CLOUDFLARE_API_TOKEN or, on macOS, the Keychain item isotherms-cloudflare.
It is never printed. Standard library only.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

API = "https://api.cloudflare.com/client/v4"
HOST = "isotherms.org"
BREAKDOWNS = {
    "pages": "requestPath",
    "countries": "countryName",
    "referrers": "refererHost",
    "devices": "deviceType",
}


def token() -> str:
    if os.environ.get("CLOUDFLARE_API_TOKEN"):
        return os.environ["CLOUDFLARE_API_TOKEN"]
    return subprocess.run(
        ["security", "find-generic-password", "-a", os.environ["USER"], "-s", "isotherms-cloudflare", "-w"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()


def call(path: str, body: dict | None = None) -> dict:
    request = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def main() -> None:
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    until = datetime.now(timezone.utc)
    since = until - timedelta(days=days)
    account = call(f"/zones?name={HOST}")["result"][0]["account"]["id"]

    where = '{datetime_geq: $since, datetime_leq: $until, requestHost: "%s"}' % HOST
    groups = [f"total: rumPageloadEventsAdaptiveGroups(limit: 1, filter: {where}) {{ count sum {{ visits }} }}"]
    for name, dim in BREAKDOWNS.items():
        groups.append(
            f"{name}: rumPageloadEventsAdaptiveGroups(limit: 20, orderBy: [count_DESC], filter: {where}) "
            f"{{ count dimensions {{ {dim} }} }}"
        )
    query = (
        "query($account: String!, $since: Time!, $until: Time!) { viewer { accounts(filter: {accountTag: $account}) { "
        + " ".join(groups)
        + " } } }"
    )
    iso = lambda t: t.strftime("%Y-%m-%dT%H:%M:%SZ")  # noqa: E731
    result = call("/graphql", {"query": query, "variables": {"account": account, "since": iso(since), "until": iso(until)}})
    if result.get("errors"):
        sys.exit(f"Cloudflare: {[e.get('message') for e in result['errors']]}")

    data = result["data"]["viewer"]["accounts"][0]
    total = data["total"][0] if data["total"] else {"count": 0, "sum": {"visits": 0}}
    print(f"{HOST}, last {days} days: {total['count']} page views, {total['sum']['visits']} visits")
    for name, dim in BREAKDOWNS.items():
        rows = ", ".join(f"{g['dimensions'][dim] or '(none)'} {g['count']}" for g in data[name])
        print(f"  {name}: {rows or '-'}")


if __name__ == "__main__":
    main()
