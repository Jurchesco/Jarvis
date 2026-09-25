import { useEffect, useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { EffortScale, ExerciseSet, SessionSetLog } from "@bhmt3wp/shared";
import {
  bestEpley1rmFromSets,
  EFFORT_SCALE_OPTIONS,
  effortFromLogFields,
  exerciseVolumeFromSets,
  formatEffortLabel,
  formatVolumeKg,
  formatWeightKg,
  isBodyweightExercise,
  isTimeBasedExercise,
} from "@bhmt3wp/shared";
import { ChevronRight, Minus, NotebookPen, Play, Plus, Trash2 } from "lucide-react-native";
import {
  getEffortLoggingEnabled,
  getEffortScale,
  getExerciseLogFillMode,
  setEffortScale,
  setExerciseLogFillMode,
  type ExerciseLogFillMode,
} from "../lib/appPreferences";
import { BottomSheet, Badge, Button, ICON_STROKE, Input, Pills, cx } from "./ui";

export type ExerciseLogSetDraft = {
  weightKg: string;
  reps: string;
  effortScale?: EffortScale | null;
  effortValue?: string;
  /** Warm-up — excluded from Cel / 1RM / PR. */
  isWarmup?: boolean;
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
  /** Progression target chip (D021), e.g. "Cel · 70×8". */
  progressionChip?: string | null;
  /** One-line reason from the progression engine. */
  progressionReason?: string | null;
  initialDraft?: ExerciseLogDraft;
  onSave: (draft: ExerciseLogDraft) => void;
  onCancel?: () => void;
  onDiscard?: () => void;
  discardLabel?: string;
  loading?: boolean;
  saveLabel?: string;
  /**
   * Start a hold countdown for a timed set (OpenGym-style work timer).
   * Parent owns the overlay; calls onDone(heldSec) when finished/early.
   */
  onStartHold?: (opts: {
    targetSec: number;
    label: string;
    onDone: (heldSec: number) => void;
  }) => void;
  /** Disable Start hold while another timer is running. */
  holdDisabled?: boolean;
};

const DEFAULT_SET: ExerciseLogSetDraft = {
  weightKg: "0",
  reps: "10",
  effortScale: null,
  effortValue: "",
  isWarmup: false,
};

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

function sanitizeEffort(value: string): string {
  return value.replace(/[^\d.,]/g, "").replace(",", ".");
}

function formatEffortDraftValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function effortFieldsFromLog(log: SessionSetLog): Pick<ExerciseLogSetDraft, "effortScale" | "effortValue"> {
  const effort = effortFromLogFields(log.effortScale, log.effortValue);
  if (!effort) return { effortScale: null, effortValue: "" };
  return { effortScale: effort.scale, effortValue: formatEffortDraftValue(effort.value) };
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

function mapLogsToDraftSets(logs: SessionSetLog[]): ExerciseLogSetDraft[] {
  return logs.map((log) => ({
    weightKg: String(log.weightKg),
    reps: String(log.reps),
    isWarmup: !!log.isWarmup,
    ...effortFieldsFromLog(log),
  }));
}

export function createDraftFromLogs(
  logs: SessionSetLog[],
  notes = "",
): ExerciseLogDraft {
  if (logs.length === 0) return { ...DEFAULT_DRAFT, notes, sets: [{ ...DEFAULT_SET }] };

  return {
    sets: mapLogsToDraftSets(logs),
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
    sets: mapLogsToDraftSets(logs),
    notes,
  };
}

/** Prefills from plan template sets when there is no previous session for this exercise. */
export function createDraftFromTemplate(
  templateSets: ExerciseSet[] | null | undefined,
  notes = "",
): ExerciseLogDraft {
  if (!templateSets || templateSets.length === 0) {
    return { ...DEFAULT_DRAFT, notes, sets: [{ ...DEFAULT_SET }] };
  }
  const sorted = [...templateSets].sort((a, b) => a.setNumber - b.setNumber);
  return {
    sets: sorted.map((set) => ({
      weightKg: String(set.weightKg),
      reps: String(set.reps),
      effortScale: null,
      effortValue: "",
      isWarmup: false,
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
    timeBased
      ? log.weightKg > 0
        ? `${log.weightKg}kg · ${log.reps}s`
        : `${log.reps}s`
      : `${log.weightKg}×${log.reps}`,
  );
  const shown = parts.slice(0, 4);
  const extra = parts.length > 4 ? ` +${parts.length - 4}` : "";
  return `Ostatnio · ${shown.join(" · ")}${extra}`;
}

/** Ghost hint for one previous set (D019 §5 — kolumna „Poprzednio”). */
function formatGhostSet(
  log: SessionSetLog | null | undefined,
  timeBased: boolean,
): string {
  if (!log) return "—";
  if (timeBased) {
    return log.weightKg > 0 ? `${log.weightKg}kg · ${log.reps}s` : `${log.reps}s`;
  }
  return `${log.weightKg}×${log.reps}`;
}

export function ExerciseLogForm({
  exerciseName,
  timeBased: timeBasedProp,
  previousLogs,
  previousLog,
  progressionChip,
  progressionReason,
  initialDraft,
  onSave,
  onCancel,
  onDiscard,
  discardLabel = "Usuń ćwiczenie z treningu",
  loading = false,
  saveLabel = "Zapisz ćwiczenie",
  onStartHold,
  holdDisabled = false,
}: ExerciseLogFormProps) {
  const timeBased = timeBasedProp ?? isTimeBasedExercise(exerciseName);
  const bodyweight = !timeBased && isBodyweightExercise(exerciseName);
  const resolvedPrevious = useMemo(() => {
    if (previousLogs && previousLogs.length > 0) return previousLogs;
    if (previousLog) return [previousLog];
    return [] as SessionSetLog[];
  }, [previousLogs, previousLog]);
  const previousChip = useMemo(
    () => formatPreviousChip(resolvedPrevious, timeBased),
    [resolvedPrevious, timeBased],
  );
  const showGhostColumn = resolvedPrevious.length > 0;
  const seed = initialDraft ?? DEFAULT_DRAFT;
  const [draft, setDraft] = useState<ExerciseLogDraft>(() => seed);
  const [fillMode, setFillMode] = useState<ExerciseLogFillMode>("per-set");
  const [modeReady, setModeReady] = useState(false);
  const [effortEnabled, setEffortEnabled] = useState(false);
  const [effortScale, setEffortScaleState] = useState<EffortScale>("rir");
  const [notesSheetOpen, setNotesSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getExerciseLogFillMode(), getEffortLoggingEnabled(), getEffortScale()]).then(
      ([pref, effortOn, scale]) => {
        if (cancelled) return;
        // Ramp already in draft → force per-set so values aren't collapsed.
        setFillMode(draftSetsAreUniform(seed.sets) ? pref : "per-set");
        setEffortEnabled(effortOn);
        setEffortScaleState(scale);
        setModeReady(true);
      },
    );
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
        isWarmup: !!set.isWarmup,
      })),
    [draft.sets],
  );

  const workingParsedSets = useMemo(
    () => parsedSets.filter((set) => !set.isWarmup),
    [parsedSets],
  );

  const setCount = draft.sets.length;
  const batchTemplate = draft.sets[0] ?? DEFAULT_SET;
  const effortHint =
    EFFORT_SCALE_OPTIONS.find((option) => option.value === effortScale)?.hint ?? "";
  const est1rm = useMemo(
    () => (!timeBased ? bestEpley1rmFromSets(workingParsedSets) : 0),
    [timeBased, workingParsedSets],
  );
  const volume = useMemo(
    () => (!timeBased ? exerciseVolumeFromSets(workingParsedSets) : 0),
    [timeBased, workingParsedSets],
  );
  const totalTimeSec = useMemo(
    () => (timeBased ? parsedSets.reduce((sum, set) => sum + set.reps, 0) : 0),
    [timeBased, parsedSets],
  );

  const canSave =
    setCount > 0 &&
    parsedSets.every((set) => {
      if (timeBased) return set.reps > 0;
      if (bodyweight) return set.reps > 0;
      return set.weightKg > 0 && set.reps > 0;
    });

  const applyEffortScale = (scale: EffortScale) => {
    setEffortScaleState(scale);
    void setEffortScale(scale);
    setDraft((prev) => ({
      ...prev,
      sets: prev.sets.map((set) => ({
        ...set,
        effortScale: (set.effortValue ?? "").trim() ? scale : set.effortScale ?? scale,
      })),
    }));
  };

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
      if (field === "effortValue") {
        template.effortScale = value.trim() ? effortScale : null;
      }
      return {
        ...prev,
        sets: expandUniformSets(prev.sets.length, template),
      };
    });
  };

  const updateSetField = (index: number, field: keyof ExerciseLogSetDraft, value: string) => {
    setDraft((prev) => ({
      ...prev,
      sets: prev.sets.map((set, i) => {
        if (i !== index) return set;
        const next = { ...set, [field]: value };
        if (field === "effortValue") {
          next.effortScale = value.trim() ? effortScale : null;
        }
        return next;
      }),
    }));
  };

  const toggleSetWarmup = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      sets: prev.sets.map((set, i) =>
        i === index ? { ...set, isWarmup: !set.isWarmup } : set,
      ),
    }));
  };

  const addSet = () => {
    setDraft((prev) => {
      const last = prev.sets[prev.sets.length - 1] ?? DEFAULT_SET;
      return {
        ...prev,
        sets: [
          ...prev.sets,
          {
            weightKg: last.weightKg,
            reps: last.reps,
            effortScale: last.effortScale ?? null,
            effortValue: last.effortValue ?? "",
            isWarmup: false,
          },
        ],
      };
    });
  };

  const removeSet = (index: number) => {
    setDraft((prev) => {
      if (prev.sets.length <= 1) return prev;
      return { ...prev, sets: prev.sets.filter((_, i) => i !== index) };
    });
  };

  const startHoldForSet = (index: number) => {
    if (!onStartHold || holdDisabled) return;
    const target = Math.max(1, parseInt(draft.sets[index]?.reps ?? "0", 10) || 30);
    onStartHold({
      targetSec: target,
      label: exerciseName,
      onDone: (heldSec) => {
        updateSetField(index, "reps", String(heldSec));
      },
    });
  };

  const startHoldForBatch = () => {
    if (!onStartHold || holdDisabled) return;
    const target = Math.max(1, parseInt(batchTemplate.reps || "0", 10) || 30);
    onStartHold({
      targetSec: target,
      label: exerciseName,
      onDone: (heldSec) => {
        updateBatchField("reps", String(heldSec));
      },
    });
  };

  return (
    <View className="min-w-0">
      {progressionChip ? (
        <Badge label={progressionChip} tone="accent" size="sm" className="mb-1.5" />
      ) : null}
      {progressionReason ? (
        <Text className="text-text-muted text-xs mb-2 leading-5">{progressionReason}</Text>
      ) : null}
      {/* When Cel is shown, skip Ostatnio chip — Poprzednio column still covers history. */}
      {!progressionChip && previousChip && !(showGhostColumn && fillMode === "per-set") ? (
        <Badge label={previousChip} tone="accent" size="sm" className="mb-3" />
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
          Jedna wartość kg/powt. dla wszystkich serii — warm-up oznaczysz w trybie Per seria (WU).
        </Text>
      ) : (
        <Text className="text-text-muted text-xs mb-3 leading-5">
          Osobny ciężar i powtórzenia na każdą serię — WU = warm-up (poza Cel / 1RM).
        </Text>
      )}

      {effortEnabled ? (
        <View className="mb-3">
          <Text className="text-text-muted text-[10px] font-semibold uppercase mb-1.5">
            Wysiłek (opcjonalnie)
          </Text>
          <Pills
            options={EFFORT_SCALE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            value={effortScale}
            onChange={(value) => applyEffortScale(value as EffortScale)}
            className="mb-1.5"
          />
          <Text className="text-text-muted text-xs leading-5">{effortHint}</Text>
        </View>
      ) : null}

      {fillMode === "batch" ? (
        <View className="gap-3 min-w-0">
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
                    Czas (s)
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
                {onStartHold ? (
                  <View className="justify-end pb-0.5">
                    <TouchableOpacity
                      onPress={startHoldForBatch}
                      disabled={holdDisabled || loading}
                      className={cx(
                        "h-12 w-12 items-center justify-center rounded-xl border",
                        holdDisabled
                          ? "border-border bg-surface-muted opacity-40"
                          : "border-emphasis/40 bg-emphasis/15",
                      )}
                      accessibilityLabel="Start utrzymania"
                    >
                      <Play size={18} strokeWidth={ICON_STROKE} color="#22c55e" />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
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

          {effortEnabled ? (
            <View className="min-w-0">
              <Text className="text-text-muted text-xs font-semibold uppercase mb-1.5" numberOfLines={1}>
                {effortScale === "rir" ? "RIR" : "RPE"}
              </Text>
              <Input
                value={batchTemplate.effortValue ?? ""}
                onChangeText={(value) => updateBatchField("effortValue", sanitizeEffort(value))}
                keyboardType="decimal-pad"
                placeholder={effortScale === "rir" ? "0–10" : "1–10"}
                inputClassName="text-center font-bold"
                fontSize={20}
              />
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <View className="mb-2 flex-row items-center px-1">
            <Text className="w-8 text-center text-text-muted text-[10px] font-semibold uppercase">
              #
            </Text>
            {showGhostColumn ? (
              <Text
                className={`${timeBased ? "w-[5.75rem]" : "w-[4.75rem]"} text-center text-text-muted text-[10px] font-semibold uppercase`}
                numberOfLines={1}
              >
                Poprzednio
              </Text>
            ) : null}
            {timeBased ? (
              <>
                <Text className="flex-1 text-center text-text-muted text-[10px] font-semibold uppercase">
                  Kg
                </Text>
                <Text className="flex-1 text-center text-text-muted text-[10px] font-semibold uppercase">
                  Czas (s)
                </Text>
              </>
            ) : (
              <>
                <Text className="flex-1 text-center text-text-muted text-[10px] font-semibold uppercase">
                  {bodyweight ? "Kg (0=BW)" : "Ciężar (kg)"}
                </Text>
                <Text className="flex-1 text-center text-text-muted text-[10px] font-semibold uppercase">
                  Powt.
                </Text>
              </>
            )}
            {effortEnabled ? (
              <Text className="w-14 text-center text-text-muted text-[10px] font-semibold uppercase">
                {effortScale === "rir" ? "RIR" : "RPE"}
              </Text>
            ) : null}
            <Text className="w-10 text-center text-text-muted text-[10px] font-semibold uppercase">
              WU
            </Text>
            {timeBased && onStartHold ? <View className="w-10" /> : null}
            <View className="w-10" />
          </View>

          {draft.sets.map((set, index) => {
            const ghost = formatGhostSet(resolvedPrevious[index], timeBased);
            return (
            <View key={`set-row-${index}`} className="mb-2 flex-row items-center gap-2 min-w-0">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-surface-muted border border-border">
                <Text className="text-text-secondary text-sm font-bold">{index + 1}</Text>
              </View>
              {showGhostColumn ? (
                <Text
                  className={`${timeBased ? "w-[5.75rem]" : "w-[4.75rem]"} text-center text-text-muted text-xs font-medium`}
                  numberOfLines={2}
                  accessibilityLabel={`Poprzednio seria ${index + 1}: ${ghost}`}
                >
                  {ghost}
                </Text>
              ) : null}
              {timeBased ? (
                <>
                  <View className="flex-1 min-w-0">
                    <Input
                      value={set.weightKg}
                      onChangeText={(value) =>
                        updateSetField(index, "weightKg", sanitizeWeight(value))
                      }
                      keyboardType="decimal-pad"
                      placeholder={
                        resolvedPrevious[index]
                          ? String(resolvedPrevious[index].weightKg)
                          : "0"
                      }
                      inputClassName="text-center font-bold"
                      fontSize={18}
                    />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Input
                      value={set.reps}
                      onChangeText={(value) => updateSetField(index, "reps", sanitizeInt(value))}
                      keyboardType="number-pad"
                      placeholder={
                        resolvedPrevious[index]
                          ? String(resolvedPrevious[index].reps)
                          : "60"
                      }
                      inputClassName="text-center font-bold"
                      fontSize={18}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View className="flex-1 min-w-0">
                    <Input
                      value={set.weightKg}
                      onChangeText={(value) =>
                        updateSetField(index, "weightKg", sanitizeWeight(value))
                      }
                      keyboardType="decimal-pad"
                      placeholder={
                        resolvedPrevious[index]
                          ? String(resolvedPrevious[index].weightKg)
                          : "0"
                      }
                      inputClassName="text-center font-bold"
                      fontSize={18}
                    />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Input
                      value={set.reps}
                      onChangeText={(value) => updateSetField(index, "reps", sanitizeInt(value))}
                      keyboardType="number-pad"
                      placeholder={
                        resolvedPrevious[index]
                          ? String(resolvedPrevious[index].reps)
                          : "10"
                      }
                      inputClassName="text-center font-bold"
                      fontSize={18}
                    />
                  </View>
                </>
              )}
              {effortEnabled ? (
                <View className="w-14 min-w-0">
                  <Input
                    value={set.effortValue ?? ""}
                    onChangeText={(value) =>
                      updateSetField(index, "effortValue", sanitizeEffort(value))
                    }
                    keyboardType="decimal-pad"
                    placeholder="—"
                    inputClassName="text-center font-bold"
                    fontSize={16}
                  />
                </View>
              ) : null}
              <TouchableOpacity
                onPress={() => toggleSetWarmup(index)}
                className={cx(
                  "h-10 w-10 items-center justify-center rounded-xl border",
                  set.isWarmup
                    ? "border-amber-500/50 bg-amber-500/20"
                    : "border-border bg-action-secondary",
                )}
                accessibilityLabel={
                  set.isWarmup
                    ? `Seria ${index + 1}: warm-up włączony`
                    : `Seria ${index + 1}: oznacz jako warm-up`
                }
                accessibilityState={{ selected: !!set.isWarmup }}
              >
                <Text
                  className={cx(
                    "text-[10px] font-bold",
                    set.isWarmup ? "text-amber-400" : "text-text-muted",
                  )}
                >
                  WU
                </Text>
              </TouchableOpacity>
              {timeBased && onStartHold ? (
                <TouchableOpacity
                  onPress={() => startHoldForSet(index)}
                  disabled={holdDisabled || loading}
                  className={cx(
                    "h-10 w-10 items-center justify-center rounded-xl border",
                    holdDisabled
                      ? "border-border bg-surface-muted opacity-40"
                      : "border-emphasis/40 bg-emphasis/15",
                  )}
                  accessibilityLabel={`Start utrzymania seria ${index + 1}`}
                >
                  <Play size={16} strokeWidth={ICON_STROKE} color="#22c55e" />
                </TouchableOpacity>
              ) : null}
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
            );
          })}

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
          {draft.notes.trim() ||
            (effortEnabled
              ? "Uwagi (technika, ustawienie…)"
              : "Uwagi (RPE, technika, ustawienie…)")}
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
          placeholder={
            effortEnabled
              ? "Technika, ustawienie maszyny…"
              : "RPE, technika, ustawienie maszyny…"
          }
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
            {parseFloat(batchTemplate.weightKg) > 0
              ? ` · ${batchTemplate.weightKg} kg`
              : fillMode === "per-set" &&
                  draft.sets.some((s) => (parseFloat(s.weightKg) || 0) > 0)
                ? " · z obciążeniem"
                : ""}
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
    ? sortedLogs.map((log) => ({
        weightKg: log.weightKg,
        reps: log.reps,
        isWarmup: !!log.isWarmup,
      }))
    : Array.from({ length: resolvedSetCount }, () => ({
        weightKg: weightKg ?? 0,
        reps: reps ?? 0,
        isWarmup: false,
      }));

  const workingRows = setRows.filter((set) => !set.isWarmup);
  const est1rm = !isTime ? bestEpley1rmFromSets(workingRows) : 0;
  const volume = !isTime ? exerciseVolumeFromSets(workingRows) : 0;
  const totalReps = workingRows.reduce((sum, set) => sum + set.reps, 0);
  const uniform =
    workingRows.length > 0 &&
    workingRows.every(
      (set) => set.weightKg === workingRows[0].weightKg && set.reps === workingRows[0].reps,
    );
  const showEffort =
    hasLogs &&
    sortedLogs.some((log) => effortFromLogFields(log.effortScale, log.effortValue) != null);

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
            {showEffort ? (
              <Text className="w-16 text-center text-text-muted text-[10px] font-semibold uppercase">
                Wysiłek
              </Text>
            ) : null}
            <Text className="w-10 text-center text-text-muted text-[10px] font-semibold uppercase">
              WU
            </Text>
          </View>
          {sortedLogs.map((log, index) => {
            const effort = effortFromLogFields(log.effortScale, log.effortValue);
            return (
              <View
                key={`${log.exerciseId}-${log.setNumber}`}
                className={cx(
                  "mb-1 flex-row items-center rounded-lg px-1 py-2",
                  index % 2 === 0 ? "bg-surface-muted" : "bg-surface",
                  log.isWarmup ? "opacity-70" : null,
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
                {showEffort ? (
                  <Text className="w-16 text-center text-text-secondary text-xs font-semibold">
                    {formatEffortLabel(effort) || "—"}
                  </Text>
                ) : null}
                <Text className="w-10 text-center text-text-muted text-[10px] font-semibold">
                  {log.isWarmup ? "WU" : ""}
                </Text>
              </View>
            );
          })}
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
