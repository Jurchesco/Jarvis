import { useMemo, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { BarChart3, Layers, LineChart, Target, Trophy } from "lucide-react-native";
import { useStatsData, type StatsRange } from "../../../src/api/hooks";
import type { SessionDetailFull } from "@bhmt3wp/shared";
import {
  computeExerciseRecords,
  computeMuscleSetVolume,
  computeMuscleSetVolumeForWeek,
  formatRecordDate,
  formatWeightKg,
  formatWeightedSets,
  sessionBestEst1rm,
  sessionMaxWeightKg,
  type ExerciseRecord,
  type MuscleVolumeRow,
} from "@bhmt3wp/shared";
import {
  Badge,
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

type MuscleScope = "week" | "range";
type TrendMetric = "weight" | "e1rm";

const MUSCLE_SCOPE_OPTIONS: { value: MuscleScope; label: string }[] = [
  { value: "week", label: "Ten tydzień" },
  { value: "range", label: "W zakresie" },
];

const TREND_METRIC_OPTIONS: { value: TrendMetric; label: string }[] = [
  { value: "e1rm", label: "Est. 1RM" },
  { value: "weight", label: "Ciężar max" },
];

function sessionVolume(session: SessionDetailFull): number {
  return session.exercises.reduce((total, group) => {
    return total + group.sets.reduce((setTotal, set) => setTotal + set.weightKg * set.reps, 0);
  }, 0);
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

function MuscleVolumeChart({ rows, width }: { rows: MuscleVolumeRow[]; width: number }) {
  if (rows.length === 0) return null;

  const LABEL_WIDTH = 88;
  const VALUE_WIDTH = 40;
  const BAR_AREA = Math.max(width - LABEL_WIDTH - VALUE_WIDTH - 8, 40);
  const ROW_HEIGHT = 28;
  const BAR_HEIGHT = 16;
  const PADDING_TOP = 8;
  const height = rows.length * ROW_HEIGHT + PADDING_TOP * 2;
  const maxVal = Math.max(...rows.map((row) => row.sets), 1);

  return (
    <Svg width={width} height={height}>
      {rows.map((row, i) => {
        const barW = (row.sets / maxVal) * BAR_AREA;
        const y = PADDING_TOP + i * ROW_HEIGHT;
        const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;

        return (
          <G key={row.muscle}>
            <SvgText x={0} y={y + ROW_HEIGHT / 2 + 4} fill={TEXT_SECONDARY} fontSize={11} textAnchor="start">
              {row.label}
            </SvgText>
            <Rect x={LABEL_WIDTH} y={barY} width={BAR_AREA} height={BAR_HEIGHT} rx={4} fill={BAR_BG} />
            <Rect x={LABEL_WIDTH} y={barY} width={barW} height={BAR_HEIGHT} rx={4} fill={PRIMARY} />
            <SvgText
              x={LABEL_WIDTH + BAR_AREA + 6}
              y={y + ROW_HEIGHT / 2 + 4}
              fill={TEXT_SECONDARY}
              fontSize={11}
              textAnchor="start"
            >
              {formatWeightedSets(row.sets)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function RecordsList({ records }: { records: ExerciseRecord[] }) {
  if (records.length === 0) {
    return (
      <Text className="text-text-secondary text-sm leading-5">
        Brak rekordów w tym zakresie — zaloguj serie z ciężarem.
      </Text>
    );
  }

  return (
    <View className="gap-3">
      {records.map((row) => (
        <View
          key={row.exerciseName}
          className="rounded-xl border border-border bg-surface-muted px-3 py-3"
        >
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-text-primary text-sm font-semibold leading-5" numberOfLines={2}>
              {row.exerciseName}
            </Text>
            <Badge label={`${row.sessionCount}×`} tone="neutral" />
          </View>

          <View className="mt-2.5 flex-row flex-wrap gap-2">
            <View className="rounded-lg border border-border bg-background px-2.5 py-1.5 min-w-[46%] flex-1">
              <Text className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">
                PR ciężar
              </Text>
              <Text className="mt-0.5 text-text-primary text-base font-bold">
                {row.maxWeight.weightKg} kg
              </Text>
              <Text className="text-text-muted text-xs mt-0.5">
                {row.maxWeight.weightKg}×{row.maxWeight.reps} · {formatRecordDate(row.maxWeight.at)}
              </Text>
            </View>

            <View className="rounded-lg border border-border bg-background px-2.5 py-1.5 min-w-[46%] flex-1">
              <Text className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">
                Best Est. 1RM
              </Text>
              {row.bestEst1rm ? (
                <>
                  <Text className="mt-0.5 text-emphasis text-base font-bold">
                    {formatWeightKg(row.bestEst1rm.est1rm)}
                  </Text>
                  <Text className="text-text-muted text-xs mt-0.5">
                    {row.bestEst1rm.weightKg}×{row.bestEst1rm.reps} ·{" "}
                    {formatRecordDate(row.bestEst1rm.at)}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="mt-0.5 text-text-secondary text-base font-bold">—</Text>
                  <Text className="text-text-muted text-xs mt-0.5">Brak serii ≤12 powt.</Text>
                </>
              )}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function trendDeltaLabel(values: number[]): string | null {
  const nonzero = values.map((v, i) => ({ v, i })).filter((x) => x.v > 0);
  if (nonzero.length < 2) return null;
  const first = nonzero[0].v;
  const last = nonzero[nonzero.length - 1].v;
  const delta = Math.round((last - first) * 10) / 10;
  if (delta === 0) return "Bez zmian vs pierwsza sesja w zakresie";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${Math.abs(delta)} kg vs pierwsza sesja w zakresie`;
}

export default function StatsScreen() {
  const [range, setRange] = useState<StatsRange>("3m");
  const [muscleScope, setMuscleScope] = useState<MuscleScope>("week");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("e1rm");
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
    return sessions.map((session) =>
      trendMetric === "e1rm"
        ? sessionBestEst1rm(session, activeExercise)
        : sessionMaxWeightKg(session, activeExercise),
    );
  }, [sessions, activeExercise, trendMetric]);

  const exerciseTrendDelta = useMemo(
    () => trendDeltaLabel(exerciseTrendValues),
    [exerciseTrendValues],
  );

  const records = useMemo(() => computeExerciseRecords(sessions).slice(0, 10), [sessions]);

  const muscleRows = useMemo(() => {
    if (muscleScope === "week") return computeMuscleSetVolumeForWeek(sessions);
    return computeMuscleSetVolume(sessions);
  }, [sessions, muscleScope]);

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
              ? `${totalInRange} sesji w zakresie ${rangeLabel} — partie, trendy i rekordy.`
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
                <Trophy size={16} strokeWidth={ICON_STROKE} color="#22c55e" />
                <Text className="ml-2 text-text-primary text-base font-bold leading-tight">
                  Rekordy (PR)
                </Text>
              </View>
              <Text className="mb-3 text-text-muted text-xs leading-4">
                Najcięższa seria i najlepszy Est. 1RM (Epley, serie ≤12 powt.) w wybranym zakresie —
                top 10 ćwiczeń.
              </Text>
              <RecordsList records={records} />
            </Card>

            <Card className="mt-5" padding="md">
              <View className="mb-3 flex-row items-center">
                <Layers size={16} strokeWidth={ICON_STROKE} color="#a78bfa" />
                <Text className="ml-2 text-text-primary text-base font-bold leading-tight">
                  Objętość per partia
                </Text>
              </View>
              <Text className="mb-3 text-text-muted text-xs leading-4">
                Serie ważone: główna partia 1,0 · pomocnicza 0,5 (katalog ćwiczeń). Ćwiczenia spoza
                katalogu nie wchodzą do sumy.
              </Text>
              <Pills
                options={MUSCLE_SCOPE_OPTIONS}
                value={muscleScope}
                onChange={setMuscleScope}
                className="mb-4"
              />
              {muscleRows.length === 0 ? (
                <Text className="text-text-secondary text-sm leading-5">
                  {muscleScope === "week"
                    ? "Brak zalogowanych serii z katalogu w tym tygodniu (pon–ndz)."
                    : "Brak serii z katalogu w wybranym zakresie."}
                </Text>
              ) : (
                <MuscleVolumeChart rows={muscleRows} width={chartWidth} />
              )}
            </Card>

            <Card className="mt-5" padding="md">
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
                <Text className="mb-3 text-text-muted text-xs leading-4">
                  {trendMetric === "e1rm"
                    ? "Najlepszy Est. 1RM (Epley) w sesji — serie powyżej 12 powt. pomijane"
                    : "Maksymalny ciężar (kg) w sesji"}
                  {exerciseTrendDelta ? ` · ${exerciseTrendDelta}` : ""}
                </Text>
                <Pills
                  options={TREND_METRIC_OPTIONS}
                  value={trendMetric}
                  onChange={setTrendMetric}
                  className="mb-3"
                />
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
                  yLabel={trendMetric === "e1rm" ? "1RM" : "kg max"}
                />
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
