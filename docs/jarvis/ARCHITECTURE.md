# Architektura ekosystemu Jarvis

Dokumentacja po polsku — przepływ danych od źródeł do Hermesa (trener) i Gema (zapas).

Aplikacja JJ Workout Tool (EN): [../jj-workout-tool/ARCHITECTURE.md](../jj-workout-tool/ARCHITECTURE.md)

---

## Cel systemu

Jarvis łączy trzy źródła danych w jeden arkusz Google Sheets („Dziennik Treningowy – Trener AI”):

1. **Treningi siłowe** — JJ Workout Tool (Supabase) → `Silownia_import`
2. **Aktywność i zdrowie** — Garmin Connect
3. **Skład ciała** — openScale (auto backup)

**Trener (D017):** Hermes (`jarvis-trener`) prowadzi codzienną analizę; **Gem** = zapas + kanoniczne zasady w [GEM_INSTRUKCJA.md](./GEM_INSTRUKCJA.md).

**Apka web (kanon):** https://stravio-kappa.vercel.app/

---

## Przepływ danych

```
Garmin Connect  ──→  jarvis_import (sen, dzien, forma, aktywnosci)  ──→  Google Sheets
openScale       ──→  jarvis_import (cialo)                          ──→  Google Sheets
JJ-Workout-Tool/Supabase ──→  jarvis_import (silownia)              ──→  Google Sheets
                                                                              ↓
                                                                    Hermes (trener)
                                                                    Gem (zapas instrukcji)
```

| Moduł | Źródło | Zakładka |
|-------|--------|----------|
| `sen` | Garmin API | Sen |
| `dzien` | Garmin API | Dzien |
| `forma` | Garmin API | Forma |
| `aktywnosci` | Garmin API | Aktywnosci |
| `cialo` | openScale backup | Cialo |
| `silownia` | Supabase | Silownia_import |

**Import:** `Scripts/import/run.bat` — tryb przyrostowy (upsert), timezone `Europe/Warsaw`.

**CI:** GitHub Actions co godzinę — patrz [GITHUB_ACTIONS.md](./GITHUB_ACTIONS.md).

---

## Struktura repozytorium

```
Jarvis/                         # repo GitHub (Jurchesco/Jarvis); lokalnie często JJ-Workout-Tool/
├── apps/mobile/            # Expo — Freestyle + plany (/plans)
├── packages/shared/        # Typy + katalog + kalkulacje
├── supabase/               # Schemat Postgres + RLS + sync-sheets
├── Scripts/import/         # Importer Python (jarvis_import)
├── .github/workflows/      # jarvis-import.yml (cron, DEFAULT_DAYS=3)
└── docs/
    ├── README.md           ← indeks dokumentacji
    ├── jarvis/             ← ekosystem (PL): ten plik, SETUP, Gem, plan
    ├── jj-workout-tool/    ← aplikacja: ARCHITECTURE, DECISIONS, TODO, …
    └── audit/              ← prompt i archiwum audytu
```

---

## Warstwa analityczna (Hermes + Gem)

Hermes analizuje trendy 7–14 dni (cron ~22:30), łączy Forma + Sen + Dzien, progres siłowy z **Silownia_import** (nie z Garmina). Przed analizą ładuje GEM z `main`.

Instrukcja systemowa (plain-text: wniosek → 2–4 liczby → 2–3 punkty → plan): [GEM_INSTRUKCJA.md](./GEM_INSTRUKCJA.md)

Plan naprawczy (audyt → kolejne kroki): [PLAN_NAPRAWCZY.md](./PLAN_NAPRAWCZY.md)

---

## Lokalny folder `c:\Jarvis\` (opcjonalnie)

Możesz trzymać clone repo w `c:\Jarvis\JJ-Workout-Tool\` — to jedyny katalog z kodem i gitem. Folder `c:\Jarvis\` może zawierać tylko krótki README wskazujący na `JJ-Workout-Tool/`.

---

## Roadmapa

[../jj-workout-tool/TODO.md](../jj-workout-tool/TODO.md) · [../jj-workout-tool/DECISIONS.md](../jj-workout-tool/DECISIONS.md)
