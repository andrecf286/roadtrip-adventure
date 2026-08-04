#!/usr/bin/env python3
"""One-time geocode of the 34 itinerary intentions (plus sanity bounds).

Queries are hand-curated: several intention names are Lily's shorthand
("Illinois" = Chain O' Lakes State Park; "St Cloud" = Schroeder County Park
near Annandale MN; "Beach Glass Beach" = Glass Beach, Fort Bragg). The
curation is recorded here so the mapping is auditable and re-runnable.

Prints TSV: id, lat, lon, display_name, ok/FAIL(bounds). Writes nothing.
Feed the output to a separate UPDATE step after review.
"""
import json, sys, time, urllib.parse, urllib.request

UA = {"User-Agent": "roadtrip-adventure-app/1.0 (acfoti@gmail.com)"}

# id -> (query, (lat_min, lat_max, lon_min, lon_max) sanity bounds)
PLACES = {
    "illinois":            ("Chain O' Lakes State Park, Spring Grove, Illinois", (42.2, 42.7, -88.5, -88.0)),
    "st-cloud":            ("Schroeder Regional Park, Annandale, Minnesota",     (45.0, 45.5, -94.3, -93.8)),
    "eggerts-landing-nd":  ("Eggerts Landing Campground, Lake Ashtabula, North Dakota", (46.9, 47.6, -98.4, -97.7)),
    "theodore-roosevelt-national-park": ("Theodore Roosevelt National Park, North Dakota", (46.7, 47.7, -103.8, -103.0)),
    "east-rosebud-campground": ("East Rosebud Lake, Montana",                    (45.1, 45.5, -109.8, -109.4)),
    "yellowstone":         ("Yellowstone National Park",                         (44.1, 45.2, -111.2, -109.8)),
    "grand-teton":         ("Grand Teton National Park, Wyoming",                (43.5, 44.1, -111.0, -110.4)),
    "glacier":             ("Glacier National Park, Montana",                    (48.2, 49.1, -114.5, -113.2)),
    "spokane":             ("Spokane, Washington",                               (47.5, 47.8, -117.6, -117.2)),
    "north-cascades-national-park": ("North Cascades National Park, Washington", (48.3, 49.0, -121.8, -120.6)),
    "seattle":             ("Seattle, Washington",                               (47.4, 47.8, -122.5, -122.2)),
    "vancouver-bc":        ("Vancouver, British Columbia, Canada",               (49.1, 49.4, -123.3, -122.9)),
    "olympic":             ("Olympic National Park, Washington",                 (47.4, 48.2, -124.3, -123.0)),
    "mt-rainer":           ("Mount Rainier National Park, Washington",           (46.7, 47.1, -122.0, -121.4)),
    "portland":            ("Portland, Oregon",                                  (45.4, 45.7, -122.8, -122.5)),
    "mount-hood":          ("Mount Hood, Oregon",                                (45.2, 45.5, -121.9, -121.5)),
    "cannon-beach":        ("Cannon Beach, Oregon",                              (45.8, 46.0, -124.0, -123.8)),
    "god-s-thumb-trailhead": ("God's Thumb, Lincoln City, Oregon",               (44.9, 45.1, -124.1, -123.9)),
    "crescent-city":       ("Crescent City, California",                         (41.6, 41.9, -124.3, -124.0)),
    "king-range-wilderness": ("King Range National Conservation Area, California", (39.9, 40.3, -124.4, -123.9)),
    "beach-glass-beach":   ("Glass Beach, Fort Bragg, California",               (39.3, 39.6, -123.9, -123.7)),
    "point-arena":         ("Point Arena, California",                           (38.8, 39.1, -123.8, -123.5)),
    "san-francisco":       ("San Francisco, California",                         (37.6, 37.9, -122.6, -122.3)),
    "big-sur-ish":         ("Big Sur, California",                               (36.1, 36.4, -122.0, -121.6)),
    "lake-tahoe":          ("Lake Tahoe",                                        (38.8, 39.3, -120.2, -119.8)),
    "yosemite":            ("Yosemite National Park, California",                (37.5, 38.2, -120.0, -119.2)),
    "zion":                ("Zion National Park, Utah",                          (37.1, 37.6, -113.3, -112.8)),
    "bryce-canyon":        ("Bryce Canyon National Park, Utah",                  (37.4, 37.8, -112.4, -112.0)),
    "grand-canyon":        ("Grand Canyon Village, Arizona",                     (35.9, 36.3, -112.3, -111.9)),
    "painted-desert":      ("Painted Desert, Petrified Forest National Park, Arizona", (34.8, 35.4, -110.0, -109.3)),
    "canyonlands":         ("Canyonlands National Park, Utah",                   (38.0, 38.6, -110.2, -109.5)),
    "moab":                ("Moab, Utah",                                        (38.4, 38.7, -109.7, -109.4)),
    "sand-dunes-co":       ("Great Sand Dunes National Park, Colorado",          (37.6, 38.0, -105.8, -105.3)),
    "denver":              ("Denver, Colorado",                                  (39.6, 39.9, -105.1, -104.8)),
}

def geocode(q):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": q, "format": "json", "limit": 1})
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        res = json.load(r)
    return res[0] if res else None

def main():
    out = []
    fails = 0
    for pid, (q, (la0, la1, lo0, lo1)) in PLACES.items():
        r = geocode(q)
        if not r:
            print(f"{pid}\tFAIL\tno result\t{q}", flush=True); fails += 1
        else:
            lat, lon = float(r["lat"]), float(r["lon"])
            ok = (la0 <= lat <= la1) and (lo0 <= lon <= lo1)
            tag = "ok" if ok else "FAIL(bounds)"
            if not ok: fails += 1
            print(f"{pid}\t{lat:.5f}\t{lon:.5f}\t{tag}\t{r['display_name'][:80]}", flush=True)
            out.append({"id": pid, "lat": round(lat, 5), "lon": round(lon, 5),
                        "query": q, "display_name": r["display_name"]})
        time.sleep(1.1)  # Nominatim usage policy: max 1 req/s
    json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else "/tmp/geocoded.json", "w"), indent=1)
    print(f"# {len(out)} geocoded, {fails} failures", flush=True)

if __name__ == "__main__":
    main()
