import { useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { StatsDayAgg } from "../../lib/statsOverview";

const CELL = 12;
const GAP = 3;
const LEVEL_COLORS = ["#1a2332", "#1e3a5f", "#2563eb", "#3b82f6", "#60a5fa"];

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function levelFor(agg: StatsDayAgg | undefined, thresholds: number[]): number {
  if (!agg) return 0;
  const v = agg.minutes > 0 ? agg.minutes : agg.sessions * 45;
  if (v <= 0) return agg.sessions > 0 ? 1 : 0;
  if (v >= thresholds[2]) return 4;
  if (v >= thresholds[1]) return 3;
  if (v >= thresholds[0]) return 2;
  return 1;
}

const MONTHS_PL = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

export function ActivityHeatmap({
  dayAgg,
  onDayPress,
}: {
  dayAgg: Map<string, StatsDayAgg>;
  onDayPress?: (day: string, agg: StatsDayAgg) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);

  const { cols, months, thresholds, todayKey } = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayKey = isoOf(today);

    // End = Monday of current week
    const end = new Date(today);
    const dow = end.getDay();
    end.setDate(end.getDate() - ((dow + 6) % 7));

    const start = new Date(end);
    start.setDate(end.getDate() - 52 * 7);

    const mins = [...dayAgg.values()]
      .map((a) => (a.minutes > 0 ? a.minutes : a.sessions * 45))
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    const q = (p: number) =>
      mins.length ? mins[Math.min(mins.length - 1, Math.floor(p * mins.length))] : 0;
    const thresholds = [q(0.25), q(0.5), q(0.75)];

    const cols: { key: string; days: { key: string; level: number; agg?: StatsDayAgg }[] }[] = [];
    const months: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;

    for (let wk = 0; wk <= 52; wk++) {
      const colStart = new Date(start);
      colStart.setDate(start.getDate() + wk * 7);
      const mo = colStart.getMonth();
      if (mo !== lastMonth && colStart.getDate() <= 7 && wk < 51) {
        months.push({ weekIndex: wk, label: MONTHS_PL[mo] });
        lastMonth = mo;
      } else if (mo !== lastMonth && colStart.getDate() <= 7) {
        lastMonth = mo;
      }

      const days: { key: string; level: number; agg?: StatsDayAgg }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(colStart);
        day.setDate(colStart.getDate() + d);
        const key = isoOf(day);
        const agg = dayAgg.get(key);
        const future = day > today;
        days.push({
          key,
          level: future ? 0 : levelFor(agg, thresholds),
          agg,
        });
      }
      cols.push({ key: `w${wk}`, days });
    }

    return { cols, months, thresholds, todayKey };
  }, [dayAgg]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    return () => clearTimeout(t);
  }, [cols.length]);

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 4 }}
      >
        <View>
          <View className="flex-row mb-1" style={{ marginLeft: 28 }}>
            {cols.map((col, wi) => {
              const label = months.find((m) => m.weekIndex === wi)?.label ?? "";
              return (
                <View key={col.key} style={{ width: CELL + GAP }}>
                  <Text className="text-text-muted text-[9px]">{label}</Text>
                </View>
              );
            })}
          </View>
          <View className="flex-row">
            <View className="mr-1 justify-between" style={{ height: 7 * (CELL + GAP) - GAP, width: 22 }}>
              <Text className="text-text-muted text-[9px]">Pn</Text>
              <Text className="text-text-muted text-[9px]">Śr</Text>
              <Text className="text-text-muted text-[9px]">Pt</Text>
            </View>
            <View className="flex-row">
              {cols.map((col) => (
                <View key={col.key} style={{ marginRight: GAP }}>
                  {col.days.map((day) => {
                    const isToday = day.key === todayKey;
                    return (
                      <Pressable
                        key={day.key}
                        disabled={!day.agg}
                        onPress={() => day.agg && onDayPress?.(day.key, day.agg)}
                        style={{
                          width: CELL,
                          height: CELL,
                          marginBottom: GAP,
                          borderRadius: 2,
                          backgroundColor: LEVEL_COLORS[day.level],
                          borderWidth: isToday ? 1 : 0,
                          borderColor: "#93c5fd",
                          opacity: day.key > todayKey ? 0.25 : 1,
                        }}
                        accessibilityLabel={
                          day.agg
                            ? `${day.key}: ${day.agg.sessions} trening(i)`
                            : day.key
                        }
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
      <View className="mt-3 flex-row items-center justify-end">
        <Text className="text-text-muted text-[10px] mr-1.5">Mniej</Text>
        {LEVEL_COLORS.map((c, i) => (
          <View
            key={i}
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 2,
              backgroundColor: c,
              marginLeft: 2,
            }}
          />
        ))}
        <Text className="text-text-muted text-[10px] ml-1.5">Więcej</Text>
      </View>
      {thresholds[0] === 0 && dayAgg.size === 0 ? null : (
        <Text className="text-text-muted text-[10px] mt-1 text-right">
          Intensywność wg czasu treningu
        </Text>
      )}
    </View>
  );
}
