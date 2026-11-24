# Architecture

A static, client-rendered tool. A one-shot Python pipeline turns 1,243 parquet files into compact
JSON shards. A Next.js app fetches only what the current view needs and draws it on a Konva
canvas. There is no server or database at runtime: 5 days of telemetry is 5 MB.

## Stack and why

| Layer         | Choice                                   | Why                                                                                                                                                                                   |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pipeline      | Python, DuckDB, pandas, Pillow           | DuckDB reads every parquet file in one SQL pass and exposes `ts` as its raw integer, which mattered here (see below). Pillow re-encodes the 24 MB minimaps as WebP                    |
| App           | Next.js 15 (App Router), TypeScript      | Typed end to end, static output, deploys to Vercel with zero config                                                                                                                   |
| Canvas        | Konva via react-konva                    | Retained-mode canvas with per-shape hit testing (hover cards on paths and markers), layer caching and built-in PNG export. A typical match is under 2k shapes, so WebGL wasn't needed |
| State         | URL query string + Zustand               | Every shareable setting lives in the URL. Zustand holds transient state (hover, playback clock, viewport)                                                                             |
| Data fetching | TanStack Query                           | Caching and dedupe for shards and lazily loaded heatmap points                                                                                                                        |
| UI            | Tailwind v4, Radix primitives, lucide    | Accessible slider/dialog/tooltip primitives without a component framework                                                                                                             |
| Quality       | Vitest, ESLint, Prettier, GitHub Actions | CI runs lint, typecheck, format, tests and build on every push                                                                                                                        |

## Data flow

```
player_data/February_*/*.nakama-0   (1,243 parquet files, 89,104 rows)
        │  scripts/preprocess.py (DuckDB → pandas)
        │   • ts = raw int (Unix seconds), event bytes → utf-8
        │   • dedupe, end journeys at first death, classify human/bot by telemetry
        ▼
public/data/
  manifest.json            match index (796 summaries) + dates + pipeline report     168 KB
  matches/<id>.json        one shard per match: journeys (paths + events)   avg 2.6 KB
  heat/<map>.json          columnar points (x, z, t, layer, kind, date) per map  0.1–1 MB
  minimaps/<map>.webp      2048 px (loaded first) and @hi 4096 px (on deep zoom)
        │  fetch (TanStack Query, cached forever per deploy)
        ▼
URL state (useViewState) ──► buildScene(): shards → minimap-space paths + events
                         ──► binPoints(): heat points → density grid
        ▼
Konva stage: minimap → heatmap → calibration grid → journeys → markers → hover card
```

The page loads the manifest, the minimap and one shard (about 350 KB). Heatmap points load only
when a heatmap is turned on.

## Coordinate mapping

Telemetry is 3D `(x, y, z)` with **y = elevation**, so the map plane is `(x, z)`. The README gives
each map a square world box (`scale`, `origin_x`, `origin_z`):

```
u  = (x − origin_x) / scale            0 at the west edge, 1 at the east edge
v  = (z − origin_z) / scale            0 at the south edge, 1 at the north edge
px = u · S
py = (1 − v) · S                       image rows grow downward, world +z grows north
```

```
 world (x, z)                         minimap pixels (S × S)
   z ▲  (max x, max z)                (0,0) ┌──────────────► px
     │ ┌────────────┐                       │  (S, 0) = (max x, max z)
     │ │            │      flip v           │
     │ │   map      │   ───────────►        │
     │ └────────────┘                       ▼ py
     └──────────────► x                (0, S) = (origin_x, origin_z)
 (origin_x, origin_z)
```

| Map           | scale | origin (x, z) |
| ------------- | ----: | ------------- |
| AmbroseValley |   900 | (−370, −473)  |
| GrandRift     |   581 | (−290, −290)  |
| Lockdown      |  1000 | (−500, −500)  |

