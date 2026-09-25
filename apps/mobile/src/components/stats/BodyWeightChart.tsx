import { useMemo } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import type { BodyMeasurement } from "@bhmt3wp/shared";
import { Button, Pills } from "../ui";

const PRIMARY = "#34d399";
const GOAL = "#fbbf24";
const GRID = "#24324a";
const TEXT_SECONDARY = "#c0c9d8";

export type WeightChartRange = "1m" | "3m" | "1y" | "all";

const RANGE_OPTIONS: { value: WeightChartRange; label: string }[] = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "1y", label: "1R" },
  { value: "all", label: "Wszystko" },
];

function filterByRange(rows: BodyMeasurement[], range: WeightChartRange): BodyMeasurement[] {
  if (range === "all") return rows;
  const days = range === "1m" ? 30 : range === "3m" ? 90 : 365;
  const cutoff = Date.now() - days * 86_400_000;
  return rows.filter((r) => new Date(r.measuredAt).getTime() >= cutoff);
}

export function BodyWeightChart({
  measurements,
  goalKg,
  range,
  onRangeChange,
  onWeighIn,
}: {
  measurements: BodyMeasurement[];
  goalKg: number | null;
  range: WeightChartRange;
  onRangeChange: (r: WeightChartRange) => void;
  onWeighIn?: () => void;
}) {
  const { width: winW } = useWindowDimensions();
  const width = Math.min(Math.max(winW - 20 * 2 - 16 * 2, 0), 360);

  const points = useMemo(() => {
    const filtered = filterByRange(measurements, range).sort(
      (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
    );
    return filtered.map((m) => m.weightKg);
  }, [measurements, range]);

  const PADDING = { top: 20, right: 16, bottom: 28, left: 44 };
  const height = 170;
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  const valuesForScale = [...points];
  if (goalKg != null) valuesForScale.push(goalKg);
  const minV = valuesForScale.length ? Math.min(...valuesForScale) : 0;
  const maxV = valuesForScale.length ? Math.max(...valuesForScale) : 1;
  const pad = Math.max((maxV - minV) * 0.08, 0.5);
  const yMin = minV - pad;
  const yMax = maxV + pad;
  const span = yMax - yMin || 1;

  const n = points.length;
  const xScale = (i: number) => (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yScale = (v: number) => chartH - ((v - yMin) / span) * chartH;
  const poly = points.map((v, i) => `${xScale(i)},${yScale(v)}`).join(" ");
  const goalY = goalKg != null ? yScale(goalKg) : null;

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <Pills options={RANGE_OPTIONS} value={range} onChange={onRangeChange} />
        {onWeighIn ? (
          <Button label="Weigh-in" variant="ghost" size="sm" onPress={onWeighIn} />
        ) : null}
      </View>

      {points.length === 0 ? (
        <Text className="text-text-muted text-sm leading-5">
          Brak pomiarów wagi. Dodaj weigh-in w Ustawieniach albo zaimportuj openScale.
        </Text>
      ) : (
        <Svg width={width} height={height}>
          <Line
            x1={PADDING.left}
            y1={PADDING.top + chartH}
            x2={PADDING.left + chartW}
            y2={PADDING.top + chartH}
            stroke={GRID}
            strokeWidth={1}
          />
          {goalY != null ? (
            <Line
              x1={PADDING.left}
              y1={PADDING.top + goalY}
              x2={PADDING.left + chartW}
              y2={PADDING.top + goalY}
              stroke={GOAL}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          ) : null}
          {[0, 0.5, 1].map((t) => {
            const v = yMin + span * t;
            const y = yScale(v);
            return (
              <SvgText
                key={t}
                x={PADDING.left - 6}
                y={PADDING.top + y + 3}
                fill={TEXT_SECONDARY}
                fontSize={10}
                textAnchor="end"
              >
                {Math.round(v)}
              </SvgText>
            );
          })}
          {n > 1 ? (
            <Polyline
              points={poly}
              fill="none"
              stroke={PRIMARY}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              transform={`translate(${PADDING.left},${PADDING.top})`}
            />
          ) : null}
          {points.map((v, i) => (
            <Circle
              key={i}
              cx={PADDING.left + xScale(i)}
              cy={PADDING.top + yScale(v)}
              r={3.5}
              fill={PRIMARY}
            />
          ))}
          {goalKg != null ? (
            <SvgText
              x={PADDING.left + chartW}
              y={PADDING.top + (goalY ?? 0) - 4}
              fill={GOAL}
              fontSize={9}
              textAnchor="end"
            >
              cel {goalKg} kg
            </SvgText>
          ) : null}
        </Svg>
      )}
    </View>
  );
}
