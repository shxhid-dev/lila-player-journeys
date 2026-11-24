"""Reproduce the numbers quoted in INSIGHTS.md from the generated shards.

Usage: python scripts/insights.py   (after pnpm preprocess)
"""

from __future__ import annotations

import json
import statistics as st
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
MAPS = {
    "AmbroseValley": (900, -370, -473),
    "GrandRift": (581, -290, -290),
    "Lockdown": (1000, -500, -500),
}


def to_px(map_id: str, x: float, z: float, size: int = 1024) -> tuple[float, float]:
    scale, ox, oz = MAPS[map_id]
    return (x - ox) / scale * size, (1 - (z - oz) / scale) * size


def load():
    manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    shards = [
        json.loads((DATA / "matches" / f"{m['id']}.json").read_text(encoding="utf-8"))
        for m in manifest["matches"]
    ]
    return manifest, shards


def pct(a: float, b: float) -> str:
    return f"{100 * a / b:.1f}%" if b else "n/a"


def outcomes(shards):
    print("\n== Human outcomes per map ==")
    by_map = defaultdict(Counter)
    surv_t = defaultdict(list)
    death_t = defaultdict(list)
    storm_t = defaultdict(list)
    for s in shards:
        for j in s["journeys"]:
            if j["kind"] != "human":
                continue
            by_map[s["map"]][j["outcome"]] += 1
            (surv_t if j["outcome"] == "survived" else death_t)[s["map"]].append(j["end"])
            if j["outcome"] == "storm":
                storm_t[s["map"]].append(j["end"])
    for m, c in by_map.items():
        n = sum(c.values())
        print(
            f"{m:14} runs={n:4}  survived={pct(c['survived'], n):>6}  by_bot={pct(c['killed_by_bot'], n):>6}"
            f"  storm={pct(c['storm'], n):>6} ({c['storm']})  pvp={c['killed_by_player']}  self={c['self_elimination']}"
        )
        print(
            f"{'':14} median end: survivors {st.median(surv_t[m]):.0f}s, deaths {st.median(death_t[m]):.0f}s"
            + (f", storm deaths {min(storm_t[m])}-{max(storm_t[m])}s" if storm_t[m] else "")
        )
    return by_map


def late_game(shards):
    """Of runs still alive at 10 minutes, how do they end?"""
    print("\n== Runs still alive at t >= 600s ==")
    for m in MAPS:
        alive = [
            j
            for s in shards
            if s["map"] == m
            for j in s["journeys"]
            if j["kind"] == "human" and j["end"] >= 600
        ]
        c = Counter(j["outcome"] for j in alive)
        n = len(alive)
        print(f"{m:14} n={n:3}  survived={pct(c['survived'], n):>6}  storm={pct(c['storm'], n):>6}  bot={pct(c['killed_by_bot'], n):>6}")


