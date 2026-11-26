"""Turn raw LILA BLACK telemetry into static JSON shards for the web app.

Input:  data/raw/player_data/  (the unzipped player_data.zip)
Output: public/data/
          manifest.json            match index + pipeline report
          matches/<match>.json     one shard per match (journeys + events)
          heat/<map>.json          columnar points for heatmaps, per map
          minimaps/<map>.webp      web-sized minimap images

Every cleaning rule here is explained in docs/data-notes.md. The script is
deterministic: same input, byte-identical output.

Usage: python scripts/preprocess.py [raw_dir] [out_dir]
"""

from __future__ import annotations

import json
import re
import shutil
import sys
import time
from pathlib import Path

import duckdb
import pandas as pd
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "raw" / "player_data"
OUT_DIR = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "public" / "data"

MAPS = {
    "AmbroseValley": "AmbroseValley_Minimap.png",
    "GrandRift": "GrandRift_Minimap.png",
    "Lockdown": "Lockdown_Minimap.jpg",
}
MINIMAP_PX = 2048  # loaded first
MINIMAP_HI_PX = 4096  # swapped in when the user zooms past 2x
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

MOVEMENT = {"Position", "BotPosition"}
DEATHS = {"Killed", "BotKilled", "KilledByStorm"}
HUMAN_ONLY = {"Position", "Loot", "Kill", "Killed", "KilledByStorm"}

# Heatmap layer codes, shared with src/lib/types.ts (HeatLayerCode).
HEAT_TRAFFIC, HEAT_KILL, HEAT_DEATH, HEAT_STORM, HEAT_LOOT = 0, 1, 2, 3, 4


def load(raw_dir: Path) -> pd.DataFrame:
    """Read every parquet file. `ts` is stored as timestamp[ms] but its integer
    value is Unix *seconds*, so we pull the raw integer out with epoch_ms()."""
    files = sorted(p for p in raw_dir.glob("February_*/*.nakama-0") if p.is_file())
    if not files:
        sys.exit(f"No telemetry found under {raw_dir}. Unzip player_data.zip into data/raw/.")
    con = duckdb.connect()
    df = con.execute(
        """
        SELECT user_id, match_id, map_id, x, y, z,
               epoch_ms(ts)        AS ts,
               decode(event)       AS event,
               filename,
               file_row_number     AS row_in_file
        FROM read_parquet(?, filename = true, file_row_number = true)
        """,
        [[str(p) for p in files]],
    ).df()
    df["folder"] = df["filename"].map(lambda f: Path(f).parent.name)
    return df


def folder_to_date(folder: str) -> str:
    # "February_10" -> "2026-02-10" (dataset is Feb 10-14, 2026 per README)
    day = int(folder.split("_")[1])
    return f"2026-02-{day:02d}"


def clean(df: pd.DataFrame, report: dict) -> pd.DataFrame:
    report["rows_raw"] = int(len(df))
    report["files_raw"] = int(df["filename"].nunique())

    # 1. The same (user, match) file can appear in two day folders (byte-identical).
    #    Keep the copy in the earliest folder.
    first_folder = df.groupby(["user_id", "match_id"])["folder"].transform("min")
    dup_file_rows = df["folder"] != first_folder
    report["rows_dropped_duplicate_files"] = int(dup_file_rows.sum())
    df = df[~dup_file_rows].copy()

    # 2. Stable chronological order. ts has 1 s resolution, so ties keep file order.
    df = df.sort_values(["match_id", "user_id", "ts", "row_in_file"], kind="stable")

    # 3. Exact duplicate movement samples carry no information.
    key = ["user_id", "match_id", "x", "y", "z", "ts", "event"]
    dup = df.duplicated(subset=key) & df["event"].isin(MOVEMENT)
    report["rows_dropped_duplicate_positions"] = int(dup.sum())
    df = df[~dup]

    # 4. A journey ends at its first death. Drop repeated deaths and the few
    #    trailing samples logged 1-6 s after death.
    death_ts = df[df["event"].isin(DEATHS)].groupby(["user_id", "match_id"])["ts"].min()
    df = df.join(death_ts.rename("death_ts"), on=["user_id", "match_id"])
    after_death = df["death_ts"].notna() & (df["ts"] > df["death_ts"])
    is_death = df["event"].isin(DEATHS)
    repeat_death = is_death & is_death.groupby([df["user_id"], df["match_id"]]).cumsum().gt(1)
    report["rows_dropped_after_death"] = int(after_death.sum())
    report["rows_dropped_repeat_death"] = int((repeat_death & ~after_death).sum())
    df = df[~after_death & ~repeat_death].drop(columns="death_ts")

    report["rows_clean"] = int(len(df))
    return df


