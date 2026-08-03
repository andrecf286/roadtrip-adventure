#!/usr/bin/env python3
"""
Seed people, days, and the itinerary overlay from Lily's Obsidian vault.

The route spine in `Road Trip Planning.md` is the only structured thing in the
vault: a linear sequence of legs, each carrying a drive time from the previous
stop, a date range, a night count, and one or more wikilinks to destination
notes. That structure becomes `intention` rows.

The planned dates are recorded but deliberately inert — nothing reads them as
authority. They are Lily's original plan, part of the record ("we meant to be in
Moab on the 10th"), not a schedule the app holds anyone to.

Idempotent: re-running replaces the itinerary overlay and leaves everything the
girls have produced (stops, photos, journal entries, day titles) untouched.

Usage:  python3 scripts/seed_itinerary.py [--apply]
"""

import os
import re
import subprocess
import sys
from datetime import date, datetime, timedelta

VAULT = "/mnt/user-data/uploads/Road Trip"
WORKER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "worker")
NOW = datetime.utcnow().isoformat() + "Z"
YEAR = 2026
DEPARTURE = date(2026, 8, 2)
HORIZON = date(2026, 9, 15)

PEOPLE = [
    ("lily", "Lily Cook", "author", None),
    ("ada", "Ada Menk-Brown", "author", None),
    ("andy", "Andy Foti", "viewer", "acfoti@gmail.com"),
    ("jana", "Jana Cook", "viewer", "jana.k.cook@gmail.com"),
    ("amelia", "Amelia Menk Brown", "viewer", None),
    ("david", "David Brown", "viewer", None),
]

MONTHS = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
          "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}


