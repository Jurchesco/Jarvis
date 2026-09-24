import { useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BellRing,
  BookOpen,
  CheckCircle2,
  Download,
  Dumbbell,
  FileSpreadsheet,
  Globe,
  HardDrive,
  Info,
  LogOut,
  Moon,
  Palette,
  RefreshCw,
  Scale,
  Settings2,
  Sheet,
  Upload,
  User,
} from "lucide-react-native";
import {
  BODY_SEX_OPTIONS,
  formatBodyWeightKg,
  parseJarvisBackupJson,
  summarizeBackup,
} from "@bhmt3wp/shared";
import type { BodySex, EffortScale } from "@bhmt3wp/shared";
import { APP_NAME, APP_TAGLINE, APP_VERSION } from "../../../src/constants/branding";
import { useAuth } from "../../../src/contexts/AuthContext";
import {
  DEFAULT_REST_OPTIONS,
  EFFORT_SCALE_PREF_OPTIONS,
  EXERCISE_LOG_FILL_MODE_OPTIONS,
  getAutofillPrevious,
  getDefaultRestSec,
  getEffortLoggingEnabled,
  getEffortScale,
  getExerciseLogFillMode,
  getHapticsEnabled,
  getKeepAwakeEnabled,
  getRestTimerEnabled,
  setAutofillPrevious,
  setDefaultRestSec,
  setEffortLoggingEnabled,
  setEffortScale,
  setExerciseLogFillMode,
  setHapticsEnabled,
  setKeepAwakeEnabled,
  setRestTimerEnabled,
  type DefaultRestSec,
  type ExerciseLogFillMode,
} from "../../../src/lib/appPreferences";
import { exportAiContextFile } from "../../../src/lib/aiContextExport";
import { buildJarvisBackup } from "../../../src/lib/backupExport";
import { deliverBackupFile, deliverDownloadableText, pickBackupJsonFile } from "../../../src/lib/backupFile";
import { importJarvisBackup } from "../../../src/lib/backupImport";
import {
  createBodyMeasurement,
  fetchBodyProfile,
  listBodyMeasurements,
  updateBodyProfile,
  type BodyProfile,
} from "../../../src/lib/bodyApi";
import type { BodyMeasurement } from "@bhmt3wp/shared";
import { useRestTimer } from "../../../src/lib/useRestTimer";
import { RestTimerOverlay } from "../../../src/components/RestTimerOverlay";
import * as notifications from "../../../src/lib/notifications";
import { syncWorkoutsToGoogleSheets } from "../../../src/lib/sheetSync";
import {
  formatRelativeSyncTime,
  getLastSheetSyncAt,
  getLastSheetSyncResult,
  type SheetSyncResult,
} from "../../../src/lib/sheetSyncPrefs";
import { getSupabaseProjectRef, supabase } from "../../../src/lib/supabase";
import {
  Button,
  Card,
  ICON_STROKE,
  Input,
  Pills,
  ScreenHeader,
  StateBlock,
} from "../../../src/components/ui";

function SettingsSection({
  title,
  icon: Icon,
  iconColor,
  children,
}: {
  title: string;
  icon: typeof Settings2;
  iconColor: string;
  children: ReactNode;
}) {
  return (
    <Card className="mt-5" padding="lg">
      <View className="flex-row items-center mb-4">
        <View className="mr-3 h-8 w-8 items-center justify-center rounded-xl bg-action-secondary border border-border">
          <Icon size={16} strokeWidth={ICON_STROKE} color={iconColor} />
        </View>
        <Text className="text-text-primary text-base font-bold leading-tight">{title}</Text>
      </View>
      {children}
    </Card>
  );
}

