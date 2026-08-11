# Prompt audytu ekosystemu Jarvis (dla mocniejszego modelu)

Skopiuj sekcję **PROMPT** poniżej do nowej rozmowy z modelem analitycznym (np. Claude Opus, GPT o1). Dołącz kontekst z sekcji **Kontekst do dołączenia** oraz — jeśli możliwe — link do repozytorium i arkusza.

---

## Kontekst do dołączenia

| Element | Wartość |
|---------|---------|
| Repo GitHub | https://github.com/Jurchesco/stravio (branch `main`) |
| Lokalna kopia ekosystemu | `c:\Jarvis\` (root) + `c:\Jarvis\Stravio\` (app + import w repo) |
| Google Sheet | „Dziennik Treningowy – Trener AI” |
| Gem Gemini | https://gemini.google.com/gem/1GGSIQ4LI9qeI--maonjHMaZAvjz6JO0H |
| Instrukcja Gema | `docs/GEM_INSTRUKCJA.md` |
| Import Python | `Scripts/import/jarvis_import/` |
| Workflow CI | `.github/workflows/jarvis-import.yml` (co godzinę, `DEFAULT_DAYS=1`) |
| Start danych Garmin | `2026-07-09` (`IMPORT_START_DATE`) |
| Strefa czasowa | `Europe/Warsaw` |
| Zakładki arkusza | Sen, Dzien, Forma, Aktywnosci, Cialo, Silownia_import, Baza_Suplementow (+ ewent. legacy Silownia) |

**Priorytet audytu:** jakość, spójność i kompletność danych w Google Sheets oraz instrukcji Gema — tak, aby Gem mógł wiarygodnie analizować regenerację, trening siłowy, cardio i masę ciała oraz dawać konkretne rekomendacje oparte na liczbach.

---

## PROMPT (skopiuj od tej linii)

```
Jesteś seniorem ds. inżynierii danych, analityki sportowej i architektury systemów. Przeprowadź kompleksowy audyt osobistego ekosystemu „Jarvis” — pipeline danych od źródeł (Garmin Connect, Stravio/Supabase, openScale) przez importer Python do Google Sheets, a następnie do Gemini Gema („Trener AI”).

## Cel audytu

Główny cel: **Gem ma jak najlepsze dane do analizy i wsparcia treningowego/regeneracyjnego**. Oceń cały łańcuch: źródło → transformacja → arkusz → instrukcja Gema → realne użycie. Wskaż luki, niespójności, błędy semantyczne i ryzyka jakości danych.

## Zakres — co przeanalizuj

### 1. Pipeline importu (`Scripts/import/jarvis_import/`)
- Moduły: sen, dzien, forma, aktywnosci, cialo, silownia (Stravio)
- CLI: `--days`, `--all`, `--skip`, `--no-prompt`
- Upsert, klucze wierszy, batch update (429), soft skip vs hard fail
- Timezone (`Europe/Warsaw`), `format_day_with_time`, `Data importu` vs dzień metryki
- GitHub Actions: harmonogram co godzinę, `DEFAULT_DAYS=1`, sekrety, timeout 360 min

### 2. Google Sheets — struktura i jakość danych
Dla każdej zakładki (Sen, Dzien, Forma, Aktywnosci, Cialo, Silownia_import):
- Pełna lista kolumn: nazwa, typ danych (liczba / tekst / datetime), jednostki, spójność
- Klucz upsert / identyfikacja wiersza
- Czy nagłówki są wymuszane w kodzie czy zakładane ręcznie
- Wartości placeholder (`brak danych`, puste komórki) — wpływ na Gema
- Mieszane formaty (np. `"5h 30m"` vs surowe minuty) — czy utrudniają analizę
- Duplikaty, luki czasowe, opóźnienie importu (do ~1 h)

### 3. Stravio + Supabase (`supabase/schema.sql`, `importers/stravio.py`)
- Jakie pola z bazy trafiają do arkusza, a jakie NIE
- PR: czy logika w kodzie (max ciężar) zgadza się z instrukcją Gema (Est. 1RM / Brzycki)
- Kolumny `Bol / Niggle` vs `Uwagi` — semantyka vs rzeczywiste użycie w aplikacji (notatki RPE, ustawienie maszyny)
- Brak filtra `user_id` przy service_role — ryzyko wieloużytkownikowe
- Brak eksportu: `completed_at` sesji, `rest_time_sec`, szablon `exercise_sets`

