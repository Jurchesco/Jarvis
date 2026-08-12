import { useMemo, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { BarChart3, LineChart, Target, Trophy } from "lucide-react-native";
import { useStatsData, type StatsRange } from "../../../src/api/hooks";
import type { SessionDetailFull } from "@bhmt3wp/shared";
import {
  Card,
  ICON_STROKE,
  Pills,
  ScreenHeader,
  StateBlock,
} from "../../../src/components/ui";

const PRIMARY = "#3b82f6";
const ACCENT = "#22c55e";
const TEXT_SECONDARY = "#c0c9d8";
const GRID = "#24324a";
const BAR_BG = "#1f2b44";

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "all", label: "Wszystko" },
];

function sessionVolume(session: SessionDetailFull): number {
  return session.exercises.reduce((total, group) => {
    return total + group.sets.reduce((setTotal, set) => setTotal + set.weightKg * set.reps, 0);
  }, 0);
}

function buildMaxWeightMap(sessions: SessionDetailFull[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const session of sessions) {
    for (const group of session.exercises) {
      const maxInGroup = group.sets.reduce((m, set) => Math.max(m, set.weightKg), 0);
      map.set(group.exerciseName, Math.max(map.get(group.exerciseName) ?? 0, maxInGroup));
    }
  }
  return map;
}

