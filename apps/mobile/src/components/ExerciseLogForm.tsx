import { useEffect, useMemo, useState } from "react";
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
import {
  getExerciseLogFillMode,
  setExerciseLogFillMode,
  type ExerciseLogFillMode,
} from "../lib/appPreferences";
import { BottomSheet, Badge, Button, ICON_STROKE, Input, Pills, cx } from "./ui";

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
  /** Last session sets for this exercise (sorted by setNumber). */
  previousLogs?: SessionSetLog[] | null;
  /** @deprecated prefer previousLogs — kept for single-set callers */
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

const FILL_MODE_OPTIONS: { value: ExerciseLogFillMode; label: string }[] = [
  { value: "batch", label: "Zbiorczo" },
  { value: "per-set", label: "Per seria" },
];

function sanitizeWeight(value: string): string {
  return value.replace(/[^\d.,]/g, "").replace(",", ".");
}

function sanitizeInt(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function draftSetsAreUniform(sets: ExerciseLogSetDraft[]): boolean {
  if (sets.length <= 1) return true;
  const first = sets[0];
  return sets.every((set) => set.weightKg === first.weightKg && set.reps === first.reps);
}

function expandUniformSets(count: number, template: ExerciseLogSetDraft): ExerciseLogSetDraft[] {
  const n = Math.max(1, count);
  return Array.from({ length: n }, () => ({ ...template }));
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
  previousLogs?: SessionSetLog[] | null,
): ExerciseLogDraft {
  const logs =
    previousLogs && previousLogs.length > 0
      ? previousLogs
      : previousLog
        ? [previousLog]
        : [];
  if (logs.length === 0) return { ...DEFAULT_DRAFT, notes, sets: [{ ...DEFAULT_SET }] };
  return {
    sets: logs.map((log) => ({
      weightKg: String(log.weightKg),
      reps: String(log.reps),
    })),
    notes,
  };
}

function formatPreviousChip(
  logs: SessionSetLog[],
  timeBased: boolean,
): string {
  if (logs.length === 0) return "";
  const parts = logs.map((log) =>
    timeBased ? `${log.reps}s` : `${log.weightKg}×${log.reps}`,
  );
  const shown = parts.slice(0, 4);
  const extra = parts.length > 4 ? ` +${parts.length - 4}` : "";
  return `Ostatnio · ${shown.join(" · ")}${extra}`;
}

export function ExerciseLogForm({
  exerciseName,
  timeBased: timeBasedProp,
  previousLogs,
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
  const resolvedPrevious = useMemo(() => {
    if (previousLogs && previousLogs.length > 0) return previousLogs;
    if (previousLog) return [previousLog];
    return [] as SessionSetLog[];
  }, [previousLogs, previousLog]);
  const previousChip = useMemo(
    () => formatPreviousChip(resolvedPrevious, timeBased),
    [resolvedPrevious, timeBased],
  );
  const seed = initialDraft ?? DEFAULT_DRAFT;
  const [draft, setDraft] = useState<ExerciseLogDraft>(() => seed);
  const [fillMode, setFillMode] = useState<ExerciseLogFillMode>("per-set");
  const [modeReady, setModeReady] = useState(false);
  const [notesSheetOpen, setNotesSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getExerciseLogFillMode().then((pref) => {
      if (cancelled) return;
      // Ramp already in draft → force per-set so values aren't collapsed.
      setFillMode(draftSetsAreUniform(seed.sets) ? pref : "per-set");
      setModeReady(true);
    });
    return () => {
      cancelled = true;
    };
    // Only on mount for this form instance (keyed by parent).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsedSets = useMemo(
    () =>
      draft.sets.map((set) => ({
        weightKg: parseFloat(set.weightKg) || 0,
        reps: parseInt(set.reps, 10) || 0,
      })),
    [draft.sets],
  );

  const setCount = draft.sets.length;
  const batchTemplate = draft.sets[0] ?? DEFAULT_SET;
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

  const handleFillModeChange = (mode: ExerciseLogFillMode) => {
    setFillMode(mode);
    void setExerciseLogFillMode(mode);
    if (mode === "batch") {
      const template = draft.sets[0] ?? DEFAULT_SET;
      setDraft((prev) => ({
        ...prev,
        sets: expandUniformSets(prev.sets.length, template),
      }));
    }
  };

  const updateBatchSetCount = (raw: string) => {
    const cleaned = sanitizeInt(raw);
    const count = Math.max(1, parseInt(cleaned, 10) || 1);
    setDraft((prev) => ({
      ...prev,
      sets: expandUniformSets(count, prev.sets[0] ?? DEFAULT_SET),
    }));
  };

  const updateBatchField = (field: keyof ExerciseLogSetDraft, value: string) => {
    setDraft((prev) => {
      const template = { ...(prev.sets[0] ?? DEFAULT_SET), [field]: value };
      return {
        ...prev,
        sets: expandUniformSets(prev.sets.length, template),
      };
    });
  };

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
      {previousChip ? (
        <Badge label={previousChip} tone="accent" size="sm" className="mb-3 max-w-full" />
      ) : null}

      <Text className="text-text-muted text-[10px] font-semibold uppercase mb-1.5">
        Wypełnianie
      </Text>
      <Pills
        options={FILL_MODE_OPTIONS}
        value={fillMode}
        onChange={handleFillModeChange}
        className="mb-3"
      />
      {!modeReady ? null : fillMode === "batch" ? (
        <Text className="text-text-muted text-xs mb-3 leading-5">
          Jedna wartość kg/powt. dla wszystkich serii — szybki wpis.
        </Text>
      ) : (
        <Text className="text-text-muted text-xs mb-3 leading-5">
          Osobny ciężar i powtórzenia na każdą serię — rampa.
        </Text>
      )}

      {fillMode === "batch" ? (
        <View className="flex-row gap-3 min-w-0">
          <View className="flex-1 min-w-0">
            <Text className="text-text-muted text-xs font-semibold uppercase mb-1.5" numberOfLines={1}>
              Serie
            </Text>
            <Input
              value={String(setCount)}
              onChangeText={updateBatchSetCount}
              keyboardType="number-pad"
              placeholder="3"
              inputClassName="text-center font-bold"
              fontSize={20}
            />
          </View>

          {timeBased ? (
            <View className="flex-[2] min-w-0">
              <Text className="text-text-muted text-xs font-semibold uppercase mb-1.5" numberOfLines={1}>
                Czas (sekundy)
              </Text>
              <Input
                value={batchTemplate.reps}
                onChangeText={(value) => updateBatchField("reps", sanitizeInt(value))}
                keyboardType="number-pad"
                placeholder="60"
                inputClassName="text-center font-bold"
                fontSize={20}
              />
            </View>
          ) : (
            <>
              <View className="flex-1 min-w-0">
                <Text className="text-text-muted text-xs font-semibold uppercase mb-1.5" numberOfLines={1}>
                  Ciężar (kg)
                </Text>
                <Input
                  value={batchTemplate.weightKg}
                  onChangeText={(value) => updateBatchField("weightKg", sanitizeWeight(value))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  inputClassName="text-center font-bold"
                  fontSize={20}
                />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-text-muted text-xs font-semibold uppercase mb-1.5" numberOfLines={1}>
                  Powtórzenia
                </Text>
                <Input
                  value={batchTemplate.reps}
                  onChangeText={(value) => updateBatchField("reps", sanitizeInt(value))}
                  keyboardType="number-pad"
                  placeholder="10"
                  inputClassName="text-center font-bold"
                  fontSize={20}
                />
              </View>
            </>
          )}
        </View>
      ) : (
        <>
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
                      onChangeText={(value) =>
                        updateSetField(index, "weightKg", sanitizeWeight(value))
                      }
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
        </>
      )}

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
            <Text className="text-text-muted text-xs font-semibold uppercase">
              {fillMode === "per-set" ? "Est. 1RM (best)" : "Est. 1RM"}
            </Text>
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