def classify(df: pd.DataFrame) -> pd.DataFrame:
    """Human vs bot by telemetry, not by ID. See data-notes section 5."""
    per_file = df.groupby(["user_id", "match_id"])["event"].agg(set)
    kind = per_file.map(lambda evs: "human" if evs & HUMAN_ONLY else "bot").rename("kind")
    df = df.join(kind, on=["user_id", "match_id"])
    df["id_kind"] = df["user_id"].map(lambda u: "uuid" if UUID_RE.match(u) else "numeric")
    return df


def r1(v: float) -> float:
    return round(float(v), 1)


def build_event(row, kind: str, self_kill_ts: set[int]):
    """Normalize a raw event row to [t, type, x, z, detail] or None.
    Types: kill | death | storm | loot. Detail is who the other party was."""
    ev = row.event
    if ev == "Loot":
        return "loot", None
    if ev == "KilledByStorm":
        return "storm", "storm"
    if ev == "BotKill":
        return "kill", "bot" if kind == "human" else "unknown"
    if ev == "BotKilled":
        return "death", "bot" if kind == "human" else "unknown"
    if ev == "Kill":
        # Every Kill in this dataset pairs with a Killed by the same user at the same
        # second: a self-elimination. That pair becomes one death with detail "self".
        return (None, None) if row.ts in self_kill_ts else ("kill", "player")
    if ev == "Killed":
        return "death", "self" if row.ts in self_kill_ts else "player"
    return None, None


def build_journey(g: pd.DataFrame, match_start: int) -> dict:
    kind = g["kind"].iat[0]
    kills_ts = set(g.loc[g["event"] == "Kill", "ts"])
    killed_ts = set(g.loc[g["event"] == "Killed", "ts"])
    self_kill_ts = kills_ts & killed_ts

    # The path is the movement samples, plus the death position as its final point.
    # Samples are kept even when the player hasn't moved: a hold from t=100 to t=160
    # must replay as standing still, not as a slow glide between the two ends. Only
    # exact repeats (same second, same spot) are dropped.
    path: list[float] = []
    events: list[list] = []
    last = None
    for row in g.itertuples(index=False):
        t = int(row.ts - match_start)
        xz = (r1(row.x), r1(row.z))
        is_movement = row.event in MOVEMENT
        etype, detail = (None, None) if is_movement else build_event(row, kind, self_kill_ts)
        if (is_movement or etype in ("death", "storm")) and (t, *xz) != last:
            path.extend([t, xz[0], xz[1]])
            last = (t, *xz)
        if etype:
            events.append([t, etype, xz[0], xz[1], detail])

    t0 = int(g["ts"].min() - match_start)
    t1 = int(g["ts"].max() - match_start)
    deaths = [e for e in events if e[1] in ("death", "storm")]
    if deaths:
        cause = deaths[0][4]
        outcome = {
            "bot": "killed_by_bot",
            "player": "killed_by_player",
            "self": "self_elimination",
            "storm": "storm",
            "unknown": "died",
        }[cause]
    else:
        outcome = "survived"

    return {
        "id": g["user_id"].iat[0],
        "kind": kind,
        "idKind": g["id_kind"].iat[0],
        "start": t0,
        "end": t1,
        "outcome": outcome,
        "stats": {
            "kills": sum(1 for e in events if e[1] == "kill"),
            "deaths": len(deaths),
            "loot": sum(1 for e in events if e[1] == "loot"),
            "survival": t1 - t0,
        },
        "path": path,
        "events": events,
    }


def build_matches(df: pd.DataFrame, out: Path, report: dict) -> list[dict]:
    (out / "matches").mkdir(parents=True, exist_ok=True)
    summaries = []
    for match_id, m in df.groupby("match_id", sort=True):
        start = int(m["ts"].min())
        journeys = [
            build_journey(g, start)
            for _, g in m.groupby("user_id", sort=False)
        ]
        # Humans first, then bots; stable by id for deterministic output.
        journeys.sort(key=lambda j: (j["kind"] != "human", j["id"]))
        short_id = match_id.removesuffix(".nakama-0")
        duration = int(m["ts"].max()) - start
        all_events = [e for j in journeys for e in j["events"]]
        humans = [j for j in journeys if j["kind"] == "human"]
        flags = []
        if any(j["idKind"] == "numeric" for j in humans):
            flags.append("numeric-id-human")
        if any(e[4] == "self" for e in all_events):
            flags.append("self-elimination")

        shard = {
            "id": short_id,
            "map": m["map_id"].iat[0],
            "date": folder_to_date(m["folder"].min()),
            "startUtc": start,
            "duration": duration,
            "journeys": journeys,
        }
        write_json(out / "matches" / f"{short_id}.json", shard)
        summaries.append(
            {
                "id": short_id,
                "map": shard["map"],
                "date": shard["date"],
                "startUtc": start,
                "duration": duration,
                "humans": len(humans),
                "bots": len(journeys) - len(humans),
                "kills": sum(1 for e in all_events if e[1] == "kill"),
                "deaths": sum(1 for e in all_events if e[1] == "death"),
                "storm": sum(1 for e in all_events if e[1] == "storm"),
                "loot": sum(1 for e in all_events if e[1] == "loot"),
                "survivors": sum(1 for j in humans if j["outcome"] == "survived"),
                "flags": flags,
            }
        )
    report["matches"] = len(summaries)
    return summaries


