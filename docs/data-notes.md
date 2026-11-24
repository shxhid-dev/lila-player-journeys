# Data notes: LILA BLACK telemetry (Feb 10–14, 2026)

This is what the data actually contains, checked file by file. Where the
README and the data disagree, the data wins and the disagreement is listed in
[README vs. reality](#readme-vs-reality).

All numbers below come from reading every file. Nothing is estimated.

---

## 1. Inventory

| Item              | Value                                             |
| ----------------- | ------------------------------------------------- |
| Parquet files     | **1,243** (all readable, one schema, zero nulls)  |
| Non-data files    | `README.md`, `.DS_Store` (ignored)                |
| Rows              | **89,104**                                        |
| Unique `user_id`  | 339 (245 UUID, 94 numeric)                        |
| Unique `match_id` | 796                                               |
| Maps              | `AmbroseValley`, `GrandRift`, `Lockdown`          |
| Time span         | 2026-02-09 23:58:55 UTC → 2026-02-14 15:01:40 UTC |

Files per day folder × map:

| Map           | Feb 10 | Feb 11 | Feb 12 | Feb 13 | Feb 14 | Matches |
| ------------- | -----: | -----: | -----: | -----: | -----: | ------: |
| AmbroseValley |    315 |    197 |    177 |    103 |     44 |     566 |
| GrandRift     |     28 |     24 |      9 |     20 |     30 |      59 |
| Lockdown      |     94 |     71 |     82 |     43 |      5 |     171 |

Feb 14 is partial: the data stops at 15:01 UTC.

## 2. Schema

Physical schema, identical in all 1,243 files (written by `parquet-go`):

| Column     | Physical type                                              | Notes                                             |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `user_id`  | `string`                                                   | UUID = human, 4-digit number = bot (see §5)       |
| `match_id` | `string`                                                   | Always ends in `.nakama-0` (100% of rows)         |
| `map_id`   | `string`                                                   | One map per match (verified)                      |
| `x`        | `float32`                                                  | World X (horizontal)                              |
| `y`        | `float32`                                                  | World Y = **elevation**. Not used for 2D plotting |
| `z`        | `float32`                                                  | World Z (horizontal)                              |
| `ts`       | `int64` annotated `timestamp[ms]`, `isAdjustedToUTC=false` | **Value is Unix seconds, not ms.** See §4         |
| `event`    | `binary`                                                   | UTF-8 bytes. Decode with `.decode("utf-8")`       |

Filename `{user_id}_{match_id-without-suffix}.nakama-0` matches the columns in
100% of rows. Each file holds exactly one user in one match.

## 3. Event types

Counts across all files, split by the file owner's ID type:

| Event           |  Total | In UUID files | In numeric-ID files |
| --------------- | -----: | ------------: | ------------------: |
| `Position`      | 51,347 |        50,711 |               636 ⚠ |
| `BotPosition`   | 21,712 |             0 |              21,712 |
| `Loot`          | 12,885 |        12,770 |               115 ⚠ |
| `BotKill`       |  2,415 |         2,232 |                 183 |
| `BotKilled`     |    700 |           403 |                 297 |
| `KilledByStorm` |     39 |            39 |                   0 |
| `Kill`          |      3 |             3 |                   0 |
| `Killed`        |      3 |             3 |                   0 |

⚠ = human-only events showing up in bot files. See §5.

**Semantics, from the file owner's point of view.** I checked this by pairing
events across files:

| Event                      | In a human's file                | In a bot's file                           |
| -------------------------- | -------------------------------- | ----------------------------------------- |
| `Position` / `BotPosition` | position sample                  | position sample                           |
| `Kill`                     | this human killed a human        | n/a                                       |
| `Killed`                   | this human was killed by a human | n/a                                       |
| `BotKill`                  | this human killed a bot          | this bot got a kill (victim not recorded) |
| `BotKilled`                | this human was killed by a bot   | this bot died (killer not recorded)       |
| `KilledByStorm`            | this human died to the storm     | n/a                                       |
| `Loot`                     | item pickup                      | n/a                                       |

Kill events carry no victim ID, so kills can't be joined to victims reliably.
Only 29 of 159 bot deaths line up within 1 s with a human `BotKill` in the
same match.

**All 3 `Kill`/`Killed` pairs are self-kills.** In each one, `Kill` and
`Killed` are in the _same file_, from the same user, at the same second and
the same coordinates. So the dataset contains **zero human-vs-human kills**
over 5 days.

## 4. Timestamps: the README is wrong here

The README says `ts` is "milliseconds… time elapsed within the match". The
data says otherwise:

| Interpretation                                 | Result                                                                                                                                                                | Plausible? |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| ms since epoch (what the parquet type says)    | All 5 days fit inside 6 min 40 s on 1970-01-21. Median match lasts 0.38 s                                                                                             | No         |
| ms elapsed in the match (what the README says) | Values are ~1.77 billion, not near zero                                                                                                                               | No         |
| **Unix seconds**                               | 2026-02-09 23:58 → 2026-02-14 15:01 UTC. Matches the folder names and "Feb 14 partial". Median match 382 s, max 890 s. Position cadence 5 s. Median speed 2.5 units/s | **Yes**    |

**Decision:** treat the raw integer as Unix epoch seconds (UTC).
Match time is `t = ts − min(ts over every file in the match)`.

Consequences:

- **Resolution is 1 second.** Many events share a timestamp: there are 58,356
  distinct values across 89,104 rows. Within one second I keep file order.
- Position is sampled every **5 s** (87% of gaps). Other gaps are multiples of
  5 s, meaning samples were dropped. Longest gap is 518 s.
- Match duration: p10 138 s · median 382 s · p90 720 s · max 890 s.
- Folder dates are UTC days. One match (`ac049b28…`) started 2026-02-10 23:51
  UTC: its human file is in _both_ `February_10` and `February_11`
  (byte-identical), and its bot files are in `February_11`. **Decision:** dedupe
  the file and date the match by its UTC start (Feb 10).

## 5. Humans vs bots

README rule: UUID `user_id` = human, numeric `user_id` = bot. That holds for
**1,226 of 1,243 files**.

- 94 numeric IDs, all 4 digits, range 1379–1482.
- **Bot IDs are reused across matches** (81 of 94 appear in more than one
  match). They look like per-server slot numbers, not persistent identities.
  So no per-bot stats across matches.
- **Anomaly: 17 numeric-ID files behave like humans.** IDs 1429 (14 files),
  1379 (2) and 1402 (1) emit `Position` and `Loot` and never `BotPosition`.
  Their loot and kill counts look like a human's (e.g. 1429 in `de5aa1ae…`: 28
  loot, 4 bot kills, 120 position samples). The same ID 1429 emits normal
  `BotPosition` in other matches. Each file is in a different match. **16 of
  them are in the 16 matches that have no UUID file at all**. The 17th
  (`fbbc5d02…`) shares its match with a UUID human.

