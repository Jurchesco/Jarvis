# Pełny prompt audytu Jarvis — do wklejenia w mocniejszy model

**Jak użyć w Cursorze:** nowy chat → model Opus → wklej blok z sekcji „PROMPT” → dołącz `@docs/jarvis/GEM_INSTRUKCJA.md`, `@Scripts/import/jarvis_import/` itd.

**Jak użyć poza Cursorem (Gemini Advanced, ChatGPT):** wklej prompt + podaj link do repo: https://github.com/Jurchesco/jj-workout-tool — poproś model o przejrzenie kodu z GitHub (jeśli ma dostęp) lub wklej ręcznie kluczowe pliki.

---

## PROMPT — skopiuj wszystko poniżej

---

Jesteś seniorem ds. inżynierii danych, analityki sportowej (siłownia, cardio strefa 2, regeneracja) i architektury systemów. Przeprowadź **niezależny, krytyczny audyt** osobistego ekosystemu **Jarvis** — od źródeł danych przez pipeline importu do Google Sheets i Gemini Gema („Trener AI”).

**Nie przyjmuj niczego za pewnik z poniższego opisu** — zweryfikuj każdą tezę w kodzie źródłowym. Jeśli wcześniejszy audyt wskazywał potencjalne bugi, potwierdź je lub obal na podstawie kodu.

---

## KONTEKST PROJEKTU

### Cel użytkownika
Osobisty ekosystem do śledzenia treningu i zdrowia. **Główny konsument danych to Gemini Gem** podpięty do arkusza Google Sheets — ma analizować regenerację, progres siłowy, cardio i masę ciała oraz dawać konkretne rekomendacje treningowe oparte na liczbach.

### Architektura (docelowa)

```
JJ Workout Tool (Expo app) → Supabase Postgres → importer Python → Google Sheets → Gemini Gem
Garmin Connect     → importer Python  ↗
openScale backup   → importer Python  ↗
```

### Repozytorium
- **GitHub:** https://github.com/Jurchesco/jj-workout-tool (branch `main`)
- **Import Python:** `Scripts/import/jarvis_import/`
- **Aplikacja JJ Workout Tool:** `apps/mobile/`, `supabase/schema.sql`
- **Workflow CI:** `.github/workflows/jarvis-import.yml`
- **Instrukcja Gema:** `docs/jarvis/GEM_INSTRUKCJA.md`

### Google Sheet
- Tytuł: **„Dziennik Treningowy – Trener AI”**
- Zakładki: **Sen**, **Dzien**, **Forma**, **Aktywnosci**, **Cialo**, **Silownia_import**, **Baza_Suplementow**
- Brak (na razie): **Samopoczucie**, **Suplementy** (dziennik dzienny), **Meta** (log importów)

### Konfiguracja operacyjna
| Parametr | Wartość |
|----------|---------|
| Harmonogram CI | co godzinę (`cron: 0 * * * *`) |
| DEFAULT_DAYS (scheduled) | 1 |
| IMPORT_START_DATE | 2026-07-09 |
| TIMEZONE | Europe/Warsaw |
| Pełny import | `--all` lub checkbox `import_all` w workflow |

### Źródła danych użytkownika
- **Garmin Forerunner 165** — sen, dzienne statystyki, forma/gotowość, aktywności (cardio, bieganie, profil siłowy z zegarka)
- **JJ Workout Tool** — szczegółowy log serii siłowych (ćwiczenie, ciężar, powtórzenia, notatki)
- **Xiaomi waga + openScale** — masa i estymowany skład ciała (BIA)
- **Baza_Suplementow** — statyczna referencja produktów (nie dziennik przyjmowania)

### Profil treningowy użytkownika (kontekst dla Gema)
- Siłownia: logowanie serii w JJ Workout Tool; progres siłowy to priorytet analityczny
- Cardio: strefa 2 (orbitrek, rower, bieżnia), bieganie rekreacyjne — bez presji na rekordy
- Cel Gema: odpowiedź „trenować ciężko / lekko / odpocząć dziś” na podstawie danych

---

## ZAKRES AUDYTU — co przeanalizuj

### 1. Pipeline importu (`Scripts/import/jarvis_import/`)

Moduły (kolejność CLI): `sen`, `dzien`, `forma`, `aktywnosci`, `cialo`, `silownia`

Przeanalizuj każdy plik:
- `cli.py`, `config.py`, `dates.py`, `sheets.py`, `garmin.py`
- `importers/sleep.py`, `daily.py`, `forma.py`, `activities.py`, `openscale.py`, `workout.py`

