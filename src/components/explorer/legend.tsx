import { MarkerIcon, PathSwatch } from "@/components/ui/marker-icon";
import { BOT_COLOR, HUMAN_COLORS } from "@/lib/colors";
import { EVENT_TYPES } from "@/lib/types";

export function Legend() {
  return (
    <section aria-label="Legend" className="space-y-2 text-xs">
      <h2 className="text-[11px] font-medium tracking-wider text-muted uppercase">Legend</h2>
      <ul className="space-y-1.5">
        <li className="flex items-center gap-2">
          <span className="flex gap-0.5">
            {HUMAN_COLORS.map((c) => (
              <PathSwatch key={c} color={c} width={12} />
            ))}
          </span>
          Human (solid, one colour per player)
        </li>
        <li className="flex items-center gap-2">
          <PathSwatch color={BOT_COLOR} dashed width={38} />
          Bot (dashed, grey)
        </li>
        <li className="flex items-center gap-2">
          <svg width={38} height={14} aria-hidden className="shrink-0">
            <circle cx={8} cy={7} r={3} fill="#0b0d10" stroke={HUMAN_COLORS[0]} strokeWidth={1.5} />
            <circle cx={28} cy={7} r={5} fill="none" stroke={HUMAN_COLORS[0]} strokeWidth={2.5} />
          </svg>
          First seen · last seen alive
        </li>
        {EVENT_TYPES.map((t) => (
          <li key={t} className="flex items-center gap-2">
            <span className="flex w-[38px] justify-center">
              <MarkerIcon type={t} />
            </span>
            {
              {
                kill: "Kill (got a kill)",
                death: "Death (by bot or player)",
                storm: "Killed by storm",
                loot: "Loot pickup",
              }[t]
            }
          </li>
        ))}
      </ul>
      <p className="leading-relaxed text-muted">
        The storm front itself isn&apos;t in the telemetry, so only storm deaths are shown.
      </p>
    </section>
  );
}