**Decision:** classify by telemetry, not by ID. A file that emits
`Position`/`Loot` is human-controlled, and one that emits `BotPosition` is a
bot. The ID type is kept as a separate field. The 17 anomalous files show up
as humans with a "numeric account ID" note. This changes 17 of 1,243 files and
is listed in ARCHITECTURE.md's assumptions table.

## 6. Match composition (important for the product)

Humans per match, by ID type (README rule) and by telemetry (what the tool
uses):

| Humans per match | By ID | By telemetry |
| ---------------- | ----: | -----------: |
| 0                |    16 |            0 |
| 1                |   779 |          794 |
| 2                |     1 |            2 |

| Bot files per match | Matches |
| ------------------- | ------: |
| 0                   |     744 |
| 4–15                |      52 |

So in practice **a "match" here is one human's journey.** Bot journeys exist
for only 52 of 796 matches. Yet humans log 2,232 bot kills, so most bots they
fought aren't in the data. What this means for the tool:

- Match playback must work, and look intentional, with a single player.
- Bot traffic heatmaps only reflect 52 matches. The UI says so.
- "Players in match" means _players with telemetry_, not lobby size.

## 7. Deaths, survival, post-death rows

- Human files: 441 have one death, 2 have a duplicated `BotKilled` (same
  second, same position), and **339 (43%) have no death**. There's no
  `Extract` event, so "no death" means extracted _or_ disconnected, and the
  data can't tell which. The UI calls this **"Survived"**, not "Extracted".
- 177 rows fall 1–6 s _after_ a death event (175 `Position`, 2 `BotKill`).
  **Decision:** a journey's path ends at its first death. These trailing rows
  are dropped and counted in the preprocessing report.
- Storm deaths happen only late: t = 655–887 s, spread across the whole map
  (17 AmbroseValley, 5 GrandRift, 17 Lockdown).

## 8. Duplicate rows

3,015 rows are exact duplicates on (user, match, x, y, z, ts, event):

| Event        | Dup rows | Decision                                                                                                              |
| ------------ | -------: | --------------------------------------------------------------------------------------------------------------------- |
| `Loot`       |    1,253 | **Keep.** With 1 s resolution, grabbing several items from one container gives identical rows. Each row is one pickup |
| `Position`   |      210 | Drop (zero-distance, zero-time samples)                                                                               |
| `BotKill`    |       39 | Keep (multi-kill in the same second, e.g. explosives)                                                                 |
| `BotKilled`  |        3 | Collapse: you can only die once                                                                                       |
| (whole file) |       88 | The cross-folder file from §4. Deduped at file level                                                                  |