Dla każdego modułu ustal:
1. Pełną listę kolumn zapisywanych do arkusza (nazwa, typ, jednostki)
2. Klucz upsert (jak identyfikowany jest wiersz)
3. Obsługę timezone (`Europe/Warsaw`, `Data importu`, `Data pomiaru`)
4. Soft skip vs hard fail
5. Rate limiting / batch update (429 Google Sheets)
6. Czy nagłówki są wymuszane w kodzie

### 2. Google Sheets — jakość danych per zakładka

| Zakładka | Źródło | Kluczowa kolumna daty |
|----------|--------|----------------------|
| Sen | Garmin | Data importu (dzień metryki + czas sync) |
| Dzien | Garmin | Data importu |
| Forma | Garmin | Data importu |
| Aktywnosci | Garmin | Data startu |
| Cialo | openScale | Data pomiaru |
| Silownia_import | JJ-Workout-Tool/Supabase | Data (start sesji) |

Oceń: spójność typów (liczba vs tekst), placeholdery (`brak danych`), luki czasowe, opóźnienie importu (~1 h), duplikaty.

### 3. JJ Workout Tool + Supabase

Przeanalizuj `supabase/schema.sql` i `importers/workout.py` oraz UI aplikacji (`apps/mobile/app/workout/[id].tsx`, `apps/mobile/src/api/client.ts`).

Ustal:
- Mapowanie tabel → kolumny `Silownia_import`
- Co jest w bazie, ale **nie trafia** do arkusza
- Semantykę kolumn `PR`, `Bol / Niggle`, `Uwagi`, `Est. 1RM`, `Volume`, `Czas serii`
- Ryzyko `service_role` bez filtra `user_id`
- Czy niekompletne sesje (`completed_at IS NULL`) trafiają do eksportu
- Czy w aplikacji jest UI na notatki sesji vs notatki ćwiczenia

### 4. Garmin

- Nieoficjalne API (`garminconnect`) — tokeny, CI
- Limit paginacji aktywności (~1000)
- Potencjalne bugi timezone (szczególnie `sleep.py` i pola `*Local` vs `*GMT`)
- Pole `minAvgHeartRate` w `daily.py` — czy to właściwa metryka dla „Tętno średnie”

### 5. Instrukcja Gema (`docs/jarvis/GEM_INSTRUKCJA.md`)

Porównaj **linijka po linijce** z kodem importerów:
- Opis kolumn vs rzeczywiste dane
- Reguły PR, Bol/Niggle, Uwagi
- Reguły trendów (7–14 dni)
- Brakujące zakładki i opóźnienie synchronizacji
- Czy instrukcja wystarczy, by Gem poprawnie odpowiedział na: „czy dziś trenować ciężko?”

### 6. Brakujące dane dla lepszego wsparcia Gema

Oceń lukę dla pytań:
- Regeneracja dziś → trenować czy odpocząć?
- Masa rośnie → siła czy tłuszcz?
- Cardio Z2 vs obciążenie tygodniowe siłowni
- Ból vs RPE w notatkach
- Suplementacja a sen/HRV (brak dziennego logu)
- Subiektywne samopoczucie (brak zakładki)

---

## HIPOTEZY DO WERYFIKACJI (potwierdź lub obal w kodzie)

Poprzedni wstępny audyt wskazywał — **zweryfikuj niezależnie**:

1. **`sleep.py`** — `datetime.utcfromtimestamp()` na polach `sleepStartTimestampLocal` / `sleepEndTimestampLocal` → błędne godziny snu względem Warszawy
2. **`workout.py`** — PR liczone po max **ciężarze**, podczas gdy Gem mówi o rekordzie **Est. 1RM (Brzycki)**
3. **`workout.py`** — kolumna `Bol / Niggle` dostaje notatki ćwiczenia (w appce placeholder: „RPE, wskazówki, ustawienie”), nie wyłącznie ból
4. **`workout.py`** — `Uwagi` = notatka sesji powielona na każdej serii; brak UI do wpisywania notatek sesji
5. **`activities.py`** — brak filtra `activity_date <= end_date`
6. **`config.py`** — `date.today()` bez timezone → na CI (UTC) „dziś” może być inne niż w Polsce w nocy
7. **`daily.py`** — `minAvgHeartRate` używane jako „Tętno średnie” — czy to właściwe pole Garmin
8. **Brak filtra `user_id`** w importerz JJ Workout Tool przy service_role
9. **Limit 1000 aktywności** — utrata starszego cardio przy `--all`
10. **`DEFAULT_DAYS=1`** — luki przy pominiętym hourly run

