# Dokumentacja

Indeks plików w `docs/`. Repozytorium łączy aplikację **JJ Workout Tool** z ekosystemem **Jarvis** (import → Google Sheets → Hermes + Gem).

**Web (kanon):** https://stravio-kappa.vercel.app/ · **Stan apki:** 2026-09-21 — Freestyle + plany (`/plans`, D018).

---

## Jarvis — ekosystem (PL)

Pipeline danych, Gem, GitHub Actions, plan naprawczy po audycie.

| Plik | Opis |
|------|------|
| [jarvis/ARCHITECTURE.md](./jarvis/ARCHITECTURE.md) | Architektura: źródła → import → Sheets → Hermes/Gem |
| [jarvis/SETUP.md](./jarvis/SETUP.md) | Konfiguracja krok po kroku |
| [jarvis/GITHUB_ACTIONS.md](./jarvis/GITHUB_ACTIONS.md) | Automatyczny import w chmurze |
| [jarvis/GEM_INSTRUKCJA.md](./jarvis/GEM_INSTRUKCJA.md) | Instrukcja systemowa Gema (zapas dla Hermesa, D017) |
| [**jarvis/PLAN_NAPRAWCZY.md**](./jarvis/PLAN_NAPRAWCZY.md) | **Plan naprawczy** — status zadań po audycie |

Import (CLI): [Scripts/import/README.md](../Scripts/import/README.md)

---

## JJ Workout Tool — aplikacja (EN + UI)

| Plik | Opis |
|------|------|
| [jj-workout-tool/ARCHITECTURE.md](./jj-workout-tool/ARCHITECTURE.md) | System design: Freestyle + plany |
| [jj-workout-tool/DECISIONS.md](./jj-workout-tool/DECISIONS.md) | Decyzje D001–D018 (m.in. D009 freestyle, D018 plany, D016 backlog) |
| [jj-workout-tool/TODO.md](./jj-workout-tool/TODO.md) | Roadmapa — QA UI / D016 / PowerSync |
| [jj-workout-tool/CHANGELOG.md](./jj-workout-tool/CHANGELOG.md) | Historia wersji |
| [jj-workout-tool/RELEASE.md](./jj-workout-tool/RELEASE.md) | Build i publikacja |
| [**jj-workout-tool/UI_REDESIGN_PROPOSAL.md**](./jj-workout-tool/UI_REDESIGN_PROPOSAL.md) | Audyt UI + plan faz UI-A…E |
| [jj-workout-tool/UI_PROPOSAL GEMINI.md](./jj-workout-tool/UI_PROPOSAL%20GEMINI.md) | Filozofia UX (dark, one-thumb) |

Główny README projektu: [../README.md](../README.md)

**Stan JJ Workout Tool na 2026-09-21:** Freestyle + plany z katalogu w kodzie (`main` / PR #13). Kolejny sprint = QA UI (Toast/Badge) albo **D016** (edycja per seria). Docs UI = filozofia + backlog polish.

---

## Audyt (archiwum)

| Plik | Opis |
|------|------|
| [audit/PROMPT.md](./audit/PROMPT.md) | Prompt do audytu (mocniejszy model) |
| [audit/README.md](./audit/README.md) | Kontekst audytu Opus 2026-08-11 |

**Źródło prawdy dla napraw:** [jarvis/PLAN_NAPRAWCZY.md](./jarvis/PLAN_NAPRAWCZY.md) — tam aktualizujemy status zadań.

**Stan na 2026-08-11:** sesja zamknięta (archiwum). Bieżący stan apki / importu — patrz sekcje powyżej i plan naprawczy.

---

## Szybkie ścieżki

| Chcę… | Idź do |
|-------|--------|
| Zobaczyć żywą apkę | https://stravio-kappa.vercel.app/ |
| Skonfigurować od zera | [jarvis/SETUP.md](./jarvis/SETUP.md) |
| Wkleić instrukcję do Gema | [jarvis/GEM_INSTRUKCJA.md](./jarvis/GEM_INSTRUKCJA.md) |
| Naprawiać bugi po audycie | [jarvis/PLAN_NAPRAWCZY.md](./jarvis/PLAN_NAPRAWCZY.md) |
| Uruchomić import lokalnie | [Scripts/import/README.md](../Scripts/import/README.md) |
| Zrozumieć kod aplikacji | [jj-workout-tool/ARCHITECTURE.md](./jj-workout-tool/ARCHITECTURE.md) |
| Poprawić UI aplikacji | [jj-workout-tool/UI_REDESIGN_PROPOSAL.md](./jj-workout-tool/UI_REDESIGN_PROPOSAL.md) §6 |
| Zobaczyć decyzje (D016–D018) | [jj-workout-tool/DECISIONS.md](./jj-workout-tool/DECISIONS.md) |
