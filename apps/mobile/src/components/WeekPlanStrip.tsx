import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { CalendarDays } from "lucide-react-native";
import type { WorkoutSheet } from "@bhmt3wp/shared";
import { isFreestyleSheetName } from "../lib/ensureFreestyleSheet";
import {
  getWeekSlots,
  pruneWeekSlots,
  setWeekSlot,
  setWeekSlots,
  todayWeekIndex,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  type WeekdayIndex,
  type WeekSlots,
} from "../lib/weekPlan";
import { Badge, BottomSheet, ICON_STROKE } from "./ui";

type WeekPlanStripProps = {
  sheets: WorkoutSheet[] | undefined;
  disabled?: boolean;
  onSlotsChange?: (slots: WeekSlots) => void;
};

export function WeekPlanStrip({ sheets, disabled = false, onSlotsChange }: WeekPlanStripProps) {
  const [slots, setSlots] = useState<WeekSlots | null>(null);
  const [editDay, setEditDay] = useState<WeekdayIndex | null>(null);
  const today = todayWeekIndex();

  const plans = useMemo(
    () => (sheets ?? []).filter((sheet) => !isFreestyleSheetName(sheet.name)),
    [sheets],
  );
  const sheetsReady = sheets !== undefined;

  const planNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const plan of plans) map.set(plan.id, plan.name);
    return map;
  }, [plans]);

  const validIds = useMemo(() => new Set(plans.map((plan) => plan.id)), [plans]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await getWeekSlots();
      if (cancelled) return;
      if (!sheetsReady) {
        setSlots(loaded);
        onSlotsChange?.(loaded);
        return;
      }
      const pruned = pruneWeekSlots(loaded, validIds);
      if (pruned.some((id, i) => id !== loaded[i])) {
        await setWeekSlots(pruned);
      }
      if (cancelled) return;
      setSlots(pruned);
      onSlotsChange?.(pruned);
    })();
    return () => {
      cancelled = true;
    };
  }, [sheetsReady, validIds, onSlotsChange]);

  const applySlot = useCallback(
    async (day: WeekdayIndex, sheetId: string | null) => {
      const next = await setWeekSlot(day, sheetId);
      setSlots(next);
      onSlotsChange?.(next);
      setEditDay(null);
    },
    [onSlotsChange],
  );

  if (!slots) {
    return (
      <View className="rounded-2xl border border-border bg-surface px-4 py-3">
        <Text className="text-text-muted text-sm">Wczytywanie układu tygodnia…</Text>
      </View>
    );
  }

  const editingLabel = editDay != null ? WEEKDAY_LONG[editDay] : "";

  return (
    <>
      <View className="rounded-2xl border border-border bg-surface px-3 py-3">
        <View className="mb-2.5 flex-row items-center px-1">
          <CalendarDays size={16} strokeWidth={ICON_STROKE} color="#60a5fa" />
          <Text className="ml-2 flex-1 text-text-primary text-sm font-bold">Tydzień</Text>
          <Text className="text-text-muted text-[11px]">Dotknij dzień, by przypisać plan</Text>
        </View>

        <View className="flex-row gap-1.5">
          {( [0, 1, 2, 3, 4, 5, 6] as WeekdayIndex[]).map((day) => {
            const sheetId = slots[day];
            const name = sheetId ? planNameById.get(sheetId) : null;
            const isToday = day === today;
            const isRest = !sheetId;

            return (
              <TouchableOpacity
                key={day}
                disabled={disabled}
                onPress={() => setEditDay(day)}
                accessibilityLabel={`${WEEKDAY_LONG[day]}: ${name ?? "odpoczynek"}`}
                className={`flex-1 min-h-[64px] rounded-xl border px-1 py-1.5 items-center justify-start ${
                  isToday
                    ? "border-action-primary bg-action-primary/15"
                    : "border-border bg-action-secondary"
                }`}
                style={{ opacity: disabled ? 0.5 : 1 }}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    isToday ? "text-action-primary" : "text-text-muted"
                  }`}
                >
                  {WEEKDAY_SHORT[day]}
                </Text>
                {isToday ? (
                  <Badge label="dziś" tone="accent" size="sm" className="mt-1" />
                ) : (
                  <View className="mt-1 h-[18px]" />
                )}
                <Text
                  className={`mt-1 text-[10px] leading-3 text-center font-semibold ${
                    isRest ? "text-text-muted" : "text-text-primary"
                  }`}
                  numberOfLines={2}
                >
                  {isRest ? "—" : name && name.length > 10 ? `${name.slice(0, 9)}…` : name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <BottomSheet
        visible={editDay != null}
        onClose={() => setEditDay(null)}
        title={editingLabel}
        subtitle="Przypisz plan na ten dzień albo zostaw odpoczynek. To tylko podpowiedź na Home — Freestyle zawsze dostępny."
      >
        <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            onPress={() => editDay != null && applySlot(editDay, null)}
            className="mb-2 rounded-xl border border-border bg-action-secondary px-4 py-3"
          >
            <Text className="text-text-primary text-base font-semibold">Odpoczynek</Text>
            <Text className="text-text-muted text-xs mt-0.5">Bez planu na ten dzień</Text>
          </TouchableOpacity>

          {plans.length === 0 ? (
            <Text className="text-text-secondary text-sm leading-5 mt-2">
              Nie masz jeszcze planów — utwórz je w „Wybierz plan”, potem wróć tu przypisać dni.
            </Text>
          ) : (
            plans.map((plan) => {
              const selected = editDay != null && slots[editDay] === plan.id;
              return (
                <TouchableOpacity
                  key={plan.id}
                  onPress={() => editDay != null && applySlot(editDay, plan.id)}
                  className={`mb-2 rounded-xl border px-4 py-3 ${
                    selected
                      ? "border-action-primary bg-action-primary/15"
                      : "border-border bg-action-secondary"
                  }`}
                >
                  <Text className="text-text-primary text-base font-semibold">{plan.name}</Text>
                  {selected ? (
                    <Text className="text-action-primary text-xs mt-0.5 font-semibold">
                      Wybrane na {editingLabel.toLowerCase()}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </BottomSheet>
    </>
  );
}