---

## METODOLOGIA

1. Przeczytaj kod — nie opieraj się tylko na dokumentacji.
2. Zidentyfikuj niespójności: **dokumentacja ↔ kod ↔ instrukcja Gema ↔ UX aplikacji**.
3. Każdą lukę oceń: wpływ na Gema (**Wysoki / Średni / Niski**).
4. Priorytetyzuj: **maksymalna wartość dla Gema przy minimalnym diff**.
5. Rozróżniaj: bug danych vs brak funkcji vs problem instrukcji vs tech debt operacyjny.

---

## FORMAT ODPOWIEDZI (obowiązkowy)

### A. Executive summary
Max 10 zdań. Stan ekosystemu, 3 najważniejsze ryzyka, 3 najszybsze poprawki.

### B. Mapa danych
Diagram mermaid lub ASCII: źródło → moduł → zakładka → kluczowe kolumny → Gem.

### C. Audyt per zakładka
Tabela: **Zakładka | Jakość (1–5) | Problemy | Rekomendacja**.

### D. Audyt kodu
Lista bugów i tech debt z priorytetem (P0/P1/P2), pliki, proponowana poprawka (konkretna).

### E. Audyt instrukcji Gema
Rozbieżności + **gotowe fragmenty tekstu** do wklejenia w Gem (tymczasowe obejścia do czasu fixa kodu).

### F. Plan rozwoju (roadmap)
Fazy 0–4 z zadaniami: opis, pliki, kryterium „done”, wysiłek (dni), wpływ na Gema.

- **Faza 0** — quick wins (≤3 dni, bez nowych funkcji)
- **Faza 1** — spójność semantyczna kolumn i eksportu
- **Faza 2** — nowe zakładki (Samopoczucie, Suplementy, Meta)
- **Faza 3** — JJ Workout Tool (RPE, user filter, richer export)
- **Faza 4** — operacje (monitoring, alerty, reconcile)

### G. Checklist weryfikacji
Konkretne testy po wdrożeniu (komendy CLI, porównania z Garmin Connect, scenariusze Gema).

### H. Pytania do właściciela
Max 5 pytań — tylko te, których nie da się rozstrzygnąć z kodu (np. dostęp do live arkusza).

---

## ZASADY

- Pisz **po polsku**.
- Bądź **konkretny**: ścieżki plików, numery linii (jeśli możliwe), nazwy kolumn.
- **Nie over-engineeruj** — użytkownik to student, preferuje proste, działające rozwiązania.
- W roadmapie wyróżnij **TOP 5 zadań** do zrobienia w pierwszej kolejności z uzasadnieniem ROI dla Gema.
- Jeśli coś działa dobrze — powiedz wprost (nie tylko krytyka).

---

## PLIKI DO PRZECZYTANIA (priorytet)

**Must-read:**
- `docs/jarvis/GEM_INSTRUKCJA.md`
- `Scripts/import/jarvis_import/importers/sleep.py`
- `Scripts/import/jarvis_import/importers/daily.py`
- `Scripts/import/jarvis_import/importers/forma.py`
- `Scripts/import/jarvis_import/importers/activities.py`
- `Scripts/import/jarvis_import/importers/openscale.py`
- `Scripts/import/jarvis_import/importers/workout.py`
- `Scripts/import/jarvis_import/config.py`
- `Scripts/import/jarvis_import/dates.py`
- `Scripts/import/jarvis_import/sheets.py`
- `.github/workflows/jarvis-import.yml`
- `supabase/schema.sql`
- `apps/mobile/app/workout/[id].tsx`
- `apps/mobile/src/api/client.ts`

**Nice-to-have:**
- `docs/jj-workout-tool/ARCHITECTURE.md`
- `Scripts/import/README.md`
- `apps/mobile/app/sheet/[id].tsx`
- `packages/shared/src/index.ts`

---

**Zacznij od przeczytania `docs/jarvis/GEM_INSTRUKCJA.md` i `importers/workout.py`, potem przejdź moduł po module. Na końcu zsyntetyzuj roadmapę z naciskiem na jakość danych dla Gema.**

---

## Koniec promptu

---

## W Cursorze — dołącz te pliki (@)

```
@docs/jarvis/GEM_INSTRUKCJA.md
@Scripts/import/jarvis_import/
@.github/workflows/jarvis-import.yml
@supabase/schema.sql
@apps/mobile/app/workout/[id].tsx
@apps/mobile/src/api/client.ts
```

Opcjonalnie cały folder: `@c:\Jarvis\JJ-Workout-Tool`
