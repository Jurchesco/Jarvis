# Architektura ekosystemu Jarvis

Dokumentacja po polsku — przepływ danych od źródeł do Gemini Gema.

Aplikacja Stravio (EN): [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Cel systemu

Jarvis łączy trzy źródła danych w jeden arkusz Google Sheets („Dziennik Treningowy – Trener AI”), który służy Gemini Gemowi jako baza analizy:

1. **Treningi siłowe** — Stravio (Supabase)
2. **Aktywność i zdrowie** — Garmin Connect
3. **Skład ciała** — openScale (auto backup)

---

## Przepływ danych

```
Garmin Connect  ──→  jarvis_import (sen, dzien, forma, aktywnosci)  ──→  Google Sheets
openScale       ──→  jarvis_import (cialo)                          ──→  Google Sheets
Stravio/Supabase ──→  jarvis_import (silownia)                       ──→  Google Sheets
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
stravio/                    # repo GitHub (Jurchesco/stravio)
├── apps/mobile/            # Expo — logowanie treningów
├── packages/shared/        # Typy TypeScript
├── supabase/               # Schemat Postgres + RLS
├── Scripts/import/         # Importer Python (jarvis_import)
├── .github/workflows/      # jarvis-import.yml
└── docs/                   # Dokumentacja (PL + EN)
    ├── JARVIS_ARCHITECTURE.md   ← ten plik
    ├── JARVIS_SETUP.md
    ├── GEM_INSTRUKCJA.md
    └── ARCHITECTURE.md     ← architektura aplikacji (EN)
```

---

## Warstwa analityczna (Gem)

Gem analizuje trendy 7–14 dni, łączy Forma + Sen + Dzien, progres siłowy z **Silownia_import** (nie z Garmina).

Instrukcja systemowa Gema: [GEM_INSTRUKCJA.md](./GEM_INSTRUKCJA.md)

---

## Lokalny folder `c:\Jarvis\` (opcjonalnie)

Możesz trzymać clone repo w `c:\Jarvis\Stravio\` — to jedyny katalog z kodem i gitem. Folder `c:\Jarvis\` może zawierać tylko krótki README wskazujący na `Stravio/`.

---

## Roadmapa

[TODO.md](./TODO.md) · [DECISIONS.md](./DECISIONS.md)