def concentration(shards, cell=32):
    """Share of human deaths/kills that fall in the busiest 10% of occupied cells."""
    print(f"\n== Combat concentration ({cell}px cells) ==")
    for m in MAPS:
        deaths, kills = Counter(), Counter()
        for s in shards:
            if s["map"] != m:
                continue
            for j in s["journeys"]:
                if j["kind"] != "human":
                    continue
                for t, typ, x, z, _ in j["events"]:
                    px, py = to_px(m, x, z)
                    key = (int(px // cell), int(py // cell))
                    if typ == "death":
                        deaths[key] += 1
                    elif typ == "kill":
                        kills[key] += 1
        for name, cnt in (("deaths", deaths), ("kills", kills)):
            total = sum(cnt.values())
            if not total:
                continue
            ranked = cnt.most_common()
            top = ranked[: max(1, len(ranked) // 10)]
            print(f"{m:14} {name:6} total={total:4} cells={len(ranked):3}  top10%cells={pct(sum(v for _, v in top), total)}")
            for (cx, cy), v in ranked[:3]:
                print(f"{'':22} cell px=({cx * cell}-{cx * cell + cell}, {cy * cell}-{cy * cell + cell}) count={v}")


def coverage(shards, cell=16):
    """How much of the map human runs ever touch, and how unevenly."""
    print(f"\n== Traffic coverage ({cell}px cells) ==")
    for m in MAPS:
        visits = Counter()
        runs_in_cell = defaultdict(set)
        for s in shards:
            if s["map"] != m:
                continue
            for j in s["journeys"]:
                if j["kind"] != "human":
                    continue
                p = j["path"]
                for i in range(0, len(p), 3):
                    px, py = to_px(m, p[i + 1], p[i + 2])
                    key = (int(px // cell), int(py // cell))
                    visits[key] += 1
                    runs_in_cell[key].add(s["id"])
        total = sum(visits.values())
        ranked = visits.most_common()
        top = ranked[: max(1, len(ranked) // 10)]
        rare = sum(1 for k in visits if len(runs_in_cell[k]) <= 1)
        print(f"{m:14} samples={total} cells_touched={len(ranked)} top10%cells={pct(sum(v for _, v in top), total)}  cells_seen_by_<=1_run={pct(rare, len(ranked))}")


def loot_vs_risk(shards, cell=64):
    """Loot pickups vs deaths per coarse zone: where is loot safe, where is it a trap?"""
    print(f"\n== Loot vs deaths by zone ({cell}px) ==")
    for m in MAPS:
        loot, deaths, runs = Counter(), Counter(), defaultdict(set)
        for s in shards:
            if s["map"] != m:
                continue
            for j in s["journeys"]:
                if j["kind"] != "human":
                    continue
                for t, typ, x, z, _ in j["events"]:
                    px, py = to_px(m, x, z)
                    key = (int(px // cell), int(py // cell))
                    if typ == "loot":
                        loot[key] += 1
                        runs[key].add(s["id"])
                    elif typ in ("death", "storm"):
                        deaths[key] += 1
        rows = [(k, loot[k], deaths[k], len(runs[k])) for k in loot if loot[k] >= 40]
        rows.sort(key=lambda r: r[2] / r[1], reverse=True)
        print(f"{m}: zones with >=40 pickups, sorted by deaths per 100 pickups")
        total_l = sum(loot.values())
        total_d = sum(deaths.values())
        print(
            f"   map average: {100 * total_d / total_l:.1f} deaths per 100 pickups"
            f" ({total_d} deaths / {total_l} pickups)"
        )
        shown = rows if len(rows) <= 8 else rows[:4] + rows[-4:]
        for (cx, cy), l, d, r in shown:
            print(
                f"   px=({cx * cell}-{cx * cell + cell}, {cy * cell}-{cy * cell + cell})"
                f"  loot={l:4} deaths={d:3}  per100={100 * d / l:5.1f}  runs={r}"
            )


def survivor_exits(shards):
    """Where survivors' telemetry ends (extraction candidates)."""
    print("\n== Survivor last-seen clusters (64px cells) ==")
    for m in MAPS:
        ends = Counter()
        n = 0
        for s in shards:
            if s["map"] != m:
                continue
            for j in s["journeys"]:
                if j["kind"] == "human" and j["outcome"] == "survived" and j["path"]:
                    px, py = to_px(m, j["path"][-2], j["path"][-1])
                    ends[(int(px // 64), int(py // 64))] += 1
                    n += 1
        top = ends.most_common(4)
        print(f"{m:14} survivors={n}  top cells: " + ", ".join(f"({x * 64},{y * 64})={c}" for (x, y), c in top) + f"  top4 share={pct(sum(c for _, c in top), n)}")


def storm_vs_exits(shards):
    """Distance from each storm death to the nearest survivor exit on the same map."""
    print("\n== Storm deaths vs nearest survivor exit (world units) ==")
    for m in MAPS:
        exits, storms = [], []
        for s in shards:
            if s["map"] != m:
                continue
            for j in s["journeys"]:
                if j["kind"] != "human" or not j["path"]:
                    continue
                if j["outcome"] == "survived":
                    exits.append((j["path"][-2], j["path"][-1]))
                elif j["outcome"] == "storm":
                    storms.append((j["path"][-2], j["path"][-1], j["end"]))
        if not storms or not exits:
            continue
        d = [min(((sx - ex) ** 2 + (sz - ez) ** 2) ** 0.5 for ex, ez in exits) for sx, sz, _ in storms]
        print(f"{m:14} storm deaths={len(storms)} median dist to nearest exit={st.median(d):.0f}  max={max(d):.0f}")


def main():
    manifest, shards = load()
    print("matches per map:", Counter(m["map"] for m in manifest["matches"]))
    outcomes(shards)
    late_game(shards)
    concentration(shards)
    coverage(shards)
    loot_vs_risk(shards)
    survivor_exits(shards)
    storm_vs_exits(shards)


if __name__ == "__main__":
    main()