def q(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def n(v):
    return "NULL" if v is None else str(v)


def slug(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "x"


def parse_dates(line):
    """
    'Aug 1-Aug 3 (**2 n**)' -> (2026-08-01, 2026-08-03, 2)
    'Aug 3-4'               -> (2026-08-03, 2026-08-04, None)
    'Sep 10'                -> (2026-09-10, None, None)
    Tolerates '**Aug 17-18**', 'Aug or 14-16', trailing '.', '(at 3,156 miles)'.
    """
    s = line.replace("*", "").strip().rstrip(".")
    s = re.sub(r"\bor\b", " ", s)
    nights = None
    m = re.search(r"(\d+)\s*n\b", s)
    if m:
        nights = int(m.group(1))
    s = re.sub(r"\(.*?\)", " ", s)

    # Month Day - Month Day
    m = re.search(r"([A-Za-z]{3})\w*\s+(\d{1,2})\s*-\s*([A-Za-z]{3})\w*\s+(\d{1,2})", s)
    if m:
        a = date(YEAR, MONTHS[m.group(1).lower()[:3]], int(m.group(2)))
        b = date(YEAR, MONTHS[m.group(3).lower()[:3]], int(m.group(4)))
        return a.isoformat(), b.isoformat(), nights

    # Month Day-Day
    m = re.search(r"([A-Za-z]{3})\w*\s+(\d{1,2})\s*-\s*(\d{1,2})", s)
    if m:
        mo = MONTHS[m.group(1).lower()[:3]]
        d1, d2 = int(m.group(2)), int(m.group(3))
        a = date(YEAR, mo, d1)
        # 'Aug 31-2' wraps into the next month
        b = date(YEAR, mo, d2) if d2 >= d1 else date(YEAR, mo + 1, d2)
        return a.isoformat(), b.isoformat(), nights

    # Month Day
    m = re.search(r"([A-Za-z]{3})\w*\s+(\d{1,2})\b", s)
    if m:
        return date(YEAR, MONTHS[m.group(1).lower()[:3]], int(m.group(2))).isoformat(), None, nights

    return None, None, nights


def classify(name):
    low = name.lower()
    if "national park" in low or name in {
        "Yellowstone", "Glacier", "Olympic", "Yosemite", "Zion", "Bryce Canyon",
        "Grand Canyon", "Grand Teton", "Painted Desert", "Canyonlands", "Mt. Rainer",
    }:
        return "park"
    if "campground" in low or "state park" in low:
        return "campground"
    if "trailhead" in low:
        return "trailhead"
    if "wilderness" in low or "range" in low:
        return "wilderness"
    if name in {"Chicago", "Seattle", "Portland", "Vancouver, BC", "San Francisco",
                "Spokane", "St Cloud", "Denver", "Moab", "Crescent city"}:
        return "city"
    return "stop"


def load_note(name):
    for cand in (name, name.replace("/", "-")):
        p = os.path.join(VAULT, cand + ".md")
        if os.path.exists(p):
            return open(p, encoding="utf-8").read().strip()
    return None


def parse_route():
    text = open(os.path.join(VAULT, "Road Trip Planning.md"), encoding="utf-8").read()
    body = text.split("Route", 1)[1] if "Route" in text else text

    legs, drive, dates = [], None, (None, None, None)
    for raw in body.splitlines():
        line = raw.rstrip()
        if not line.strip() or line.strip() in {"--", "Home"}:
            continue

        m = re.match(r"\s*->\s*==([^=]+)==", line)
        if m and "[[" not in line:
            drive = m.group(1).strip()
            continue

        indented = raw.startswith(("\t", "    "))
        if not indented:
            d = parse_dates(line)
            if d[0] or d[2]:
                dates = d
            continue

        # A destination line. May carry links, plain text, or an inline hop.
        links = re.findall(r"\[\[([^\]|]+)", line)
        if links:
            for i, name in enumerate(links):
                legs.append({
                    "name": name.strip(),
                    "drive": drive if i == 0 else None,
                    "arrive": dates[0], "depart": dates[1], "nights": dates[2],
                })
        else:
            plain = re.sub(r"[*=]", "", line).strip().rstrip("?")
            if plain and not plain.startswith("->"):
                legs.append({
                    "name": plain.title() if plain.isupper() else plain,
                    "drive": drive, "arrive": dates[0], "depart": dates[1],
                    "nights": dates[2],
                })
        drive = None
    return legs


def main():
    apply = "--apply" in sys.argv
    legs = parse_route()

    sql = ["DELETE FROM day_intention;", "DELETE FROM activity;", "DELETE FROM intention;"]

    for pid, name, role, email in PEOPLE:
        sql.append(
            f"INSERT INTO person (id,name,role,email,created_at) "
            f"VALUES ({q(pid)},{q(name)},{q(role)},{q(email)},{q(NOW)}) "
            f"ON CONFLICT(id) DO UPDATE SET name=excluded.name, role=excluded.role;"
        )

    d, num = DEPARTURE, 1
    while d <= HORIZON:
        sql.append(
            f"INSERT INTO day (date,day_number,created_at) "
            f"VALUES ({q(d.isoformat())},{num},{q(NOW)}) "
            f"ON CONFLICT(date) DO UPDATE SET day_number=excluded.day_number;"
        )
        d += timedelta(days=1)
        num += 1

    seen, rows = {}, []
    for i, leg in enumerate(legs, start=1):
        base = slug(leg["name"])
        iid = base if base not in seen else f"{base}-{seen[base]+1}"
        seen[base] = seen.get(base, 0) + 1
        note = load_note(leg["name"])
        rows.append((iid, i, leg, note))
        sql.append(
            "INSERT INTO intention (id,seq,name,kind,notes,source_note,"
            "planned_arrival,planned_departure,planned_nights,drive_time_from_prev,created_at) VALUES ("
            f"{q(iid)},{i},{q(leg['name'])},{q(classify(leg['name']))},{q(note)},"
            f"{q(leg['name'] + '.md' if note else None)},"
            f"{q(leg['arrive'])},{q(leg['depart'])},{n(leg['nights'])},{q(leg['drive'])},{q(NOW)});"
        )

    print(f"{len(rows)} intentions parsed from the route spine\n")
    print(f"{'#':>3}  {'place':<32}{'planned':<24}{'nights':>7}  {'drive':<10} note")
    for iid, i, leg, note in rows:
        span = (f"{leg['arrive']} → {leg['depart']}" if leg["depart"]
                else (leg["arrive"] or "—"))
        print(f"{i:>3}  {leg['name'][:31]:<32}{span:<24}{(leg['nights'] or ''):>7}  "
              f"{(leg['drive'] or '—'):<10} {'yes' if note else 'MISSING'}")

    out = "/tmp/seed_itinerary.sql"
    open(out, "w").write("\n".join(sql) + "\n")
    print(f"\n{len(sql)} statements → {out}")

    if apply:
        subprocess.run(
            ["npx", "--yes", "wrangler@latest", "d1", "execute", "roadtrip",
             "--remote", f"--file={out}"],
            cwd=WORKER_DIR, check=True,
        )
        print("Applied.")
    else:
        print("Dry run. Pass --apply to write.")


if __name__ == "__main__":
    main()