function collectExerciseNames(sessions: SessionDetailFull[]): string[] {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const group of session.exercises) {
      counts.set(group.exerciseName, (counts.get(group.exerciseName) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

function exerciseMaxWeightInSession(session: SessionDetailFull, exerciseName: string): number {
  const group = session.exercises.find((item) => item.exerciseName === exerciseName);
  if (!group) return 0;
  return group.sets.reduce((max, set) => Math.max(max, set.weightKg), 0);
}

interface VolumeChartProps {
  sessions: SessionDetailFull[];
  width: number;
  values: number[];
  yLabel?: string;
}

function TrendChart({ sessions, width, values, yLabel = "kg" }: VolumeChartProps) {
  const PADDING = { top: 20, right: 16, bottom: 36, left: 52 };
  const height = 210;
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  const filteredValues = values.filter((v) => v > 0);
  const maxVal = Math.max(...filteredValues, 1);
  const n = values.length;

  const xScale = (i: number) => (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yScale = (v: number) => chartH - (v / maxVal) * chartH;

  const points = values.map((v, i) => `${xScale(i)},${yScale(v)}`).join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: yScale(maxVal * t),
    label: Math.round(maxVal * t).toString(),
  }));

  return (
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

      {sessions.map((_, i) => (
        <SvgText
          key={sessions[i]?.id ?? i}
          x={PADDING.left + xScale(i)}
          y={PADDING.top + chartH + 16}
          fill={TEXT_SECONDARY}
          fontSize={10}
          textAnchor="middle"
        >
          {i + 1}
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
  );
}

function MaxWeightChart({ sessions, width }: { sessions: SessionDetailFull[]; width: number }) {
  const maxWeightMap = buildMaxWeightMap(sessions);
  const sorted = [...maxWeightMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  if (sorted.length === 0) return null;

  const LABEL_WIDTH = 110;
  const VALUE_WIDTH = 36;
  const BAR_AREA = width - LABEL_WIDTH - VALUE_WIDTH - 8;
  const ROW_HEIGHT = 28;
  const BAR_HEIGHT = 16;
  const PADDING_TOP = 8;
  const height = sorted.length * ROW_HEIGHT + PADDING_TOP * 2;

  const maxVal = sorted[0][1];

  return (
    <Svg width={width} height={height}>
      {sorted.map(([name, val], i) => {
        const barW = maxVal > 0 ? (val / maxVal) * BAR_AREA : 0;
        const y = PADDING_TOP + i * ROW_HEIGHT;
        const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
        const displayName = name.length > 14 ? `${name.slice(0, 13)}…` : name;

        return (
          <G key={name}>
            <SvgText x={0} y={y + ROW_HEIGHT / 2 + 4} fill={TEXT_SECONDARY} fontSize={11} textAnchor="start">
              {displayName}
            </SvgText>
            <Rect x={LABEL_WIDTH} y={barY} width={BAR_AREA} height={BAR_HEIGHT} rx={4} fill={BAR_BG} />
            <Rect x={LABEL_WIDTH} y={barY} width={barW} height={BAR_HEIGHT} rx={4} fill={ACCENT} />
            <SvgText
              x={LABEL_WIDTH + BAR_AREA + 6}
              y={y + ROW_HEIGHT / 2 + 4}
              fill={TEXT_SECONDARY}
              fontSize={11}
              textAnchor="start"
            >
              {val}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

export default function StatsScreen() {
  const [range, setRange] = useState<StatsRange>("3m");
  const { sessions, isLoading, totalInRange } = useStatsData(range);
  const { width } = useWindowDimensions();

  const exerciseNames = useMemo(() => collectExerciseNames(sessions), [sessions]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  const activeExercise = useMemo(() => {
    if (selectedExercise && exerciseNames.includes(selectedExercise)) return selectedExercise;
    return exerciseNames[0] ?? null;
  }, [exerciseNames, selectedExercise]);

  const volumeValues = useMemo(() => sessions.map(sessionVolume), [sessions]);
  const exerciseTrendValues = useMemo(() => {
    if (!activeExercise) return [];
    return sessions.map((session) => exerciseMaxWeightInSession(session, activeExercise));
  }, [sessions, activeExercise]);

  const contentHorizontalPadding = 20;
  const cardHorizontalPadding = 16;
  const availableChartWidth = width - contentHorizontalPadding * 2 - cardHorizontalPadding * 2;
  const chartWidth = Math.min(Math.max(availableChartWidth, 0), 360);

  const rangeLabel =
    RANGE_OPTIONS.find((option) => option.value === range)?.label ?? range;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Statystyki"
          subtitle={
            totalInRange > 0
              ? `${totalInRange} sesji w zakresie ${rangeLabel} — trendy i rekordy.`
              : "Zakończ trening, aby zobaczyć tutaj swoje trendy."
          }
          icon={BarChart3}
        />

        <Pills
          options={RANGE_OPTIONS}
          value={range}
          onChange={setRange}
          className="mt-5"
        />

        {isLoading ? (
          <StateBlock title="Ładowanie statystyk" description="Przetwarzanie danych treningowych." className="mt-6" />
        ) : sessions.length === 0 ? (
          <StateBlock
            title="Brak danych w tym zakresie"
            description="Zakończ trening lub wybierz szerszy zakres czasu."
            className="mt-6"
          />
        ) : (
          <>
            <Card className="mt-6" padding="md">
              <View className="mb-3 flex-row items-center">
                <LineChart size={16} strokeWidth={ICON_STROKE} color="#60a5fa" />
                <Text className="ml-2 text-text-primary text-base font-bold leading-tight">
                  Objętość w czasie
                </Text>
              </View>
              <Text className="mb-3 text-text-muted text-xs">Suma kg × powtórzenia na sesję</Text>
              <TrendChart sessions={sessions} width={chartWidth} values={volumeValues} yLabel="kg" />
            </Card>

            {activeExercise ? (
              <Card className="mt-5" padding="md">
                <View className="mb-3 flex-row items-center">
                  <Target size={16} strokeWidth={ICON_STROKE} color="#f59e0b" />
                  <Text className="ml-2 text-text-primary text-base font-bold leading-tight">
                    Trend ćwiczenia
                  </Text>
                </View>
                <Text className="mb-3 text-text-muted text-xs">
                  Maksymalny ciężar (kg) w sesji — wybierz ćwiczenie
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  <Pills
                    options={exerciseNames.slice(0, 12).map((name) => ({
                      value: name,
                      label: name.length > 18 ? `${name.slice(0, 17)}…` : name,
                    }))}
                    value={activeExercise}
                    onChange={setSelectedExercise}
                  />
                </ScrollView>
                <TrendChart
                  sessions={sessions}
                  width={chartWidth}
                  values={exerciseTrendValues}
                  yLabel="kg max"
                />
              </Card>
            ) : null}

            <Card className="mt-5" padding="md">
              <View className="mb-3 flex-row items-center">
                <Trophy size={16} strokeWidth={ICON_STROKE} color="#22c55e" />
                <Text className="ml-2 text-text-primary text-base font-bold leading-tight">
                  Maksymalny ciężar dla ćwiczenia
                </Text>
              </View>
              <Text className="mb-3 text-text-muted text-xs">
                Najcięższy zarejestrowany zestaw (kg), top 8 w zakresie
              </Text>
              <MaxWeightChart sessions={sessions} width={chartWidth} />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
