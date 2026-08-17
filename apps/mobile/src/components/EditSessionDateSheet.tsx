import { createElement, useEffect, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { CalendarPicker } from "./CalendarPicker";
import { BottomSheet, Button, Input } from "./ui";

export type SessionDateTimeSave = {
  startedAt: string;
  completedAt?: string | null;
};

type EditSessionDateSheetProps = {
  visible: boolean;
  onClose: () => void;
  initialStartedIso: string;
  initialCompletedIso?: string | null;
  onSave: (data: SessionDateTimeSave) => void;
  saving?: boolean;
  title?: string;
  subtitle?: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInputValue(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseTimeField(timeStr: string): { hour: number; minute: number } | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function combineDateAndTime(date: Date, timeStr: string): Date | null {
  const time = parseTimeField(timeStr);
  if (!time) return null;
  const result = new Date(date);
  result.setHours(time.hour, time.minute, 0, 0);
  return result;
}

const webFieldStyle = {
  width: "100%" as const,
  height: 48,
  borderRadius: 12,
  border: "1px solid #24324a",
  backgroundColor: "#0f1728",
  color: "#f8fafc",
  fontSize: 16,
  paddingLeft: 12,
  paddingRight: 12,
  outline: "none",
  colorScheme: "dark" as const,
  boxSizing: "border-box" as const,
};

function WebNativeField({
  type,
  value,
  onChange,
  label,
}: {
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <View className="w-full">
      <Text className="text-text-secondary text-sm mb-1.5">{label}</Text>
      {createElement("input", {
        type,
        value,
        onChange: (event: { target: { value: string } }) => onChange(event.target.value),
        style: webFieldStyle,
      })}
    </View>
  );
}

export function EditSessionDateSheet({
  visible,
  onClose,
  initialStartedIso,
  initialCompletedIso = null,
  onSave,
  saving = false,
  title = "Edytuj datę rozpoczęcia",
  subtitle = "Ustaw dzień i godzinę startu treningu.",
}: EditSessionDateSheetProps) {
  const showEndTime = initialCompletedIso != null;

  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => new Date());
  const [startTimeStr, setStartTimeStr] = useState("");
  const [endTimeStr, setEndTimeStr] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const startParsed = new Date(initialStartedIso);
    const safeStart = Number.isNaN(startParsed.getTime()) ? new Date() : startParsed;
    setStartDate(safeStart);
    setStartTimeStr(toTimeInputValue(safeStart));

    if (initialCompletedIso) {
      const endParsed = new Date(initialCompletedIso);
      const safeEnd = Number.isNaN(endParsed.getTime()) ? safeStart : endParsed;
      setEndDate(safeEnd);
      setEndTimeStr(toTimeInputValue(safeEnd));
    } else {
      setEndDate(safeStart);
      setEndTimeStr("");
    }

    setError(null);
  }, [visible, initialStartedIso, initialCompletedIso]);

  const applyDateParts = (base: Date, year: number, month: number, day: number) => {
    const next = new Date(base);
    next.setFullYear(year, month, day);
    return next;
  };

  const handleStartDaySelect = (year: number, month: number, day: number) => {
    setStartDate((prev) => applyDateParts(prev, year, month, day));
    setError(null);
  };

  const handleEndDaySelect = (year: number, month: number, day: number) => {
    setEndDate((prev) => applyDateParts(prev, year, month, day));
    setError(null);
  };

  const handleWebDateChange = (value: string, target: "start" | "end") => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return;
    if (target === "start") {
      setStartDate((prev) => applyDateParts(prev, year, month - 1, day));
    } else {
      setEndDate((prev) => applyDateParts(prev, year, month - 1, day));
    }
    setError(null);
  };

  const handleSave = () => {
    const startedAt = combineDateAndTime(startDate, startTimeStr);
    if (!startedAt) {
      setError("Wybierz godzinę startu.");
      return;
    }
    if (startedAt.getTime() > Date.now() + 5 * 60 * 1000) {
      setError("Start nie może być w przyszłości.");
      return;
    }

    if (!showEndTime) {
      onSave({ startedAt: startedAt.toISOString() });
      return;
    }

    const completedAt = combineDateAndTime(endDate, endTimeStr);
    if (!completedAt) {
      setError("Wybierz godzinę zakończenia.");
      return;
    }
    if (completedAt.getTime() <= startedAt.getTime()) {
      setError("Koniec musi być później niż start.");
      return;
    }
    if (completedAt.getTime() > Date.now() + 5 * 60 * 1000) {
      setError("Koniec nie może być w przyszłości.");
      return;
    }

    onSave({
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }}>
        {Platform.OS === "web" ? (
          <View className="gap-y-3">
            <WebNativeField
              type="date"
              label="Data startu"
              value={toDateInputValue(startDate)}
              onChange={(value) => handleWebDateChange(value, "start")}
            />
            <WebNativeField
              type="time"
              label="Godzina startu"
              value={startTimeStr}
              onChange={setStartTimeStr}
            />
            {showEndTime ? (
              <>
                <WebNativeField
                  type="date"
                  label="Data zakończenia"
                  value={toDateInputValue(endDate)}
                  onChange={(value) => handleWebDateChange(value, "end")}
                />
                <WebNativeField
                  type="time"
                  label="Godzina zakończenia"
                  value={endTimeStr}
                  onChange={setEndTimeStr}
                />
              </>
            ) : null}
          </View>
        ) : (
          <View>
            <Text className="text-text-secondary text-sm mb-1.5">Data startu</Text>
            <CalendarPicker selectedDate={startDate} onSelectDay={handleStartDaySelect} />
            <Input
              label="Godzina startu"
              placeholder="GG:MM"
              value={startTimeStr}
              onChangeText={setStartTimeStr}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              containerClassName="mt-3"
            />
            {showEndTime ? (
              <>
                <Text className="text-text-secondary text-sm mb-1.5 mt-4">Data zakończenia</Text>
                <CalendarPicker selectedDate={endDate} onSelectDay={handleEndDaySelect} />
                <Input
                  label="Godzina zakończenia"
                  placeholder="GG:MM"
                  value={endTimeStr}
                  onChangeText={setEndTimeStr}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  containerClassName="mt-3"
                />
              </>
            ) : null}
          </View>
        )}

        {error ? <Text className="text-danger text-xs mt-2">{error}</Text> : null}

        <Button label="Zapisz" onPress={handleSave} loading={saving} className="mt-5 mb-2" />
      </ScrollView>
    </BottomSheet>
  );
}
