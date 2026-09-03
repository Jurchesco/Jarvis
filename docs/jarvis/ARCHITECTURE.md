# Architektura ekosystemu Jarvis

Dokumentacja po polsku — przepływ danych od źródeł do Gemini Gema.

Aplikacja JJ Workout Tool (EN): [../jj-workout-tool/ARCHITECTURE.md](../jj-workout-tool/ARCHITECTURE.md)

---

## Cel systemu

Jarvis łączy trzy źródła danych w jeden arkusz Google Sheets („Dziennik Treningowy – Trener AI”), który służy Gemini Gemowi jako baza analizy:

1. **Treningi siłowe** — JJ Workout Tool (Supabase)
2. **Aktywność i zdrowie** — Garmin Connect
3. **Skład ciała** — openScale (auto backup)

---

## Przepływ danych

```
Garmin Connect  ──→  jarvis_import (sen, dzien, forma, aktywnosci)  ──→  Google Sheets
openScale       ──→  jarvis_import (cialo)                          ──→  Google Sheets
JJ-Workout-Tool/Supabase ──→  jarvis_import (silownia)                       ──→  Google Sheets
                                                                              ↓
                                                                        Gemini Gem
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
jj-workout-tool/                    # repo GitHub (Jurchesco/jj-workout-tool)
├── apps/mobile/            # Expo — logowanie treningów
├── packages/shared/        # Typy TypeScript
├── supabase/               # Schemat Postgres + RLS
├── Scripts/import/         # Importer Python (jarvis_import)
├── .github/workflows/      # jarvis-import.yml
└── docs/
    ├── README.md           ← indeks dokumentacji
    ├── jarvis/             ← ekosystem (PL): ten plik, SETUP, Gem, plan
    ├── jj-workout-tool/            ← aplikacja (EN): ARCHITECTURE, TODO, …
    └── audit/              ← prompt i archiwum audytu
```

---

## Warstwa analityczna (Gem)

Gem analizuje trendy 7–14 dni, łączy Forma + Sen + Dzien, progres siłowy z **Silownia_import** (nie z Garmina).

Instrukcja systemowa Gema (profil + szablon 6 sekcji; źródło Hermes `jarvis-trener`): [GEM_INSTRUKCJA.md](./GEM_INSTRUKCJA.md)

Plan naprawczy (audyt → kolejne kroki): [PLAN_NAPRAWCZY.md](./PLAN_NAPRAWCZY.md)

---

## Lokalny folder `c:\Jarvis\` (opcjonalnie)

Możesz trzymać clone repo w `c:\Jarvis\JJ-Workout-Tool\` — to jedyny katalog z kodem i gitem. Folder `c:\Jarvis\` może zawierać tylko krótki README wskazujący na `JJ-Workout-Tool/`.

---

## Roadmapa

[../jj-workout-tool/TODO.md](../jj-workout-tool/TODO.md) · [../jj-workout-tool/DECISIONS.md](../jj-workout-tool/DECISIONS.md)