### 4. Garmin (`garmin.py`, importery sleep/daily/forma/activities)
- Nieoficjalne API — tokeny, odporność CI
- Limit ~1000 aktywności — wpływ na historyczne cardio
- Potencjalne błędy timezone w sleep (UTC vs Local)
- Brak walidacji nagłówków vs kod zapisu kolumn

### 5. openScale (`openscale.py`, `openscale_source.py`)
- Migracja starego układu kolumn
- BIA estymacje — jak Gem powinien je interpretować
- Częstotliwość ważeń vs wiarygodność trendów

### 6. Instrukcja Gema (`docs/GEM_INSTRUKCJA.md`)
- Zgodność opisu kolumn z rzeczywistością kodu i arkusza
- Czy reguły interpretacji (7–14 dni trend, łączenie Forma+Sen+Dzien) są wystarczające
- Brakujące zakładki: Samopoczucie, Suplementy (dziennik), Meta (log importów)
- Czy Gem wie o opóźnieniu danych, PR=max weight, duplikacji Uwagi na każdej serii

### 7. Brakujące dane dla lepszego wsparcia Gema
Oceń, czego brakuje do odpowiedzi typu:
- „Czy dziś trenować ciężko / lekko / odpocząć?”
- „Czy masa rośnie z siłą czy z tłuszczu?”
- „Czy cardio Z2 nie koliduje z regeneracją?”
- „Czy bol/niggle wymaga redukcji objętości?”

## Metodologia

1. Przeczytaj kod importerów i porównaj z `GEM_INSTRUKCJA.md`.
2. Zidentyfikuj **niespójności dokumentacja ↔ kod ↔ arkusz**.
3. Oceń każdą lukę: wpływ na Gema (Wysoki / Średni / Niski).
4. Zaproponuj poprawki: quick wins (≤1 dzień), średni termin (1–2 tygodnie), długi termin (roadmap).

## Format odpowiedzi

### A. Executive summary (max 10 zdań)
Stan ekosystemu i najważniejsze ryzyka dla jakości danych Gema.

### B. Mapa danych (diagram tekstowy lub mermaid)
Źródło → moduł → zakładka → kolumny kluczowe → Gem.

### C. Audyt per zakładka
Tabela: Zakładka | Jakość danych (1–5) | Problemy | Rekomendacja.

### D. Audyt kodu importu
Lista bugów / tech debt z priorytetem i proponowaną poprawką (konkretny plik/funkcja).

### E. Audyt instrukcji Gema
Lista rozbieżności + proponowane poprawki tekstu (gotowe fragmenty do wklejenia).

### F. Plan rozwoju (roadmap)
Fazy z celami, zadaniami, szacunkiem wysiłku i oczekiwanym wpływem na Gema:

**Faza 0 — Quick wins (jakość danych bez nowych funkcji)**
**Faza 1 — Spójność semantyczna (kolumny, PR, notatki)**
**Faza 2 — Nowe źródła danych (Samopoczucie, Suplementy, Meta)**
**Faza 3 — Stravio v2 (RPE, user filter, richer export)**
**Faza 4 — Operacje (monitoring, backfill, alerty)**

Dla każdego zadania podaj: opis, pliki do zmiany, kryterium „done”, wpływ na Gema.

### G. Checklist weryfikacji po wdrożeniu
Konkretne testy (np. „import `--days 7`”, „porównaj ostatni wiersz Sen z Garmin Connect”, „Gem podaje datę ostatniego treningu siłowego”).

## Zasady

- Pisz po polsku.
- Bądź konkretny: daty, nazwy kolumn, ścieżki plików.
- Nie proponuj over-engineeringu — priorytet: więcej wartości dla Gema przy minimalnym diff.
- Rozróżniaj: błąd danych vs brak funkcji vs problem instrukcji Gema.
- Jeśli czegoś nie możesz zweryfikować bez dostępu do arkusza — wypisz pytania do właściciela (1–5 konkretnych).

