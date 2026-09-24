import { Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import type { SessionDetailFull } from "@bhmt3wp/shared";
import { formatVolumeKg, formatWeightKg } from "@bhmt3wp/shared";

const PRIMARY = "#3b82f6";
const TEXT_SECONDARY = "#c0c9d8";
const GRID = "#24324a";

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

function pickXLabelIndexes(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  if (n === 2) return [0, 1];
  if (n <= 5) return Array.from({ length: n }, (_, i) => i);
  // first, ~1/3, ~2/3, last
  return [
    0,
    Math.round((n - 1) / 3),
    Math.round((2 * (n - 1)) / 3),
    n - 1,
  ].filter((v, i, arr) => arr.indexOf(v) === i);
}

export function formatExerciseSetsLine(
  session: SessionDetailFull,
  exerciseName: string,
): string {
  const group = session.exercises.find((g) => g.exerciseName === exerciseName);
  if (!group || group.sets.length === 0) return "—";
  return group.sets
    .map((s) => {
      if (s.reps > 0 && s.weightKg > 0) return `${s.weightKg}×${s.reps}`;
      if (s.reps > 0 && s.weightKg === 0) return `${s.reps} powt.`;
      // timed: reps often hold seconds in our model for time-based — show kg if any
      return s.weightKg > 0 ? `${s.weightKg} kg` : "seria";
    })
    .join("  ");
}

/** Line chart with date ticks, recent-session list, and Best caption (OpenGym-inspired UX). */
export function ReadableTrendChart({
  sessions,
  width,
  values,
  yLabel = "kg",
  mode = "volume",
  exerciseName,
  caption,
}: {
  sessions: SessionDetailFull[];
  width: number;
  values: number[];
  yLabel?: string;
  mode?: "volume" | "exercise";
  exerciseName?: string;
  caption?: string;
}) {
  const PADDING = { top: 20, right: 12, bottom: 40, left: 48 };
  const height = 200;
  const chartW = Math.max(width - PADDING.left - PADDING.right, 40);
  const chartH = height - PADDING.top - PADDING.bottom;

  const filteredValues = values.filter((v) => v > 0);
  const maxVal = Math.max(...filteredValues, 1);
  const bestVal = filteredValues.length ? Math.max(...filteredValues) : 0;
  const n = values.length;

  const xScale = (i: number) => (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yScale = (v: number) => chartH - (v / maxVal) * chartH;
  const points = values.map((v, i) => `${xScale(i)},${yScale(v)}`).join(" ");
  const yTicks = [0, 0.5, 1].map((t) => ({
    y: yScale(maxVal * t),
    label: Math.round(maxVal * t).toString(),
  }));
  const xLabels = pickXLabelIndexes(n);

  const recent = [...sessions]
    .map((s, i) => ({ session: s, value: values[i] ?? 0, index: i }))
    .filter((row) => row.value > 0)
    .slice(-5)
    .reverse();

  const defaultCaption =
    mode === "volume"
      ? "Objętość (kg×powt.) na sesję"
      : "Wartość metryki na sesję";

  return (
    <View>
      <Svg width={width} height={height}>
        <Line
          x1={PADDING.left}
          y1={PADDING.top}
          x2={PADDING.left}
          y2={PADDING.top + chartH}
          stroke={GRID}
          strokeWidth={1}
        />
        <Line
          x1={PADDING.left}
          y1={PADDING.top + chartH}
          x2={PADDING.left + chartW}
          y2={PADDING.top + chartH}
          stroke={GRID}
          strokeWidth={1}
        />

        {yTicks.map(({ y, label }) => (
          <SvgText
            key={label}
            x={PADDING.left - 6}
            y={PADDING.top + y + 4}
            fill={TEXT_SECONDARY}
            fontSize={10}
            textAnchor="end"
          >
            {label}
          </SvgText>
        ))}

        {xLabels.map((i) => (
          <SvgText
            key={sessions[i]?.id ?? i}
            x={PADDING.left + xScale(i)}
            y={PADDING.top + chartH + 16}
            fill={TEXT_SECONDARY}
            fontSize={9}
            textAnchor="middle"
          >
            {shortDate(sessions[i]?.completedAt ?? sessions[i]?.startedAt)}
          </SvgText>
        ))}

        {n > 1 ? (
          <Polyline
            points={points}
            fill="none"
            stroke={PRIMARY}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            transform={`translate(${PADDING.left},${PADDING.top})`}
          />
        ) : null}

        {values.map((v, i) =>
          v > 0 ? (
            <Circle
              key={i}
              cx={PADDING.left + xScale(i)}
              cy={PADDING.top + yScale(v)}
              r={4}
              fill={PRIMARY}
            />
          ) : null,
        )}

        <SvgText
          x={PADDING.left - 6}
          y={PADDING.top - 4}
          fill={TEXT_SECONDARY}
          fontSize={9}
          textAnchor="end"
        >
          {yLabel}
        </SvgText>
      </Svg>

      <Text className="text-text-muted text-xs mt-1 leading-5">
        {caption ?? defaultCaption}
        {bestVal > 0 ? (
          <>
            {" · Best: "}
            <Text className="text-emphasis font-semibold">
              {mode === "volume"
                ? formatVolumeKg(bestVal)
                : `${formatWeightKg(bestVal).replace(" kg", "")} ${yLabel === "1RM" ? "kg est." : "kg"}`}
            </Text>
          </>
        ) : null}
      </Text>

      {recent.length > 0 ? (
        <View className="mt-3 border-t border-border pt-3">
          <Text className="text-text-muted text-[10px] font-semibold uppercase mb-2">
            Ostatnie sesje
          </Text>
          {recent.map(({ session, value }) => (
            <View
              key={session.id}
              className="flex-row items-start justify-between py-1.5 border-b border-border/60"
            >
              <Text className="text-text-muted text-xs w-[72px]">
                {shortDate(session.completedAt ?? session.startedAt)}
              </Text>
              <Text className="flex-1 text-text-secondary text-xs leading-4 pr-2" numberOfLines={2}>
                {mode === "exercise" && exerciseName
                  ? formatExerciseSetsLine(session, exerciseName)
                  : session.sheetName || "Sesja"}
              </Text>
              <Text className="text-text-primary text-xs font-semibold">
                {mode === "volume"
                  ? formatVolumeKg(value)
                  : yLabel === "1RM"
                    ? formatWeightKg(value)
                    : `${value} kg`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
