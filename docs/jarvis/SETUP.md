# Konfiguracja ekosystemu Jarvis

Instrukcja krok po kroku dla nowego środowiska deweloperskiego.

> Repozytorium: clone `https://github.com/Jurchesco/stravio` — wszystkie ścieżki poniżej są względem roota repo.

---

## 1. Stravio — aplikacja treningowa

### Wymagania

- Node.js 18+
- npm 9+
- Konto [Supabase](https://supabase.com) (darmowy tier wystarczy)

### Kroki

```bash
npm install
```

**Konfiguracja Supabase:**

1. Utwórz nowy projekt na supabase.com
2. W SQL Editor wklej i uruchom `supabase/schema.sql`
3. W Authentication → Providers → Email → wyłącz „Confirm email”
4. Skopiuj URL projektu i klucz publishable (Settings → API)

**Plik `.env`:**

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Edytuj `apps/mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://TWOJ_PROJEKT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=twój_klucz_publishable
```

**Uruchomienie:**

```bash
npm run web -w apps/mobile     # Web: http://localhost:8081
npm run dev -w apps/mobile     # Expo Go / emulator
```

**Build APK (opcjonalnie):**

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

---

## 2. Import danych (`Scripts/import`)

Jeden folder, jeden skrypt — Garmin, openScale i Stravio.

### Wymagania

- Python 3.10+
- Konto Garmin Connect
- Google Cloud Service Account z dostępem do Google Sheets API
- (Opcjonalnie) Klucz `service_role` Supabase — moduł `silownia`
- (Opcjonalnie) Auto backup openScale (`.zip` / `.db`) lub `OPENSCALE_DRIVE_FILE_ID` — moduł `cialo`

### Instalacja

```bash
cd Scripts/import
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

### Konfiguracja `.env`

| Zmienna | Wymagana | Opis |
|---------|----------|------|
| `GOOGLE_SHEET_ID` | tak | ID arkusza Google Sheets |
| `SUPABASE_URL` | dla silownia | URL projektu Supabase |
| `SUPABASE_SECRET_KEY` | dla silownia | Klucz `service_role` (nie `anon`!) |
| `OPENSCALE_BACKUP` | dla cialo | Ścieżka do auto backupu openScale (`.zip` lub `.db`) |
| `DEFAULT_DAYS` | nie | Domyślna liczba dni w prompcie (domyślnie 7) |

**Google Service Account:**

1. W [Google Cloud Console](https://console.cloud.google.com) utwórz projekt
2. Włącz Google Sheets API i Google Drive API
3. Utwórz Service Account → pobierz klucz JSON
4. Zapisz jako `Scripts/import/google-service-account.json`
5. Udostępnij arkusz Google Sheets na email Service Account (rola: Editor)

### Uruchomienie

```bash
run.bat                        # pyta ile dni wstecz
run.bat --days 14              # bez pytania, 14 dni
run.bat --no-prompt --days 7   # harmonogram zadań (bez promptu)
run.bat --only sen,dzien,forma,aktywnosci   # tylko Garmin
run.bat --skip silownia,cialo               # bez Stravio i openScale
```

### Pliki w folderze `import/`

| Plik | Opis |
|------|------|
| `run.bat` | Główny skrypt uruchomieniowy |
| `.env` | Konfiguracja |
| `google-service-account.json` | Klucz Google (nie commituj!) |
| `.garminconnect/` | Tokeny Garmin (tworzone przy pierwszym logowaniu) |
| `jarvis_import/` | Kod Pythona |

**Pierwsze logowanie Garmin:** przy pierwszym uruchomieniu modułu Garmin skrypt poprosi o login i hasło. Tokeny zapiszą się w `.garminconnect/`.

**Automatyzacja (Harmonogram zadań Windows):**

```
Scripts\import\run.bat --no-prompt --days 7
```

Szczegóły: [Scripts/import/README.md](../Scripts/import/README.md)

---

## 3. Google Sheets — struktura arkusza

| Zakładka | Moduł | Zawartość |
|----------|-------|-----------|
| `Sen` | sen | Sen, fazy, HRV, Body Battery |
| `Dzien` | dzien | Kroki, kalorie, stres, SpO2 |
| `Forma` | forma | Panel gotowości (HRV, RHR, stres) |
| `Aktywnosci` | aktywnosci | Treningi cardio |
| `Cialo` | cialo | Waga, BMI, skład ciała — **Data pomiaru** |
| `Silownia_import` | silownia | Serie siłowe ze Stravio |

---

## 4. Automatyczny import (GitHub Actions)

Szczegółowa instrukcja: [GITHUB_ACTIONS.md](./GITHUB_ACTIONS.md)

---

## Rozwiązywanie problemów

Patrz też [Scripts/import/README.md](../Scripts/import/README.md).

### Stravio (aplikacja): biały ekran na web

Sprawdź `apps/mobile/.env` — klucze Supabase muszą być ustawione.

### Moduł silownia: „Brak zalogowanych serii”

To `[SKIP]`, nie błąd krytyczny. Sprawdź treningi w Stravio, klucz `service_role` i zakres `--days`.
