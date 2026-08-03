#!/usr/bin/env python3
"""
Load the extracted activities and reservations into D1, reconciled against
Cost.md's booking table.

Two sources disagree on purpose. The destination notes describe *candidates* —
Lily weighed three campgrounds against each other at Cannon Beach and never
crossed any out. Cost.md is the ledger of what actually got booked and paid.
Where they overlap, Cost.md wins, because a confirmation number beats a
maybe.

Costs in the notes are prose ("$20 a night for walk-in site, $26 for regular").
The numeric column takes the first figure so it can be summed; the original
phrasing is preserved in `notes` so nothing is flattened away.

Idempotent: clears activity and reservation, then reloads.

Usage:  python3 scripts/load_extraction.py [--apply]
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
WORKER_DIR = os.path.join(HERE, "..", "worker")
EXTRACTION = os.path.join(HERE, "extracted", "vault_extraction.json")
NOW = datetime.utcnow().isoformat() + "Z"

# Files whose content belongs to an intention under a different name.
# Chicago has no route entry of its own — Illinois.md nests it as a day trip
# from the Chain O Lakes campsite, and that is where they actually went from.
# Without this the Obama Library would be silently dropped.
FILE_ALIAS = {
    "Yellowstone Itinerary.md": "Yellowstone.md",
    "Chicago.md": "Illinois.md",
}

# Cost.md — the booking ledger. Keyed by a substring of the reservation name.
# `paid` here means the "have we split the cost yet" column read yes.
LEDGER = {
    "Chain O Lakes":       dict(cost=29.64, booked=1, paid=1, note="Cost.md: $29.64, booked, split"),
    "Schroeder":           dict(cost=46.00, booked=1, paid=1, note="Cost.md: $46, booked, split"),
    "Eggerts landing":     dict(cost=26.00, booked=1, paid=1, note="Cost.md: $26, booked, split — regular site"),
    "Medora":              dict(cost=37.00, booked=1, paid=0,
                                note="Cost.md: $37, booked, pay on arrival. CONFIRMED 2026-08-03 with Lily "
                                     "that they are staying — the 4pm Aug 04 cancellation window is moot."),
    "Dune Backcountry":    dict(cost=6.00,  booked=0, paid=0, note="Cost.md: $6, not yet booked"),
}

# Cost.md books Yellowstone camping without naming the campground.
YELLOWSTONE_BOOKING = dict(
    name="Yellowstone camping (campground not named in Cost.md)",
    cost=87.76, booked=1, paid=0,
    notes="Cost.md: $87.76 total — $43.88 paid at booking, the rest at check-in. "
          "Which campground is not recorded; the route note's 'from Bridge Bay Marina' "
          "drive time to Grand Teton hints at Bridge Bay but that is an inference, not a fact.",
)


def q(v):
    if v is None or v == "":
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def num(v):
    return "NULL" if v is None else str(v)


def parse_cost(raw):
    """'$20 a night for walk-in site, $26 for regular' -> 20.0 ; 'free' -> 0.0"""
    if raw is None:
        return None, None
    if isinstance(raw, (int, float)):
        return float(raw), None
    text = str(raw).strip()
    if text.lower() in {"free", "$0"}:
        return 0.0, text
    m = re.search(r"\$?\s*(\d+(?:\.\d+)?)", text)
    if not m:
        return None, text
    val = float(m.group(1))
    # Keep the original phrasing when it says more than the bare number.
    residue = text if re.sub(r"[\$\s,]", "", text) != m.group(1) else None
    return val, residue


def main():
    apply = "--apply" in sys.argv
    data = json.load(open(EXTRACTION))

    # file -> intention_id, from what the seed step recorded
    out = subprocess.run(
        ["npx", "--yes", "wrangler@latest", "d1", "execute", "roadtrip", "--remote",
         "--json", "--command", "SELECT id, name, source_note FROM intention;"],
        cwd=WORKER_DIR, capture_output=True, text=True, check=True,
    )
    rows = json.loads(re.search(r"(\[.*\])", out.stdout, re.S).group(1))[0]["results"]
    by_note = {r["source_note"]: r["id"] for r in rows if r["source_note"]}

    sql = ["DELETE FROM activity;", "DELETE FROM reservation;"]
    n_act = n_res = 0
    seq = 0  # global: aliased files share an intention_id, so per-file indices collide
    unmatched = []

    for note in data["notes"]:
        f = note["file"]
        key = FILE_ALIAS.get(f, f)
        iid = by_note.get(key)
        if iid is None and (note["activities"] or note["reservations"]):
            unmatched.append(f)

        for a in note["activities"]:
            if iid is None:
                continue
            seq += 1
            sql.append(
                "INSERT INTO activity (id,intention_id,name,detail,distance_mi,duration,url,created_at) VALUES ("
                f"{q(f'a{seq}')},{q(iid)},{q(a['name'])},{q(a.get('detail'))},"
                f"{num(a.get('distance_mi'))},{q(a.get('duration'))},{q(a.get('url'))},{q(NOW)});"
            )
            n_act += 1

        for r in note["reservations"]:
            seq += 1
            cost, residue = parse_cost(r.get("cost"))
            booked = 1 if r.get("booked") else 0
            paid = 1 if r.get("paid") else 0
            notes = r.get("notes")
            if residue:
                notes = f"[{residue}] " + (notes or "")

            for frag, led in LEDGER.items():
                if frag.lower() in r["name"].lower():
                    cost, booked, paid = led["cost"], led["booked"], led["paid"]
                    notes = (notes or "") + " || " + led["note"]
                    break

            rid = f"r{seq}"
            sql.append(
                "INSERT INTO reservation (id,intention_id,name,provider,cost,booked,paid,"
                "confirmation,site,check_in_at,check_out_at,cancel_by,url,notes,created_at) VALUES ("
                f"{q(rid)},{q(iid)},{q(r['name'])},{q(r.get('provider'))},"
                f"{num(cost)},{booked},{paid},{q(r.get('confirmation'))},{q(r.get('site'))},"
                f"{q(r.get('check_in'))},{q(r.get('check_out'))},{q(r.get('cancel_by'))},"
                f"{q(r.get('url'))},{q(notes)},{q(NOW)});"
            )
            n_res += 1

    ys = by_note.get("Yellowstone.md")
    sql.append(
        "INSERT INTO reservation (id,intention_id,name,cost,booked,paid,notes,created_at) VALUES ("
        f"{q('yellowstone-booked')},{q(ys)},{q(YELLOWSTONE_BOOKING['name'])},"
        f"{YELLOWSTONE_BOOKING['cost']},{YELLOWSTONE_BOOKING['booked']},{YELLOWSTONE_BOOKING['paid']},"
        f"{q(YELLOWSTONE_BOOKING['notes'])},{q(NOW)});"
    )
    n_res += 1

    print(f"{n_act} activities, {n_res} reservations")
    if unmatched:
        print(f"NOT MATCHED to an intention (dropped): {', '.join(unmatched)}")

    out_path = "/tmp/load_extraction.sql"
    open(out_path, "w").write("\n".join(sql) + "\n")

    if apply:
        subprocess.run(
            ["npx", "--yes", "wrangler@latest", "d1", "execute", "roadtrip",
             "--remote", f"--file={out_path}"],
            cwd=WORKER_DIR, check=True,
        )
        print("Applied.")
    else:
        print(f"Dry run → {out_path}. Pass --apply to write.")


if __name__ == "__main__":
    main()
