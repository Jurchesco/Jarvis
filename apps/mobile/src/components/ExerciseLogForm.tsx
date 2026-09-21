import { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { SessionSetLog } from "@bhmt3wp/shared";
import {
  bestEpley1rmFromSets,
  exerciseVolumeFromSets,
  formatVolumeKg,
  formatWeightKg,
  isTimeBasedExercise,
} from "@bhmt3wp/shared";
import { ChevronRight, Minus, NotebookPen, Plus, Trash2 } from "lucide-react-native";
import { BottomSheet, Button, ICON_STROKE, Input, cx } from "./ui";

export type ExerciseLogSetDraft = {
  weightKg: string;
  reps: string;
};

export type ExerciseLogDraft = {
  sets: ExerciseLogSetDraft[];
  notes: string;
};

type ExerciseLogFormProps = {
  exerciseName: string;
  timeBased?: boolean;
  previousLog?: SessionSetLog | null;
  initialDraft?: ExerciseLogDraft;
  onSave: (draft: ExerciseLogDraft) => void;
  onCancel?: () => void;
  onDiscard?: () => void;
  discardLabel?: string;
  loading?: boolean;
  saveLabel?: string;
};

const DEFAULT_SET: ExerciseLogSetDraft = { weightKg: "0", reps: "10" };

const DEFAULT_DRAFT: ExerciseLogDraft = {
  sets: [{ ...DEFAULT_SET }],
  notes: "",
};

function sanitizeWeight(value: string): string {
  return value.replace(/[^\d.,]/g, "").replace(",", ".");
}

function sanitizeInt(value: string): string {
  return value.replace(/[^\d]/g, "");
}

export function createDraftFromLogs(
  logs: SessionSetLog[],
  notes = "",
): ExerciseLogDraft {
  if (logs.length === 0) return { ...DEFAULT_DRAFT, notes, sets: [{ ...DEFAULT_SET }] };

  return {
    sets: logs.map((log) => ({
      weightKg: String(log.weightKg),
      reps: String(log.reps),
    })),
    notes,
  };
}

export function createDraftFromPrevious(
  previousLog: SessionSetLog | null | undefined,
  notes = "",
): ExerciseLogDraft {
  if (!previousLog) return { ...DEFAULT_DRAFT, notes, sets: [{ ...DEFAULT_SET }] };
  return {
    sets: [
      {
        weightKg: String(previousLog.weightKg),
        reps: String(previousLog.reps),
      },
    ],
    notes,
  };
}

export function ExerciseLogForm({
  exerciseName,
  timeBased: timeBasedProp,
  previousLog,
  initialDraft,
  onSave,
  onCancel,
  onDiscard,
  discardLabel = "Usuń ćwiczenie z treningu",
  loading = false,
  saveLabel = "Zapisz ćwiczenie",
}: ExerciseLogFormProps) {
  const timeBased = timeBasedProp ?? isTimeBasedExercise(exerciseName);
  const [draft, setDraft] = useState<ExerciseLogDraft>(() => initialDraft ?? DEFAULT_DRAFT);
  const [notesSheetOpen, setNotesSheetOpen] = useState(false);

  const parsedSets = useMemo(
    () =>
      draft.sets.map((set) => ({
        weightKg: parseFloat(set.weightKg) || 0,
        reps: parseInt(set.reps, 10) || 0,
      })),
    [draft.sets],
  );

  const setCount = draft.sets.length;
  const est1rm = useMemo(
    () => (!timeBased ? bestEpley1rmFromSets(parsedSets) : 0),
    [timeBased, parsedSets],
  );
  const volume = useMemo(
    () => (!timeBased ? exerciseVolumeFromSets(parsedSets) : 0),
    [timeBased, parsedSets],
  );
  const totalTimeSec = useMemo(
    () => (timeBased ? parsedSets.reduce((sum, set) => sum + set.reps, 0) : 0),
    [timeBased, parsedSets],
  );

  const canSave =
    setCount > 0 &&
    parsedSets.every((set) => (timeBased ? set.reps > 0 : set.weightKg > 0 && set.reps > 0));

  const updateSetField = (index: number, field: keyof ExerciseLogSetDraft, value: string) => {
    setDraft((prev) => ({
      ...prev,
      sets: prev.sets.map((set, i) => (i === index ? { ...set, [field]: value } : set)),
    }));
  };

  const addSet = () => {
    setDraft((prev) => {
      const last = prev.sets[prev.sets.length - 1] ?? DEFAULT_SET;
      return {
        ...prev,
        sets: [...prev.sets, { weightKg: last.weightKg, reps: last.reps }],
      };
    });
  };

  const removeSet = (index: number) => {
    setDraft((prev) => {
      if (prev.sets.length <= 1) return prev;
      return { ...prev, sets: prev.sets.filter((_, i) => i !== index) };
    });
  };

  return (
    <View className="min-w-0">
      {previousLog ? (
        <Text className="text-text-muted text-xs mb-3">
          Poprzednio:{" "}
          {timeBased
            ? `${previousLog.reps}s`
            : `${previousLog.weightKg} kg × ${previousLog.reps} pow.`}
        </Text>
      ) : null}

      <View className="mb-2 flex-row items-center px-1">
        <Text className="w-10 text-center text-text-muted text-[10px] font-semibold uppercase">
          #
        </Text>
        {timeBased ? (
          <Text className="flex-1 text-center text-text-muted text-[10px] font-semibold uppercase">
            Czas (s)
          </Text>
        ) : (
          <>
            <Text className="flex-1 text-center text-text-muted text-[10px] font-semibold uppercase">
              Ciężar (kg)
            </Text>
            <Text className="flex-1 text-center text-text-muted text-[10px] font-semibold uppercase">
              Powt.
            </Text>
          </>
        )}
        <View className="w-10" />
      </View>

      {draft.sets.map((set, index) => (
        <View key={`set-row-${index}`} className="mb-2 flex-row items-center gap-2 min-w-0">
          <Text className="w-10 text-center text-text-secondary text-base font-bold">{index + 1}</Text>
          {timeBased ? (
            <View className="flex-1 min-w-0">
              <Input
                value={set.reps}
                onChangeText={(value) => updateSetField(index, "reps", sanitizeInt(value))}
                keyboardType="number-pad"
                placeholder="60"
                inputClassName="text-center font-bold"
                fontSize={18}
              />
            </View>
          ) : (
            <>
              <View className="flex-1 min-w-0">
                <Input
                  value={set.weightKg}
                  onChangeText={(value) => updateSetField(index, "weightKg", sanitizeWeight(value))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  inputClassName="text-center font-bold"
                  fontSize={18}
                />
              </View>
              <View className="flex-1 min-w-0">
                <Input
                  value={set.reps}
                  onChangeText={(value) => updateSetField(index, "reps", sanitizeInt(value))}
                  keyboardType="number-pad"
                  placeholder="10"
                  inputClassName="text-center font-bold"
                  fontSize={18}
                />
              </View>
            </>
          )}
          <TouchableOpacity
            onPress={() => removeSet(index)}
            disabled={draft.sets.length <= 1}
            className={cx(
              "h-10 w-10 items-center justify-center rounded-xl border",
              draft.sets.length <= 1
                ? "border-border bg-surface-muted opacity-40"
                : "border-border bg-action-secondary",
            )}
            accessibilityLabel={`Usuń serię ${index + 1}`}
          >
            <Minus size={16} strokeWidth={ICON_STROKE} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        onPress={addSet}
        activeOpacity={0.7}
        className="mb-1 flex-row items-center justify-center rounded-xl border border-dashed border-border bg-surface-muted px-3 py-2.5"
        accessibilityLabel="Dodaj serię"
      >
        <Plus size={16} strokeWidth={ICON_STROKE} color="#7c8aa5" />
        <Text className="ml-1.5 text-text-secondary text-sm font-semibold">Dodaj serię</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setNotesSheetOpen(true)}
        activeOpacity={0.7}
        className="mt-3 flex-row items-center rounded-xl border border-border bg-surface-muted px-3 py-3 min-h-[48px]"
      >
        <NotebookPen size={18} strokeWidth={ICON_STROKE} color="#7c8aa5" />
        <Text
          className={cx(
            "flex-1 ml-2 text-base leading-5",
            draft.notes.trim() ? "text-text-primary" : "text-text-muted",
          )}
          numberOfLines={2}
        >
          {draft.notes.trim() || "Uwagi (RPE, technika, ustawienie…)"}
        </Text>
        <ChevronRight size={18} strokeWidth={ICON_STROKE} color="#7c8aa5" />
      </TouchableOpacity>

      <BottomSheet
        visible={notesSheetOpen}
        onClose={() => setNotesSheetOpen(false)}
        title="Uwagi do ćwiczenia"
        subtitle={exerciseName}
      >
        <Input
          value={draft.notes}
          onChangeText={(value) => setDraft((prev) => ({ ...prev, notes: value }))}
          leftIcon={NotebookPen}
          placeholder="RPE, technika, ustawienie maszyny…"
          multiline
          autoFocus
          inputClassName="min-h-[120px]"
        />
        <Button label="Gotowe" onPress={() => setNotesSheetOpen(false)} className="mt-4" />
      </BottomSheet>

      {timeBased ? (
        <View className="mt-3 rounded-xl bg-surface-muted border border-border px-3 py-3">
          <Text className="text-text-muted text-xs font-semibold uppercase">Czas łącznie</Text>
          <Text className="text-text-primary text-2xl font-bold mt-1">
            {totalTimeSec > 0 ? `${totalTimeSec}s` : "—"}
          </Text>
          <Text className="text-text-muted text-xs mt-1">
            {setCount} {setCount === 1 ? "seria" : setCount < 5 ? "serie" : "serii"}
          </Text>
        </View>
      ) : (
        <View className="mt-3 flex-row gap-3">
          <View className="flex-1 rounded-xl bg-surface-muted border border-border px-3 py-3">
            <Text className="text-text-muted text-xs font-semibold uppercase">Est. 1RM (best)</Text>
            <Text className="text-text-primary text-2xl font-bold mt-1">
              {est1rm > 0 ? formatWeightKg(est1rm) : "—"}
            </Text>
          </View>
          <View className="flex-1 rounded-xl bg-surface-muted border border-border px-3 py-3">
            <Text className="text-text-muted text-xs font-semibold uppercase">Objętość</Text>
            <Text className="text-text-primary text-2xl font-bold mt-1">
              {volume > 0 ? formatVolumeKg(volume) : "—"}
            </Text>
            {setCount > 1 && volume > 0 ? (
              <Text className="text-text-muted text-xs mt-1">{setCount} serie</Text>
            ) : null}
          </View>
        </View>
      )}

      <View className="mt-4 flex-row gap-3">
        {onCancel ? (
          <Button label="Anuluj" variant="secondary" onPress={onCancel} className="flex-1" />
        ) : null}
        <Button
          label={saveLabel}
          onPress={() => onSave(draft)}
          loading={loading}
          disabled={!canSave || loading}
          className={onCancel ? "flex-1" : "w-full"}
        />
      </View>

      {onDiscard ? (
        <TouchableOpacity
          onPress={onDiscard}
          activeOpacity={0.7}
          className="mt-3 flex-row items-center justify-center py-2"
          accessibilityLabel={discardLabel}
        >
          <Trash2 size={14} strokeWidth={ICON_STROKE} color="#ef4444" />
          <Text className="ml-1.5 text-danger text-sm font-semibold">{discardLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function SummaryMetric({
  label,
  value,
  accent = false,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <View
      className={cx(
        "rounded-xl border px-3 py-2.5",
        accent ? "border-emphasis/30 bg-emphasis/10" : "border-border bg-surface-muted",
        className,
      )}
    >
      <Text className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">{label}</Text>
      <Text
        className={cx(
          "mt-0.5 text-base font-bold leading-tight",
          accent ? "text-emphasis" : "text-text-primary",
        )}
      >
        {value}
      </Text>
    </View>
  );
}

export function ExerciseLogSummary({
  exerciseName,
  logs,
  setCount,
  weightKg,
  reps,
  notes,
  timeBased,
  layout = "standalone",
}: {
  exerciseName: string;
  /** Preferowane: pełne logi serii (rampa / D016). */
  logs?: SessionSetLog[];
  /** @deprecated Użyj `logs` — zostawione dla kompatybilności. */
  setCount?: number;
  weightKg?: number;
  reps?: number;
  notes?: string;
  timeBased?: boolean;
  /** standalone = karta w aktywnym treningu; afterSets = stopka pod tabelą serii w historii */
  layout?: "standalone" | "afterSets";
}) {
  const isTime = timeBased ?? isTimeBasedExercise(exerciseName);
  const sortedLogs = [...(logs ?? [])].sort((a, b) => a.setNumber - b.setNumber);
  const hasLogs = sortedLogs.length > 0;

  const resolvedSetCount = hasLogs ? sortedLogs.length : (setCount ?? 0);
  const setRows = hasLogs
    ? sortedLogs.map((log) => ({ weightKg: log.weightKg, reps: log.reps }))
    : Array.from({ length: resolvedSetCount }, () => ({
        weightKg: weightKg ?? 0,
        reps: reps ?? 0,
      }));

  const est1rm = !isTime ? bestEpley1rmFromSets(setRows) : 0;
  const volume = !isTime ? exerciseVolumeFromSets(setRows) : 0;
  const totalReps = setRows.reduce((sum, set) => sum + set.reps, 0);
  const uniform =
    setRows.length > 0 &&
    setRows.every(
      (set) => set.weightKg === setRows[0].weightKg && set.reps === setRows[0].reps,
    );

  return (
    <View className={layout === "afterSets" ? "mt-3 pt-3 border-t border-border" : undefined}>
      {layout === "standalone" && hasLogs ? (
        <View className="mb-3">
          <View className="mb-1 flex-row px-1">
            <Text className="w-12 text-center text-text-muted text-[10px] font-semibold uppercase">
              #
            </Text>
            <Text className="flex-1 text-center text-text-muted text-[10px] font-semibold uppercase">
              {isTime ? "Czas" : "Kg"}
            </Text>
            {!isTime ? (
              <Text className="flex-1 text-center text-text-muted text-[10px] font-semibold uppercase">
                Powt.
              </Text>
            ) : null}
          </View>
          {sortedLogs.map((log, index) => (
            <View
              key={`${log.exerciseId}-${log.setNumber}`}
              className={cx(
                "mb-1 flex-row items-center rounded-lg px-1 py-2",
                index % 2 === 0 ? "bg-surface-muted" : "bg-surface",
              )}
            >
              <Text className="w-12 text-center text-text-secondary text-sm font-semibold">
                {log.setNumber}
              </Text>
              <Text className="flex-1 text-center text-text-primary text-sm font-semibold">
                {isTime ? `${log.reps}s` : log.weightKg}
              </Text>
              {!isTime ? (
                <Text className="flex-1 text-center text-text-primary text-sm font-semibold">
                  {log.reps}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : layout === "standalone" ? (
        <View className="flex-row gap-2 mb-2">
          <SummaryMetric label="Serie" value={String(resolvedSetCount)} className="flex-1" />
          {isTime ? (
            <>
              <SummaryMetric label="Czas" value={`${reps ?? 0}s`} className="flex-1" />
              <SummaryMetric label="Łącznie" value={`${totalReps}s`} className="flex-1" />
            </>
          ) : (
            <>
              <SummaryMetric
                label="Ciężar"
                value={`${formatWeightKg(weightKg ?? 0)}`}
                className="flex-1"
              />
              <SummaryMetric label="Powt." value={String(reps ?? 0)} className="flex-1" />
            </>
          )}
        </View>
      ) : null}

      {!isTime && (est1rm > 0 || volume > 0) ? (
        <View className="flex-row gap-2">
          {est1rm > 0 ? (
            <SummaryMetric
              label="Est. 1RM"
              value={formatWeightKg(est1rm)}
              accent
              className="flex-1"
            />
          ) : null}
          {volume > 0 ? (
            <SummaryMetric
              label="Objętość"
              value={formatVolumeKg(volume)}
              className="flex-1"
            />
          ) : null}
        </View>
      ) : null}

      {layout === "afterSets" && !isTime && totalReps > 0 ? (
        <Text className="text-text-muted text-xs mt-2">
          Łącznie {totalReps} powt. · {resolvedSetCount}{" "}
          {resolvedSetCount === 1 ? "seria" : resolvedSetCount < 5 ? "serie" : "serii"}
          {uniform && setRows[0]
            ? ` × ${formatWeightKg(setRows[0].weightKg)} × ${setRows[0].reps}`
            : " (rampa)"}
        </Text>
      ) : null}

      {notes?.trim() ? (
        <View className="mt-2 rounded-xl border border-border bg-surface-muted px-3 py-2">
          <Text className="text-text-muted text-[10px] font-semibold uppercase tracking-wide mb-1">
            Uwagi
          </Text>
          <Text className="text-text-secondary text-sm leading-5">{notes.trim()}</Text>
        </View>
      ) : null}
    </View>
  );
}