Zacznij od przeglądu repozytorium i pliku `docs/GEM_INSTRUKCJA.md`, następnie przejdź do audytu moduł po module.
```

---

## Plan rozwoju — wersja robocza (do weryfikacji przez audyt)

Poniższy plan możesz przekazać audytorowi jako punkt wyjścia lub użyć samodzielnie po audycie.

### Faza 0 — Quick wins (1–3 dni)

| # | Zadanie | Wpływ na Gema |
|---|---------|---------------|
| 0.1 | Ujednolicić opis **PR** w Gemie z kodem (max ciężar) LUB zmienić kod na PR po Est. 1RM | Uniknięcie fałszywych wniosków o progresie |
| 0.2 | W Gemie doprecyzować: `Bol / Niggle` = notatki ćwiczenia (często RPE), `Uwagi` = notatka sesji (powielona) | Lepsza interpretacja bólu vs RPE |
| 0.3 | `DEFAULT_DAYS: 2` w workflow (bufor przy miss hourly) | Mniej luk w Sen/Dzien/Forma |
| 0.4 | Zakładka **Meta**: ostatni import per moduł, timezone, IMPORT_START_DATE | Gem wie, czy dane są świeże |
| 0.5 | Wymusić nagłówki w kodzie dla Sen/Dzien/Forma/Aktywnosci (jak Cialo) | Mniej błędów przy ręcznych edycjach |

### Faza 1 — Spójność semantyczna (1–2 tygodnie)

| # | Zadanie | Wpływ na Gema |
|---|---------|---------------|
| 1.1 | Rename kolumn exportu Stravio: `Notatki cwiczenia`, `Notatki sesji` (+ migracja arkusza) | Zero dwuznaczności |
| 1.2 | `SUPABASE_USER_ID` w importerze | Tylko Twoje treningi |
| 1.3 | Surowe liczby w Sen zamiast `"5h 30m"` (format arkusza opcjonalnie) | Gem liczy trendy łatwiej |
| 1.4 | Kolumna `Data importu` w Silownia_import i Aktywnosci | Traceability |
| 1.5 | Poprawka timezone w `sleep.py` jeśli potwierdzony bug | Poprawne godziny snu |

### Faza 2 — Nowe dane subiektywne (2–4 tygodnie)

| # | Zadanie | Wpływ na Gema |
|---|---------|---------------|
| 2.1 | Zakładka **Samopoczucie** (energia, nastrój, DOMS 1–5, ręcznie lub Google Form → Sheets) | Kontekst poza Garmin |
| 2.2 | Zakładka **Suplementy** (dzienny log: produkt, dawka, godzina) + link do Baza_Suplementow | Korelacje z snem/HRV |
| 2.3 | Instrukcja Gema — sekcje dla nowych zakładek | Gem wie jak czytać |

### Faza 3 — Stravio + export (1–2 miesiące)

| # | Zadanie | Wpływ na Gema |
|---|---------|---------------|
| 3.1 | Pole **RPE** per seria w aplikacji + export | Objętość efektywna, autoregulacja |
| 3.2 | Export `completed_at`, czas trwania sesji | Obciążenie tygodniowe |
| 3.3 | Opcjonalnie: RIR, tempo, typ serii (warm-up / working) | Precyzyjniejsza analiza siły |

### Faza 4 — Operacje i niezawodność

| # | Zadanie | Wpływ na Gema |
|---|---------|---------------|
| 4.1 | Cotygodniowy workflow `--days 14` reconcile | Spójność historyczna |
| 4.2 | Alert (mail/Discord) gdy import fail | Gem nie pracuje na starych danych |
| 4.3 | Konsolidacja `Silownia` vs `Silownia_import` | Jedno źródło prawdy |
| 4.4 | Jedno repo / sync Jarvis ↔ Stravio | Mniej rozjazdów kodu |

---

## Jak uruchomić audyt w Cursorze

1. Otwórz folder `c:\Jarvis\Stravio` (lub cały `c:\Jarvis`).
2. Nowy chat z mocniejszym modelem (Plan lub Agent).
3. Wklej **PROMPT** + dołącz `@docs/GEM_INSTRUKCJA.md`, `@Scripts/import/`, `@.github/workflows/jarvis-import.yml`, `@supabase/schema.sql`.
4. Opcjonalnie: `@docs/ARCHITECTURE.md`, `@docs/AUDYT_PROMPT.md`.
5. Poproś o wynik w formacie A–G z promptu.

---

*Ostatnia aktualizacja: 2026-08-11*