function SettingSwitchRow({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <View className="flex-1 pr-4">
        <Text className="text-text-primary text-sm font-semibold">{title}</Text>
        <Text className="text-text-secondary text-xs mt-1 leading-5">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#24324a", true: "#3b82f6" }}
        thumbColor={value ? "#f8fafc" : "#c0c9d8"}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const [autofillEnabled, setAutofillEnabled] = useState(true);
  const [fillMode, setFillMode] = useState<ExerciseLogFillMode>("per-set");
  const [effortLoggingEnabled, setEffortLoggingEnabledState] = useState(false);
  const [effortScale, setEffortScaleState] = useState<EffortScale>("rir");
  const [defaultRestSec, setDefaultRestSecState] = useState<DefaultRestSec>(60);
  const [restTimerEnabled, setRestTimerEnabledState] = useState(true);
  const [keepAwakeEnabled, setKeepAwakeEnabledState] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [exportingAiContext, setExportingAiContext] = useState(false);
  const [bodyProfile, setBodyProfile] = useState<BodyProfile | null>(null);
  const [recentWeights, setRecentWeights] = useState<BodyMeasurement[]>([]);
  const [heightInput, setHeightInput] = useState("");
  const [goalWeightInput, setGoalWeightInput] = useState("");
  const [sexValue, setSexValue] = useState<BodySex | "">("");
  const [weighInInput, setWeighInInput] = useState("");
  const [savingBody, setSavingBody] = useState(false);
  const [savingWeighIn, setSavingWeighIn] = useState(false);
  const [bodySchemaMissing, setBodySchemaMissing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SheetSyncResult | null>(null);
  const restPreview = useRestTimer();

  const refreshBodyData = async () => {
    try {
      const [profile, measurements] = await Promise.all([
        fetchBodyProfile(),
        listBodyMeasurements(8),
      ]);
      setBodyProfile(profile);
      setRecentWeights(measurements);
      setHeightInput(profile?.heightCm != null ? String(profile.heightCm) : "");
      setGoalWeightInput(profile?.goalWeightKg != null ? String(profile.goalWeightKg) : "");
      setSexValue(profile?.sex ?? "");
      setBodySchemaMissing(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (/relation|does not exist|column/i.test(msg)) {
        setBodySchemaMissing(true);
      }
    }
  };
  const refreshSyncStatus = async () => {
    const [at, result] = await Promise.all([getLastSheetSyncAt(), getLastSheetSyncResult()]);
    setLastSyncAt(at);
    setLastSyncResult(result);
  };

  useEffect(() => {
    Promise.all([
      notifications.getEnabled(),
      getHapticsEnabled(),
      getAutofillPrevious(),
      getDefaultRestSec(),
      getRestTimerEnabled(),
      getKeepAwakeEnabled(),
      getExerciseLogFillMode(),
      getEffortLoggingEnabled(),
      getEffortScale(),
      refreshSyncStatus(),
      refreshBodyData(),
    ]).then(
      ([
        notif,
        haptics,
        autofill,
        restSec,
        restEnabled,
        keepAwake,
        exerciseFillMode,
        effortOn,
        effortScalePref,
      ]) => {
        setNotifEnabled(notif);
        setHapticsEnabledState(haptics);
        setAutofillEnabled(autofill);
        setDefaultRestSecState(restSec);
        setRestTimerEnabledState(restEnabled);
        setKeepAwakeEnabledState(keepAwake);
        setFillMode(exerciseFillMode);
        setEffortLoggingEnabledState(effortOn);
        setEffortScaleState(effortScalePref);
        setLoadingPrefs(false);
      },
    );
  }, []);

  const handleNotifToggle = async (value: boolean) => {
    setNotifEnabled(value);
    try {
      await notifications.setEnabled(value);
      if (value) await notifications.scheduleDaily();
      else await notifications.cancelReminder();
    } catch {
      setNotifEnabled(!value);
    }
  };

  const handleHapticsToggle = async (value: boolean) => {
    setHapticsEnabledState(value);
    try {
      await setHapticsEnabled(value);
    } catch {
      setHapticsEnabledState(!value);
    }
  };

  const handleAutofillToggle = async (value: boolean) => {
    setAutofillEnabled(value);
    try {
      await setAutofillPrevious(value);
    } catch {
      setAutofillEnabled(!value);
    }
  };

  const handleFillModeChange = async (value: string) => {
    const mode = value as ExerciseLogFillMode;
    const prev = fillMode;
    setFillMode(mode);
    try {
      await setExerciseLogFillMode(mode);
    } catch {
      setFillMode(prev);
    }
  };

  const handleEffortLoggingToggle = async (value: boolean) => {
    setEffortLoggingEnabledState(value);
    try {
      await setEffortLoggingEnabled(value);
    } catch {
      setEffortLoggingEnabledState(!value);
    }
  };

  const handleEffortScaleChange = async (value: string) => {
    const scale = value as EffortScale;
    const prev = effortScale;
    setEffortScaleState(scale);
    try {
      await setEffortScale(scale);
    } catch {
      setEffortScaleState(prev);
    }
  };

  const handleRestChange = async (value: string) => {
    const sec = parseInt(value, 10) as DefaultRestSec;
    setDefaultRestSecState(sec);
    await setDefaultRestSec(sec);
  };

  const handleRestTimerToggle = async (value: boolean) => {
    setRestTimerEnabledState(value);
    try {
      await setRestTimerEnabled(value);
      if (!value) restPreview.dismiss();
    } catch {
      setRestTimerEnabledState(!value);
    }
  };

  const handleKeepAwakeToggle = async (value: boolean) => {
    setKeepAwakeEnabledState(value);
    try {
      await setKeepAwakeEnabled(value);
    } catch {
      setKeepAwakeEnabledState(!value);
    }
  };

  const handleResetPassword = async () => {
    const email = user?.email;
    if (!email) {
      Alert.alert("Brak adresu e-mail", "Nie można wysłać linku resetującego hasło.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      Alert.alert("Błąd", error.message);
      return;
    }
    Alert.alert(
      "Sprawdź skrzynkę",
      `Wysłaliśmy link do resetu hasła na ${email}.`,
    );
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const handleSheetSync = async () => {
    setSyncing(true);
    try {
      const result = await syncWorkoutsToGoogleSheets(30);
      await refreshSyncStatus();
      if (result.ok) {
        Alert.alert(
          "Synchronizacja zakończona",
          result.message ?? "Dane trafiły do arkusza Silownia_import.",
        );
      } else {
        Alert.alert("Błąd synchronizacji", result.error ?? "Spróbuj ponownie później.");
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveBodyProfile = async () => {
    setSavingBody(true);
    try {
      const heightCm = heightInput.trim() ? parseFloat(heightInput.replace(",", ".")) : null;
      const goalWeightKg = goalWeightInput.trim()
        ? parseFloat(goalWeightInput.replace(",", "."))
        : null;
      if (heightCm != null && (Number.isNaN(heightCm) || heightCm < 50 || heightCm > 300)) {
        throw new Error("Wzrost: podaj cm w zakresie 50–300.");
      }
      if (
        goalWeightKg != null &&
        (Number.isNaN(goalWeightKg) || goalWeightKg < 20 || goalWeightKg > 400)
      ) {
        throw new Error("Cel masy: podaj kg w rozsądnym zakresie.");
      }
      const updated = await updateBodyProfile({
        heightCm,
        goalWeightKg,
        sex: sexValue || null,
      });
      setBodyProfile(updated);
      Alert.alert("Zapisano", "Profil ciała zaktualizowany.");
    } catch (error) {
      Alert.alert(
        "Błąd zapisu",
        error instanceof Error ? error.message : "Nie udało się zapisać profilu.",
      );
    } finally {
      setSavingBody(false);
    }
  };

  const handleWeighIn = async () => {
    const weightKg = parseFloat(weighInInput.replace(",", "."));
    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg >= 500) {
      Alert.alert("Błędna waga", "Podaj masę w kg (np. 82.4).");
      return;
    }
    setSavingWeighIn(true);
    try {
      await createBodyMeasurement(
        { weightKg, source: "manual" },
        bodyProfile?.heightCm ?? null,
      );
      setWeighInInput("");
      await refreshBodyData();
      Alert.alert("Zapisano", `Waga ${formatBodyWeightKg(weightKg)} dodana.`);
    } catch (error) {
      Alert.alert(
        "Błąd weigh-inu",
        error instanceof Error
          ? error.message
          : "Uruchom migrację supabase/body_and_health.sql w SQL Editor.",
      );
    } finally {
      setSavingWeighIn(false);
    }
  };

  const handleExportAiContext = async (format: "csv" | "json") => {
    setExportingAiContext(true);
    try {
      const file = await exportAiContextFile({ days: 30 }, format);
      const mode = await deliverDownloadableText(file.content, file.filename, file.mime);
      Alert.alert(
        mode === "downloaded" ? "Kontekst AI pobrany" : "Kontekst AI udostępniony",
        `Ostatnie 30 dni (${format.toUpperCase()}) — wklej do czatu / Hermesa.`,
      );
    } catch (error) {
      Alert.alert(
        "Błąd eksportu AI",
        error instanceof Error ? error.message : "Nie udało się zbudować kontekstu.",
      );
    } finally {
      setExportingAiContext(false);
    }
  };

  const handleExportBackup = async () => {
    setExportingBackup(true);
    try {
      const backup = await buildJarvisBackup();
      const stats = summarizeBackup(backup);
      const mode = await deliverBackupFile(backup);
      Alert.alert(
        mode === "downloaded" ? "Backup pobrany" : "Backup udostępniony",
        `${stats.sheets} planów · ${stats.sessions} sesji · ${stats.logs} serii` +
          (stats.bodyMeasurements ? ` · ${stats.bodyMeasurements} ważenia` : "") +
          ".",
      );
    } catch (error) {
      Alert.alert(
        "Błąd eksportu",
        error instanceof Error ? error.message : "Nie udało się utworzyć backupu.",
      );
    } finally {
      setExportingBackup(false);
    }
  };

  const runImportBackup = async (raw: string) => {
    setImportingBackup(true);
    try {
      const backup = parseJarvisBackupJson(raw);
      const preview = summarizeBackup(backup);
      const result = await importJarvisBackup(backup);
      await queryClient.invalidateQueries();
      Alert.alert(
        "Import zakończony",
        `Dodano ${result.sheetsCreated} planów, ${result.sessionsCreated} sesji, ${result.logsCreated} serii` +
          ` (w pliku: ${preview.sheets} / ${preview.sessions} / ${preview.logs}).`,
      );
    } catch (error) {
      Alert.alert(
        "Błąd importu",
        error instanceof Error ? error.message : "Nie udało się wczytać backupu.",
      );
    } finally {
      setImportingBackup(false);
    }
  };

  const handleImportBackup = async () => {
    try {
      const raw = await pickBackupJsonFile();
      const backup = parseJarvisBackupJson(raw);
      const preview = summarizeBackup(backup);
      const message =
        `Plik: ${preview.sheets} planów, ${preview.sessions} sesji, ${preview.logs} serii.\n` +
        "Dane zostaną dodane jako nowe (istniejące nie są kasowane).";

      if (Platform.OS === "web" && typeof window !== "undefined") {
        const ok = window.confirm(`Zaimportować backup?\n\n${message}`);
        if (ok) await runImportBackup(raw);
        return;
      }

      Alert.alert("Zaimportować backup?", message, [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Importuj",
          onPress: () => {
            void runImportBackup(raw);
          },
        },
      ]);
    } catch (error) {
      if (error instanceof Error && /Nie wybrano pliku/i.test(error.message)) return;
      Alert.alert(
        "Błąd importu",
        error instanceof Error ? error.message : "Nie udało się wczytać pliku.",
      );
    }
  };

  const syncStatusIcon = syncing
    ? RefreshCw
    : lastSyncResult && !lastSyncResult.ok
      ? AlertCircle
      : lastSyncAt
        ? CheckCircle2
        : RefreshCw;

  const SyncStatusIcon = syncStatusIcon;
  const syncStatusColor = syncing
    ? "#60a5fa"
    : lastSyncResult && !lastSyncResult.ok
      ? "#ef4444"
      : lastSyncAt
        ? "#22c55e"
        : "#7c8aa5";

  const syncStatusText = syncing
    ? "Synchronizacja w toku…"
    : lastSyncResult && !lastSyncResult.ok
      ? `Błąd — ${lastSyncResult.error ?? "sprawdź połączenie"}`
      : `Ostatnia synchronizacja: ${formatRelativeSyncTime(lastSyncAt)}`;

  const supabaseProjectRef = getSupabaseProjectRef();
  const syncTargetProjectRef = "vggkwwyjobfcokwtfljj";
  const projectMismatch =
    supabaseProjectRef != null && supabaseProjectRef !== syncTargetProjectRef;
  const showDeployBanner =
    projectMismatch ||
    (!!lastSyncResult?.error &&
      /404|nie istnieje na tym projekcie|sync-sheets nie istnieje/i.test(lastSyncResult.error));

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-3">
          <ScreenHeader
            title="Ustawienia"
            subtitle="Konto, trening i preferencje aplikacji."
            icon={Settings2}
          />
        </View>

        <SettingsSection title="Konto" icon={User} iconColor="#60a5fa">
          <Text className="text-text-muted text-xs font-semibold uppercase mb-1">E-mail</Text>
          <Text className="text-text-primary text-sm mb-1">{user?.email ?? "—"}</Text>
          {user?.id ? (
            <Text className="text-text-muted text-[10px] mb-4 leading-4" selectable>
              ID: {user.id}
            </Text>
          ) : (
            <View className="mb-4" />
          )}
          <Button
            label="Zmień hasło"
            variant="secondary"
            size="sm"
            onPress={handleResetPassword}
            className="mb-3"
          />
          <Button
            label="Wyloguj"
            icon={LogOut}
            variant="ghost"
            size="sm"
            onPress={handleSignOut}
            loading={signingOut}
          />
        </SettingsSection>

        <SettingsSection title="Profil i waga" icon={Scale} iconColor="#34d399">
          {bodySchemaMissing ? (
            <StateBlock
              title="Migracja SQL wymagana"
              description="Uruchom supabase/body_and_health.sql w SQL Editor, potem odśwież."
              icon={AlertCircle}
            />
          ) : (
            <>
              <Text className="text-text-secondary text-sm mb-3 leading-5">
                Aktualna waga:{" "}
                <Text className="text-text-primary font-semibold">
                  {formatBodyWeightKg(recentWeights[0]?.weightKg)}
                </Text>
                {bodyProfile?.goalWeightKg != null
                  ? ` · cel ${formatBodyWeightKg(bodyProfile.goalWeightKg)}`
                  : ""}
              </Text>
              <Input
                label="Wzrost (cm)"
                value={heightInput}
                onChangeText={setHeightInput}
                keyboardType="decimal-pad"
                placeholder="178"
                containerClassName="mb-3"
              />
              <Input
                label="Cel masy (kg)"
                value={goalWeightInput}
                onChangeText={setGoalWeightInput}
                keyboardType="decimal-pad"
                placeholder="80"
                containerClassName="mb-3"
              />
              <Text className="text-text-secondary text-sm mb-2">Płeć (opcjonalnie)</Text>
              <Pills
                options={[
                  { value: "unset", label: "—" },
                  ...BODY_SEX_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                ]}
                value={sexValue || "unset"}
                onChange={(v) => setSexValue(v === "unset" ? "" : (v as BodySex))}
              />
              <Button
                label="Zapisz profil"
                variant="secondary"
                size="sm"
                onPress={handleSaveBodyProfile}
                loading={savingBody}
                className="mt-4 mb-5"
              />
              <Input
                label="Szybki weigh-in (kg)"
                value={weighInInput}
                onChangeText={setWeighInInput}
                keyboardType="decimal-pad"
                placeholder="82.4"
                containerClassName="mb-3"
              />
              <Button
                label="Dodaj pomiar"
                variant="primary"
                size="sm"
                onPress={handleWeighIn}
                loading={savingWeighIn}
                className="mb-4"
              />
              {recentWeights.length > 0 ? (
                <View>
                  <Text className="text-text-muted text-xs font-semibold uppercase mb-2">
                    Ostatnie pomiary
                  </Text>
                  {recentWeights.slice(0, 5).map((m) => (
                    <Text key={m.id} className="text-text-secondary text-xs leading-5 mb-1">
                      {m.measuredAt.slice(0, 16).replace("T", " ")} — {formatBodyWeightKg(m.weightKg)}
                      {m.source === "openscale" ? " · openScale" : " · ręcznie"}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text className="text-text-muted text-xs leading-5">
                  Brak pomiarów w bazie. Dodaj ręcznie albo zaimportuj backup openScale (importer →
                  Supabase).
                </Text>
              )}
            </>
          )}
        </SettingsSection>

        <SettingsSection title="Trening" icon={Dumbbell} iconColor="#22c55e">
          <Button
            label="Baza ćwiczeń (1324 + GIF)"
            icon={BookOpen}
            variant="secondary"
            onPress={() => router.push("/exercises")}
            className="mb-4"
          />
          <Text className="text-text-secondary text-sm font-semibold mb-2">
            Wypełnianie serii
          </Text>
          <Text className="text-text-muted text-xs mb-3 leading-5">
            Domyślny tryb formularza: jedna wartość dla wszystkich serii albo osobno na każdą (rampa).
            Możesz też przełączyć w trakcie treningu.
          </Text>
          <Pills
            options={EXERCISE_LOG_FILL_MODE_OPTIONS}
            value={fillMode}
            onChange={handleFillModeChange}
          />

          <View className="mt-5 border-t border-border pt-4">
            <SettingSwitchRow
              title="Loguj RIR / RPE"
              description="Pokaż opcjonalne pole wysiłku przy zapisie serii (RIR 0–10 lub RPE 1–10)."
              value={effortLoggingEnabled}
              onValueChange={handleEffortLoggingToggle}
              disabled={loadingPrefs}
            />
            {effortLoggingEnabled ? (
              <View className="mt-4">
                <Text className="text-text-secondary text-sm font-semibold mb-2">
                  Domyślna skala
                </Text>
                <Text className="text-text-muted text-xs mb-3 leading-5">
                  RIR = powtórzenia w zapasie. RPE = odczuwany wysiłek. Możesz zmienić też w formularzu.
                </Text>
                <Pills
                  options={EFFORT_SCALE_PREF_OPTIONS}
                  value={effortScale}
                  onChange={handleEffortScaleChange}
                />
              </View>
            ) : null}
          </View>

          <View className="mt-5 border-t border-border pt-4">
            <SettingSwitchRow
              title="Timer odpoczynku"
              description="Po zapisie ćwiczenia pokaż pasek odliczania (−15s / +30s / Pomiń)."
              value={restTimerEnabled}
              onValueChange={handleRestTimerToggle}
              disabled={loadingPrefs}
            />
            <Text className="text-text-secondary text-sm font-semibold mb-2 mt-4">
              Domyślny czas odpoczynku
            </Text>
            <Text className="text-text-muted text-xs mb-3 leading-5">
              Start timera po zapisie ćwiczenia w trakcie treningu.
            </Text>
            <Pills
              options={DEFAULT_REST_OPTIONS.map((sec) => ({
                value: String(sec),
                label: `${sec}s`,
              }))}
              value={String(defaultRestSec)}
              onChange={handleRestChange}
            />
            <Button
              label={restPreview.active ? "Zatrzymaj podgląd" : "Podgląd timera"}
              variant="secondary"
              size="sm"
              className="mt-3"
              disabled={loadingPrefs || !restTimerEnabled}
              onPress={() => {
                if (restPreview.active) restPreview.dismiss();
                else restPreview.start(defaultRestSec);
              }}
            />
            <View className="mt-4">
              <SettingSwitchRow
                title="Ekran włączony w treningu"
                description="Nie pozwalaj telefonowi zasnąć podczas aktywnej sesji (wake lock)."
                value={keepAwakeEnabled}
                onValueChange={handleKeepAwakeToggle}
                disabled={loadingPrefs}
              />
            </View>
          </View>

          <View className="mt-5 border-t border-border pt-4">
            <SettingSwitchRow
              title="Autouzupełniaj z poprzedniego treningu"
              description="Podpowiedzi ciężaru i powtórzeń na formularzu ćwiczenia."
              value={autofillEnabled}
              onValueChange={handleAutofillToggle}
              disabled={loadingPrefs}
            />
          </View>

          <View className="mt-4 border-t border-border pt-4">
            <SettingSwitchRow
              title="Wibracje przy zapisie ćwiczenia"
              description={
                Platform.OS === "web"
                  ? "Wibracje działają tylko na iOS i Android."
                  : "Krótka wibracja po udanym zapisie serii."
              }
              value={hapticsEnabled}
              onValueChange={handleHapticsToggle}
              disabled={loadingPrefs || Platform.OS === "web"}
            />
          </View>
        </SettingsSection>

        <SettingsSection title="Backup JSON" icon={HardDrive} iconColor="#60a5fa">
          <Text className="text-text-muted text-xs leading-5 mb-4">
            Lokalna kopia planów i historii treningów (nie zastępuje Google Sheets). Import
            dodaje dane jako nowe — nic nie kasuje.
          </Text>
          <Button
            label="Eksportuj backup"
            icon={Download}
            variant="secondary"
            onPress={handleExportBackup}
            loading={exportingBackup}
            disabled={importingBackup}
            className="mb-3"
          />
          <Button
            label="Importuj backup"
            icon={Upload}
            variant="secondary"
            onPress={handleImportBackup}
            loading={importingBackup}
            disabled={exportingBackup || Platform.OS !== "web"}
          />
          {Platform.OS !== "web" ? (
            <Text className="text-text-muted text-xs mt-3 leading-5">
              Import pliku działa w wersji webowej. Na telefonie użyj eksportu (Udostępnij).
            </Text>
          ) : null}
          <Text className="text-text-secondary text-sm font-semibold mt-5 mb-2">
            Kontekst AI (30 dni)
          </Text>
          <Text className="text-text-muted text-xs mb-3 leading-5">
            Allowlista: profil, waga, trening, sen, dzień, forma, aktywności — bez całej bazy.
          </Text>
          <Button
            label="Eksport CSV pod AI"
            icon={FileSpreadsheet}
            variant="secondary"
            onPress={() => handleExportAiContext("csv")}
            loading={exportingAiContext}
            className="mb-3"
          />
          <Button
            label="Eksport JSON pod AI"
            icon={Download}
            variant="ghost"
            size="sm"
            onPress={() => handleExportAiContext("json")}
            loading={exportingAiContext}
          />
        </SettingsSection>

        <SettingsSection title="Integracje" icon={Sheet} iconColor="#22c55e">
          <Text className="text-text-primary text-sm font-semibold leading-tight">
            Synchronizacja z Google Sheets
          </Text>
          <Text className="text-text-muted text-xs mt-1 leading-5">
            Twój osobisty arkusz Jarvis — zakładka Silownia_import (testy osobiste).
          </Text>

          {supabaseProjectRef ? (
            <Text className="text-text-muted text-[10px] mt-2 leading-4">
              Projekt Supabase w tej aplikacji: {supabaseProjectRef}
              {projectMismatch
                ? ` (sync wdrożony na: ${syncTargetProjectRef})`
                : ""}
            </Text>
          ) : null}

          {showDeployBanner ? (
            <View className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-3">
              <Text className="text-danger text-xs leading-5">
                {projectMismatch
                  ? "Aplikacja łączy się z innym projektem Supabase. Ustaw EXPO_PUBLIC_SUPABASE_URL=https://vggkwwyjobfcokwtfljj.supabase.co i zrestartuj expo."
                  : `Edge Function sync-sheets nie odpowiada na projekcie ${supabaseProjectRef ?? "?"}. Uruchom: powershell -File supabase\\functions\\sync-sheets\\deploy.ps1`}
              </Text>
            </View>
          ) : null}

          <View className="mt-4 flex-row items-start">
            <SyncStatusIcon size={18} strokeWidth={ICON_STROKE} color={syncStatusColor} />
            <Text className="ml-2 flex-1 text-text-secondary text-sm leading-5">{syncStatusText}</Text>
          </View>

          {lastSyncResult?.ok && (lastSyncResult.updated != null || lastSyncResult.appended != null) ? (
            <Text className="text-text-muted text-xs mt-2 leading-5">
              Ostatnio: zaktualizowano {lastSyncResult.updated ?? 0}, dopisano{" "}
              {lastSyncResult.appended ?? 0} wierszy
              {lastSyncResult.days ? ` (${lastSyncResult.days} dni wstecz)` : ""}.
            </Text>
          ) : null}

          <Button
            label="Synchronizuj teraz"
            icon={RefreshCw}
            variant="secondary"
            onPress={handleSheetSync}
            loading={syncing}
            className="mt-4"
          />

          <Text className="text-text-muted text-xs mt-3 leading-5">
            Import z GitHub Actions nadal działa co godzinę. Ten przycisk przyspiesza sync po treningu —
            dane pojawią się w Gemie bez czekania.
          </Text>
        </SettingsSection>

        <SettingsSection title="Powiadomienia" icon={BellRing} iconColor="#60a5fa">
          <SettingSwitchRow
            title="Codzienne przypomnienie o treningu"
            description={
              Platform.OS === "web"
                ? "Powiadomienia nie są dostępne w wersji webowej."
                : "Zaplanowane codziennie o 9:00."
            }
            value={notifEnabled}
            onValueChange={handleNotifToggle}
            disabled={loadingPrefs || Platform.OS === "web"}
          />
          {Platform.OS === "web" ? (
            <StateBlock
              title="Tylko na urządzeniach mobilnych"
              description="Otwórz aplikację na iOS lub Android, aby włączyć przypomnienia."
              icon={Globe}
              className="mt-4"
            />
          ) : null}
        </SettingsSection>

        <SettingsSection title="Wygląd" icon={Palette} iconColor="#a78bfa">
          <Text className="text-text-muted text-xs mb-3">Motyw aplikacji</Text>
          <Pills
            options={[
              { value: "dark", label: "Ciemny" },
              { value: "light", label: "Jasny", disabled: true },
            ]}
            value="dark"
            onChange={() => {}}
          />
          <View className="mt-3 flex-row items-center">
            <Moon size={14} strokeWidth={ICON_STROKE} color="#7c8aa5" />
            <Text className="ml-2 text-text-muted text-xs">Jasny motyw — wkrótce</Text>
          </View>
        </SettingsSection>

        <SettingsSection title="O aplikacji" icon={Info} iconColor="#7c8aa5">
          <Text className="text-text-secondary text-sm">{APP_NAME}</Text>
          <Text className="text-text-muted text-xs mt-1">Wersja {APP_VERSION}</Text>
          <Text className="text-text-muted text-xs mt-3 leading-5">
            {APP_TAGLINE}. Backup JSON w Ustawieniach; CSV / OAuth Google — później.
          </Text>
        </SettingsSection>
      </ScrollView>

      {restPreview.timer ? (
        <RestTimerOverlay
          timer={restPreview.timer}
          onAdjust={restPreview.adjust}
          onDismiss={restPreview.dismiss}
          bottomOffset={64}
        />
      ) : null}
    </SafeAreaView>
  );
}
