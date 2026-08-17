import { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { SessionSetLog } from "@bhmt3wp/shared";
import {
  epley1rm,
  exerciseVolume,
  formatVolumeKg,
  formatWeightKg,
  isTimeBasedExercise,
} from "@bhmt3wp/shared";
import { ChevronRight, NotebookPen, Trash2 } from "lucide-react-native";
import { BottomSheet, Button, ICON_STROKE, Input, cx } from "./ui";

export type ExerciseLogDraft = {
  setCount: string;
  weightKg: string;
  reps: string;
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

const DEFAULT_DRAFT: ExerciseLogDraft = {
  setCount: "1",
  weightKg: "0",
  reps: "10",
  notes: "",
};

export function createDraftFromLogs(
  logs: SessionSetLog[],
  notes = "",
): ExerciseLogDraft {
  if (logs.length === 0) return { ...DEFAULT_DRAFT, notes };

  const first = logs[0];
  return {
    setCount: String(logs.length),
    weightKg: String(first.weightKg),
    reps: String(first.reps),
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

  const setCount = Math.max(0, parseInt(draft.setCount, 10) || 0);
  const weightKg = parseFloat(draft.weightKg) || 0;
  const reps = parseInt(draft.reps, 10) || 0;

  const est1rm = useMemo(
    () => (!timeBased ? epley1rm(weightKg, reps) : 0),
    [timeBased, weightKg, reps],
  );
  const volume = useMemo(
    () => (!timeBased ? exerciseVolume(weightKg, reps, setCount) : 0),
    [timeBased, weightKg, reps, setCount],
  );

  const canSave = setCount > 0 && (timeBased ? reps > 0 : weightKg > 0 && reps > 0);

  const updateField = (field: keyof ExerciseLogDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <View>
      {previousLog ? (
        <Text className="text-text-muted text-xs mb-3">
          Poprzednio:{" "}
          {timeBased
            ? `${previousLog.reps}s`
            : `${previousLog.weightKg} kg × ${previousLog.reps} pow.`}
        </Text>
      ) : null}

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Text className="text-text-muted text-xs font-semibold uppercase mb-1.5">Serie</Text>
          <Input
            value={draft.setCount}
            onChangeText={(value) => updateField("setCount", value.replace(/[^\d]/g, ""))}
            keyboardType="number-pad"
            placeholder="3"
            inputClassName="text-center font-bold"
            fontSize={20}
          />
        </View>

        {timeBased ? (
          <View className="flex-[2]">
            <Text className="text-text-muted text-xs font-semibold uppercase mb-1.5">
              Czas (sekundy)
            </Text>
            <Input
              value={draft.reps}
              onChangeText={(value) => updateField("reps", value.replace(/[^\d]/g, ""))}
              keyboardType="number-pad"
              placeholder="60"
              inputClassName="text-center font-bold"
              fontSize={20}
            />
          </View>
        ) : (
          <>
            <View className="flex-1">
              <Text className="text-text-muted text-xs font-semibold uppercase mb-1.5">
                Ciężar (kg)
              </Text>
              <Input
                value={draft.weightKg}
                onChangeText={(value) => updateField("weightKg", value.replace(/[^\d.,]/g, "").replace(",", "."))}
                keyboardType="decimal-pad"
                placeholder="0"
                inputClassName="text-center font-bold"
                fontSize={20}
              />
            </View>
            <View className="flex-1">
              <Text className="text-text-muted text-xs font-semibold uppercase mb-1.5">
                Powtórzenia
              </Text>
              <Input
                value={draft.reps}
                onChangeText={(value) => updateField("reps", value.replace(/[^\d]/g, ""))}
                keyboardType="number-pad"
                placeholder="10"
                inputClassName="text-center font-bold"
                fontSize={20}
              />
            </View>
          </>
        )}
      </View>

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
          onChangeText={(value) => updateField("notes", value)}
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
          <Text className="text-text-muted text-xs font-semibold uppercase">Czas na serię</Text>
          <Text className="text-text-primary text-2xl font-bold mt-1">{reps > 0 ? `${reps}s` : "—"}</Text>
          {setCount > 1 ? (
            <Text className="text-text-muted text-xs mt-1">
              Łącznie {setCount} × {reps}s = {setCount * reps}s
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="mt-3 flex-row gap-3">
          <View className="flex-1 rounded-xl bg-surface-muted border border-border px-3 py-3">
            <Text className="text-text-muted text-xs font-semibold uppercase">Est. 1RM</Text>
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
  setCount,
  weightKg,
  reps,
  notes,
  timeBased,
  layout = "standalone",
}: {
  exerciseName: string;
  setCount: number;
  weightKg: number;
  reps: number;
  notes?: string;
  timeBased?: boolean;
  /** standalone = karta w aktywnym treningu; afterSets = stopka pod tabelą serii w historii */
  layout?: "standalone" | "afterSets";
}) {
  const isTime = timeBased ?? isTimeBasedExercise(exerciseName);
  const est1rm = !isTime ? epley1rm(weightKg, reps) : 0;
  const volume = !isTime ? exerciseVolume(weightKg, reps, setCount) : 0;
  const totalReps = setCount * reps;

  return (
    <View className={layout === "afterSets" ? "mt-3 pt-3 border-t border-border" : undefined}>
      {layout === "standalone" ? (
        <View className="flex-row gap-2 mb-2">
          <SummaryMetric label="Serie" value={String(setCount)} className="flex-1" />
          {isTime ? (
            <>
              <SummaryMetric label="Czas" value={`${reps}s`} className="flex-1" />
              <SummaryMetric
                label="Łącznie"
                value={`${totalReps}s`}
                className="flex-1"
              />
            </>
          ) : (
            <>
              <SummaryMetric label="Ciężar" value={`${formatWeightKg(weightKg)}`} className="flex-1" />
              <SummaryMetric label="Powt." value={String(reps)} className="flex-1" />
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
          Łącznie {totalReps} powt. · {setCount} {setCount === 1 ? "seria" : setCount < 5 ? "serie" : "serii"} × {formatWeightKg(weightKg)} × {reps}
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
