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
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  Dumbbell,
  Globe,
  Info,
  LogOut,
  Moon,
  Palette,
  RefreshCw,
  Settings2,
  Sheet,
  User,
} from "lucide-react-native";
import { APP_NAME, APP_TAGLINE, APP_VERSION } from "../../../src/constants/branding";
import { useAuth } from "../../../src/contexts/AuthContext";
import {
  DEFAULT_REST_OPTIONS,
  getAutofillPrevious,
  getDefaultRestSec,
  getHapticsEnabled,
  setAutofillPrevious,
  setDefaultRestSec,
  setHapticsEnabled,
  type DefaultRestSec,
} from "../../../src/lib/appPreferences";
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
  const { user, signOut } = useAuth();
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const [autofillEnabled, setAutofillEnabled] = useState(true);
  const [defaultRestSec, setDefaultRestSecState] = useState<DefaultRestSec>(60);
  const [signingOut, setSigningOut] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SheetSyncResult | null>(null);

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
      refreshSyncStatus(),
    ]).then(([notif, haptics, autofill, restSec]) => {
      setNotifEnabled(notif);
      setHapticsEnabledState(haptics);
      setAutofillEnabled(autofill);
      setDefaultRestSecState(restSec);
      setLoadingPrefs(false);
    });
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

  const handleRestChange = async (value: string) => {
    const sec = parseInt(value, 10) as DefaultRestSec;
    setDefaultRestSecState(sec);
    await setDefaultRestSec(sec);
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

        <SettingsSection title="Trening" icon={Dumbbell} iconColor="#22c55e">
          <Text className="text-text-secondary text-sm font-semibold mb-2">
            Domyślny czas odpoczynku
          </Text>
          <Text className="text-text-muted text-xs mb-3 leading-5">
            Używany, gdy timer odpoczynku wróci do aplikacji.
          </Text>
          <Pills
            options={DEFAULT_REST_OPTIONS.map((sec) => ({
              value: String(sec),
              label: `${sec}s`,
            }))}
            value={String(defaultRestSec)}
            onChange={handleRestChange}
          />

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
            {APP_TAGLINE}. Eksport CSV / logowanie Google — w kolejnych wersjach.
          </Text>
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}
