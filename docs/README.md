# Dokumentacja

Indeks plików w `docs/`. Repozytorium łączy aplikację **Stravio** z ekosystemem **Jarvis** (import → Google Sheets → Gemini Gem).

---

## Jarvis — ekosystem (PL)

Pipeline danych, Gem, GitHub Actions, plan naprawczy po audycie.

| Plik | Opis |
|------|------|
| [jarvis/ARCHITECTURE.md](./jarvis/ARCHITECTURE.md) | Architektura: źródła → import → Sheets → Gem |
| [jarvis/SETUP.md](./jarvis/SETUP.md) | Konfiguracja krok po kroku |
| [jarvis/GITHUB_ACTIONS.md](./jarvis/GITHUB_ACTIONS.md) | Automatyczny import w chmurze |
| [jarvis/GEM_INSTRUKCJA.md](./jarvis/GEM_INSTRUKCJA.md) | Instrukcja systemowa Gema (Trener AI) |
| [**jarvis/PLAN_NAPRAWCZY.md**](./jarvis/PLAN_NAPRAWCZY.md) | **Plan naprawczy** — status zadań po audycie |

Import (CLI): [Scripts/import/README.md](../Scripts/import/README.md)

---

## Stravio — aplikacja (EN)

Monorepo Expo + Supabase.

| Plik | Opis |
|------|------|
| [stravio/ARCHITECTURE.md](./stravio/ARCHITECTURE.md) | System design, data flow |
| [stravio/DECISIONS.md](./stravio/DECISIONS.md) | Decyzje techniczne |
| [stravio/TODO.md](./stravio/TODO.md) | Roadmapa aplikacji |
| [stravio/CHANGELOG.md](./stravio/CHANGELOG.md) | Historia wersji |
| [stravio/RELEASE.md](./stravio/RELEASE.md) | Build i publikacja |

Główny README projektu: [../README.md](../README.md)

---

## Audyt (archiwum)

| Plik | Opis |
|------|------|
| [audit/PROMPT.md](./audit/PROMPT.md) | Prompt do audytu (mocniejszy model) |
| [audit/README.md](./audit/README.md) | Kontekst audytu Opus 2026-08-11 |

**Źródło prawdy dla napraw:** [jarvis/PLAN_NAPRAWCZY.md](./jarvis/PLAN_NAPRAWCZY.md) — tam aktualizujemy status zadań.

---

## Szybkie ścieżki

| Chcę… | Idź do |
|-------|--------|
| Skonfigurować od zera | [jarvis/SETUP.md](./jarvis/SETUP.md) |
| Wkleić instrukcję do Gema | [jarvis/GEM_INSTRUKCJA.md](./jarvis/GEM_INSTRUKCJA.md) |
| Naprawiać bugi po audycie | [jarvis/PLAN_NAPRAWCZY.md](./jarvis/PLAN_NAPRAWCZY.md) |
| Uruchomić import lokalnie | [Scripts/import/README.md](../Scripts/import/README.md) |
| Zrozumieć kod aplikacji | [stravio/ARCHITECTURE.md](./stravio/ARCHITECTURE.md) |
