#!/usr/bin/env python3
"""
Backfill historical Bouncie trips into D1.

Covers the window before the ingest webhook existed. What this recovers is
route *shape* — GET /v1/trips returns each trip's geometry with no per-point
timestamps, so these rows carry a start time, an end time, and a coordinate
list, and nothing in between. The timestamped breadcrumbs in `track_points`
only ever come from the live tripData webhook.

Safe to re-run: trips upsert on transaction_id, and a REST row never
overwrites a value the webhook already supplied.

Usage:
    export $(grep -v '^#' /tmp/bouncie.env | xargs)
    python3 scripts/backfill_trips.py 2026-08-01
"""

import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

API = "https://api.bouncie.dev/v1/trips"
WORKER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "worker")


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def fetch_window(token, imei, start, end):
    """One <=7-day window. The API rejects anything wider."""
    qs = (
        f"?imei={imei}&gps-format=geojson"
        f"&starts-after={start.strftime('%Y-%m-%dT%H:%M:%SZ')}"
        f"&ends-before={end.strftime('%Y-%m-%dT%H:%M:%SZ')}"
    )
    req = urllib.request.Request(API + qs, headers={"Authorization": token})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def sql_str(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def sql_num(v):
    return "NULL" if v is None else str(v)


def main():
    token = os.environ.get("BOUNCIE_ACCESS_TOKEN") or die("BOUNCIE_ACCESS_TOKEN not set")
    imei = os.environ.get("BOUNCIE_IMEI") or die("BOUNCIE_IMEI not set")
    vin = os.environ.get("BOUNCIE_VIN")

    start_arg = sys.argv[1] if len(sys.argv) > 1 else "2026-08-01"
    cursor = datetime.strptime(start_arg, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)

    all_trips, seen = [], set()
    while cursor < now:
        window_end = min(cursor + timedelta(days=7), now)
        try:
            batch = fetch_window(token, imei, cursor, window_end)
        except Exception as e:
            print(f"  {cursor:%Y-%m-%d} → {window_end:%Y-%m-%d}: FAILED ({e})")
            cursor = window_end
            continue
        fresh = [t for t in batch if t.get("transactionId") not in seen]
        for t in fresh:
            seen.add(t.get("transactionId"))
        all_trips.extend(fresh)
        print(f"  {cursor:%Y-%m-%d} → {window_end:%Y-%m-%d}: {len(batch):3d} trips ({len(fresh)} new)")
        cursor = window_end

    if not all_trips:
        print("No trips returned. Nothing to write.")
        return

    lines = []
    for t in all_trips:
        gps = t.get("gps")
        gps_text = json.dumps(gps) if isinstance(gps, (dict, list)) else gps
        lines.append(
            "INSERT INTO trips (transaction_id, imei, vin, start_time, end_time, "
            "start_odometer, end_odometer, distance, average_speed, max_speed, "
            "fuel_consumed, total_idle_duration, hard_braking_count, "
            "hard_acceleration_count, time_zone, gps, gps_format, source, updated_at) VALUES ("
            f"{sql_str(t.get('transactionId'))}, {sql_str(t.get('imei') or imei)}, {sql_str(vin)}, "
            f"{sql_str(t.get('startTime'))}, {sql_str(t.get('endTime'))}, "
            f"{sql_num(t.get('startOdometer'))}, {sql_num(t.get('endOdometer'))}, "
            f"{sql_num(t.get('distance'))}, {sql_num(t.get('averageSpeed'))}, "
            f"{sql_num(t.get('maxSpeed'))}, {sql_num(t.get('fuelConsumed'))}, "
            f"{sql_num(t.get('totalIdleDuration'))}, {sql_num(t.get('hardBrakingCount'))}, "
            f"{sql_num(t.get('hardAccelerationCount'))}, {sql_str(t.get('timeZone'))}, "
            f"{sql_str(gps_text)}, 'geojson', 'rest', {sql_str(datetime.now(timezone.utc).isoformat())}"
            ") ON CONFLICT(transaction_id) DO UPDATE SET "
            # COALESCE(existing, new): webhook-supplied values win, REST only fills gaps.
            "gps = COALESCE(trips.gps, excluded.gps), "
            "gps_format = COALESCE(trips.gps_format, excluded.gps_format), "
            "distance = COALESCE(trips.distance, excluded.distance), "
            "start_time = COALESCE(trips.start_time, excluded.start_time), "
            "end_time = COALESCE(trips.end_time, excluded.end_time), "
            "start_odometer = COALESCE(trips.start_odometer, excluded.start_odometer), "
            "end_odometer = COALESCE(trips.end_odometer, excluded.end_odometer), "
            "fuel_consumed = COALESCE(trips.fuel_consumed, excluded.fuel_consumed), "
            "average_speed = COALESCE(trips.average_speed, excluded.average_speed), "
            "max_speed = COALESCE(trips.max_speed, excluded.max_speed), "
            "vin = COALESCE(trips.vin, excluded.vin), "
            "updated_at = excluded.updated_at;"
        )

    out = "/tmp/backfill_trips.sql"
    with open(out, "w") as f:
        f.write("\n".join(lines) + "\n")

    total_miles = sum(t.get("distance") or 0 for t in all_trips)
    print(f"\n{len(all_trips)} trips, {total_miles:.1f} miles → {out}")

    subprocess.run(
        ["npx", "--yes", "wrangler@latest", "d1", "execute", "roadtrip", "--remote", f"--file={out}"],
        cwd=WORKER_DIR,
        check=True,
    )
    print("Backfill applied.")


if __name__ == "__main__":
    main()