def build_heat(df: pd.DataFrame, out: Path, dates: list[str]) -> None:
    """Columnar points per map so the client can bin by any filter combination."""
    (out / "heat").mkdir(parents=True, exist_ok=True)
    df = df.copy()
    df["t"] = df["ts"] - df.groupby("match_id")["ts"].transform("min")
    match_date = df.groupby("match_id")["folder"].transform("min").map(folder_to_date)
    df["d"] = match_date.map({d: i for i, d in enumerate(dates)})

    # Self-kill pairs (Kill + Killed, same user, same second) count only as a death.
    key = df["user_id"] + "|" + df["match_id"] + "|" + df["ts"].astype(str)
    killed_keys = set(key[df["event"] == "Killed"])
    is_self_kill = df["event"].eq("Kill") & key.isin(killed_keys)
    df = df[~is_self_kill]

    layer = df["event"].map(
        {
            "Position": HEAT_TRAFFIC,
            "BotPosition": HEAT_TRAFFIC,
            "Kill": HEAT_KILL,
            "BotKill": HEAT_KILL,
            "Killed": HEAT_DEATH,
            "BotKilled": HEAT_DEATH,
            "KilledByStorm": HEAT_STORM,
            "Loot": HEAT_LOOT,
        }
    )
    df["e"] = layer
    df["k"] = (df["kind"] == "bot").astype(int)
    for map_id, g in df.groupby("map_id"):
        g = g.sort_values(["e", "d", "k", "t"], kind="stable")
        write_json(
            out / "heat" / f"{map_id}.json",
            {
                "map": map_id,
                "count": int(len(g)),
                "x": g["x"].round().astype(int).tolist(),
                "z": g["z"].round().astype(int).tolist(),
                "t": g["t"].astype(int).tolist(),
                "e": g["e"].astype(int).tolist(),
                "k": g["k"].tolist(),
                "d": g["d"].astype(int).tolist(),
            },
        )


def build_minimaps(raw_dir: Path, out: Path) -> dict:
    (out / "minimaps").mkdir(parents=True, exist_ok=True)
    meta = {}
    Image.MAX_IMAGE_PIXELS = None  # Lockdown is 9000x9000; trusted local asset
    for map_id, fname in MAPS.items():
        src = raw_dir / "minimaps" / fname
        with Image.open(src) as im:
            source_size = list(im.size)
            # Resample to an exact square. GrandRift is 2160x2158; stretching 2px
            # (0.09%) keeps the UV transform exact for every map.
            rgb = im.convert("RGB")
            for size, suffix in ((MINIMAP_PX, ""), (MINIMAP_HI_PX, "@hi")):
                web = rgb.resize((size, size), Image.LANCZOS)
                web.save(out / "minimaps" / f"{map_id}{suffix}.webp", "WEBP", quality=80, method=6)
        meta[map_id] = {
            "image": f"/data/minimaps/{map_id}.webp",
            "imageHi": f"/data/minimaps/{map_id}@hi.webp",
            "imageSize": MINIMAP_PX,
            "imageHiSize": MINIMAP_HI_PX,
            "sourceSize": source_size,
        }
    return meta


def write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


def main() -> None:
    started = time.time()
    report: dict = {}
    raw = load(RAW_DIR)
    df = classify(clean(raw, report))

    # Clear generated content but keep the directory (it may be open elsewhere).
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for child in OUT_DIR.iterdir():
        shutil.rmtree(child) if child.is_dir() else child.unlink()

    dates = sorted({folder_to_date(f) for f in df["folder"].unique()})
    summaries = build_matches(df, OUT_DIR, report)
    build_heat(df, OUT_DIR, dates)
    minimaps = build_minimaps(RAW_DIR, OUT_DIR)

    files = df.drop_duplicates(["user_id", "match_id"])
    report["journeys"] = int(len(files))
    report["journeys_human"] = int((files["kind"] == "human").sum())
    report["journeys_bot"] = int((files["kind"] == "bot").sum())
    report["journeys_numeric_id_human"] = int(
        ((files["kind"] == "human") & (files["id_kind"] == "numeric")).sum()
    )

    write_json(
        OUT_DIR / "manifest.json",
        {
            "version": 1,
            "dates": dates,
            "maps": minimaps,
            "report": report,
            "matches": summaries,
        },
    )
    print(json.dumps(report, indent=2))
    print(f"done in {time.time() - started:.1f}s -> {OUT_DIR}")


if __name__ == "__main__":
    main()
