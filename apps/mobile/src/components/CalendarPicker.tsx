import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { ICON_SIZE, ICON_STROKE } from "./ui";

const DAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];
const MONTHS = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

type CalendarPickerProps = {
  /** Aktualnie wybrany dzień (tylko rok/miesiąc/dzień są istotne — godzina ustawiana osobno). */
  selectedDate: Date;
  onSelectDay: (year: number, month: number, day: number) => void;
  /** Blokuje wybór dni w przyszłości (domyślnie true). */
  disableFuture?: boolean;
};

export function CalendarPicker({
  selectedDate,
  onSelectDay,
  disableFuture = true,
}: CalendarPickerProps) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  // Jump the visible month if the selected date changes to a different month
  // (e.g. via a "Teraz"/"Wczoraj" quick-pick outside this component).
  useEffect(() => {
    setViewYear(selectedDate.getFullYear());
    setViewMonth(selectedDate.getMonth());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()]);

  const today = new Date();
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isFutureMonth =
    viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  const cells: JSX.Element[] = [];

  for (const name of DAYS) {
    cells.push(
      <View key={`h-${name}`} className="flex-1 items-center py-1">
        <Text className="text-text-muted text-xs font-semibold">{name}</Text>
      </View>,
    );
  }

  for (let i = 0; i < firstDay; i++) {
    cells.push(<View key={`e-${i}`} className="flex-1 items-center py-1" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isSelected =
      day === selectedDate.getDate() &&
      viewMonth === selectedDate.getMonth() &&
      viewYear === selectedDate.getFullYear();
    const isToday =
      day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
    const cellDate = new Date(viewYear, viewMonth, day, 23, 59, 59);
    const isFuture = disableFuture && cellDate.getTime() > Date.now();

    cells.push(
      <View key={`d-${day}`} className="flex-1 items-center py-1">
        <TouchableOpacity
          disabled={isFuture}
          onPress={() => onSelectDay(viewYear, viewMonth, day)}
          className={`h-9 w-9 items-center justify-center rounded-full ${
            isSelected ? "bg-action-primary" : isToday ? "border border-action-primary" : ""
          }`}
        >
          <Text
            className={`text-sm ${
              isFuture
                ? "text-text-muted opacity-40"
                : isSelected
                  ? "font-bold text-white"
                  : isToday
                    ? "font-bold text-action-primary"
                    : "text-text-secondary"
            }`}
          >
            {day}
          </Text>
        </TouchableOpacity>
      </View>,
    );
  }

  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remaining; i++) {
    cells.push(<View key={`r-${i}`} className="flex-1 items-center py-1" />);
  }

  const rows: JSX.Element[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(
      <View key={`row-${i}`} className="flex-row">
        {cells.slice(i, i + 7)}
      </View>,
    );
  }

  return (
    <View className="w-full rounded-xl border border-border bg-surface-muted px-2 py-3">
      <View className="mb-2 flex-row items-center justify-between px-1">
        <TouchableOpacity
          onPress={goToPrevMonth}
          className="h-8 w-8 items-center justify-center rounded-lg bg-action-secondary border border-border"
          accessibilityLabel="Poprzedni miesiąc"
        >
          <ChevronLeft size={ICON_SIZE} strokeWidth={ICON_STROKE} color="#c0c9d8" />
        </TouchableOpacity>

        <Text className="text-text-primary text-sm font-bold">
          {MONTHS[viewMonth]} {viewYear}
        </Text>

        <TouchableOpacity
          onPress={goToNextMonth}
          disabled={disableFuture && isFutureMonth}
          className={`h-8 w-8 items-center justify-center rounded-lg bg-action-secondary border border-border ${
            disableFuture && isFutureMonth ? "opacity-40" : ""
          }`}
          accessibilityLabel="Następny miesiąc"
        >
          <ChevronRight size={ICON_SIZE} strokeWidth={ICON_STROKE} color="#c0c9d8" />
        </TouchableOpacity>
      </View>

      {rows}
    </View>
  );
}