**Implementation.** `worldToMinimap(x, z, mapId)` and its inverse `minimapToWorld` in
`src/lib/coords.ts` are the only places world coordinates become pixels. The pipeline stores world
units, and every path, marker, heatmap bin and grid line goes through these two functions. Layout
happens in a canonical `S = 1024` space (the README's own size). The minimap image is stretched to
1024×1024 whatever its real resolution, and pan/zoom is a transform on top.

**The README's 1024 px claim is wrong**: the images are 4320², 2160×2158 and 9000². Because the
transform is defined in UV space, only S changes. Grand Rift's 2 px non-square edge is resampled
to square, which moves nothing by more than 0.09%.

**Validation, four ways:**

1. **Unit tests** (`coords.test.ts`, 21 cases). They cover the README worked example
   (−301.45, −355.55 → 78, 890), corners to corners, centre to centre, axis direction, round-trips
   under 1 px on all maps, linear scaling to any image size, and every observed data extent inside
   0..1.
2. **Data overlays.** I plotted all 89k points on each minimap
   ([docs/img/calibration-*.jpg](docs/img/)). Loot lands on buildings, movement follows roads, and
   nothing falls in water or the void. A flipped or offset axis would be obvious.
3. **Calibration grid in the app** (button or `G`). It draws world grid lines, axes, the world box
   and the README example through the same transform, plus a live cursor readout of world and
   minimap coordinates, so any reviewer can spot-check a landmark.
4. **Bounds check.** 0 of 89,104 points fall outside their map's world box.

## Assumptions

| Ambiguity                                                     | What I chose                                                                               | Why                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ts` typed `timestamp[ms]`, README says "ms elapsed in match" | Treat the raw integer as **Unix seconds**                                                  | As ms, all 5 days fit in 6.7 minutes and matches last 0.4 s. As seconds, data spans Feb 9 23:58 → Feb 14 15:01 UTC (matching the folders), matches last 2–15 minutes, positions arrive every 5 s and speeds are 2.5 units/s |
| Match time origin                                             | `t = ts − min(ts in match)`                                                                | No match-start event exists                                                                                                                                                                                                 |
| Human vs bot                                                  | By **telemetry**: `Position`/`Loot` = human, `BotPosition` = bot. ID format kept as a flag | 17 numeric-ID files emit human-only events (looting, `Position`), contradicting the README's ID rule                                                                                                                        |
| `Kill` + `Killed` by the same user in the same second         | One death, "self-elimination"                                                              | All 3 PvP rows in the dataset are this pattern                                                                                                                                                                              |
| Event perspective                                             | Events describe the file owner: in a bot file `BotKill` = the bot got a kill               | Kill events carry no victim ID, and only 29 of 159 bot deaths pair with a human kill                                                                                                                                        |
| No death recorded                                             | "Survived", not "Extracted"                                                                | There is no extraction event, so extraction and disconnect can't be told apart                                                                                                                                              |
| Rows 1–6 s after a death (177)                                | Dropped, so the journey ends at the death                                                  | Death-cam samples, not movement                                                                                                                                                                                             |
| Exact duplicate rows (3,015)                                  | Drop duplicate positions and repeated deaths. Keep duplicate `Loot`/`BotKill`              | With 1 s resolution, several pickups from one container in the same second are real separate events                                                                                                                         |
| Same file in two day folders                                  | Keep the earliest folder. A match's date is its earliest folder                            | The file is byte-identical, and the match started before midnight UTC                                                                                                                                                       |
| Storm                                                         | Show storm **deaths** only, and say so in the UI                                           | No storm position or phase data exists, and the README's storm is "one-directional", not a circle                                                                                                                           |
| Match winner                                                  | Not shown                                                                                  | An extraction shooter has no winner event. Per-player outcome is shown instead                                                                                                                                              |
| Featured match when a link names none                         | Most journeys, then most combat, then longest                                              | Deterministic, so a bare URL always opens on the same rich example                                                                                                                                                          |

Full evidence for each row is in [docs/data-notes.md](docs/data-notes.md).

## Tradeoffs

| Decision          | Considered                              | Chose                                                                 | Why                                                                                                                                                                                                       |
| ----------------- | --------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting model     | API + DuckDB/Postgres at runtime        | Static JSON shards on Vercel's CDN                                    | 5 MB of immutable data. A backend would add latency, cost and failure modes for no benefit                                                                                                                |
| Shard granularity | One big file; per map/date              | Per match, plus per-map heat points                                   | The first paint needs one ~3 KB match. Heatmaps need everything on a map, but only when switched on                                                                                                       |
| Heatmap binning   | Pre-binned grids per filter combination | Columnar points, binned client-side (≈60k points in a few ms)         | Every combination of date × player type × layer × bin size works without a combinatorial build                                                                                                            |
| Rendering         | SVG; PixiJS/WebGL                       | Konva canvas                                                          | Shape hit-testing and PNG export built in, and the point counts don't need WebGL                                                                                                                          |
| Marker size       | Scale with zoom                         | Constant screen size (inverse-scaled)                                 | Markers stay legible zoomed out and never swamp the map zoomed in                                                                                                                                         |
| Colour            | Rainbow per player                      | 3 validated categorical hues for humans, neutral dashed grey for bots | The palette passes colour-blind and normal-vision separation checks on the dark minimaps for exactly 3 colours, so compare mode caps at 3 matches. Bots number up to 15, so identity is on hover, not hue |
| Heat scale        | Linear                                  | log scale, clipped at p99                                             | Traffic is heavy-tailed. Linear shows one white blob and nothing else                                                                                                                                     |
| Minimap delivery  | Original files (24 MB)                  | 2048 px WebP plus 4096 px on deep zoom                                | Fast first load, and still sharp at 8× zoom                                                                                                                                                               |
| State             | Redux / React context                   | URL as source of truth + Zustand for transient state                  | A Level Designer can paste a link that reproduces the exact view, including playback time                                                                                                                 |
| Dark mode         | Light/dark toggle                       | Dark only                                                             | The minimaps are dark imagery, and a light chrome around them hurts contrast                                                                                                                              |