## 9. Coordinate system and minimap mapping

The 2D map plane is **(x, z)**. `y` is elevation:

| Map           | Elevation y (min / median / max) |
| ------------- | -------------------------------- |
| AmbroseValley | 100.0 / 110.4 / 162.7            |
| GrandRift     | 8.1 / 22.9 / 46.9                |
| Lockdown      | 32.6 / 43.0 / 70.6               |

README transform (per map: `scale`, `origin_x`, `origin_z`):

```
u = (x − origin_x) / scale          v = (z − origin_z) / scale
pixel_x = u · W                     pixel_y = (1 − v) · H      ← image is Y-down
```

+x points right (east) on the image and **+z points up** (north). That's why
`v` is flipped.

| Map           | scale | origin (x, z) | World box x | World box z | Data x range   | Data z range   | Points outside box |
| ------------- | ----: | ------------- | ----------- | ----------- | -------------- | -------------- | -----------------: |
| AmbroseValley |   900 | (−370, −473)  | −370 … 530  | −473 … 427  | −325.0 … 301.8 | −380.0 … 360.8 |                  0 |
| GrandRift     |   581 | (−290, −290)  | −290 … 291  | −290 … 291  | −225.9 … 256.6 | −194.0 … 170.1 |                  0 |
| Lockdown      |  1000 | (−500, −500)  | −500 … 500  | −500 … 500  | −406.6 … 348.4 | −285.1 … 329.2 |                  0 |

**Actual minimap image sizes are not 1024×1024** (the README says they are):

| File                        | Actual size     | Format   | Size on disk |
| --------------------------- | --------------- | -------- | ------------ |
| `AmbroseValley_Minimap.png` | 4320 × 4320     | RGBA PNG | 9.7 MB       |
| `GrandRift_Minimap.png`     | **2160 × 2158** | RGBA PNG | 2.9 MB       |
| `Lockdown_Minimap.jpg`      | 9000 × 9000     | RGB JPEG | 11.8 MB      |

**Decision:** do the transform in UV space (0–1) and multiply by the actual
display size. The README's 1024 is just one choice of W/H. GrandRift is 2 px
short vertically (0.09%), so I resample it to square. The worst-case error is
under 1 px at display size. The images are too large for the web (24 MB in
total), so the pipeline re-encodes them as 2048 px WebP.

**Validation.** The README worked example (AmbroseValley, x = −301.45,
z = −355.55) gives (78.0, 890.4) on a 1024 grid, which matches the README's
(78, 890). Plotting all 89k points on each minimap
([AmbroseValley](img/calibration-AmbroseValley.jpg),
[GrandRift](img/calibration-GrandRift.jpg),
[Lockdown](img/calibration-Lockdown.jpg)) puts loot clusters on buildings,
movement on roads and paths, and **zero points** in water, cliffs or the black
void. A flipped or offset axis would show up immediately against those
landmarks.

## 10. Movement sanity

- Distance between consecutive samples: median 13.4 units (5 s apart), p99
  32.2, max 63.6.
- Speed: median 2.5 units/s, p99 6.4, max 12.7. No teleport glitches.
- 7 steps cover more than 60 units in one 5 s sample. Most **end at the same
  AmbroseValley spot (≈ −16, 10)**, from different players on different days.
  That looks like a traversal feature (zipline, jump pad or vehicle). It's a
  lead for the insights work.

## 11. What the data cannot support (won't be faked)

- **Storm geometry.** There are no storm position, radius or phase events.
  The README calls the storm "one-directional", not a circle. The tool shows
  storm _deaths_ only and says it can't draw the storm front.
- **Victim identity for kills.** Not recorded.
- **Extraction.** No event for it. "Survived" means no death was recorded.
- **Match winner.** It's an extraction shooter with no winner event. The match
  panel shows outcome per player instead.
- **Full lobbies.** Most matches have one journey (see §6).

## README vs. reality

| README says                                    | Data shows                                           | Handling                                        |
| ---------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| `ts` is ms of match-elapsed time               | Unix **seconds**, wall clock                         | Parse as seconds. Match time = ts − match start |
| Minimaps are 1024 × 1024                       | 4320², 2160 × 2158, 9000²                            | Map in UV space, scale to the real size         |
| Numeric ID ⇒ bot                               | 17 numeric-ID files emit human-only events           | Classify by telemetry, flag the ID              |
| Bots emit only `BotPosition/BotKill/BotKilled` | Same as above (17 files)                             | Same as above                                   |
| `Kill`/`Killed` = PvP                          | All 3 are self-kills                                 | Show them, labeled "self-elimination"           |
| ~89,000 rows                                   | 89,104 (3,015 exact dups, 88 from a duplicated file) | Dedup rules in §8                               |
