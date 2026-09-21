# TODO

> **Stan na 2026-09-21:** Home = **Freestyle** albo **plan z katalogu** (PR #13 / D018). **D016** (logowanie per seria / rampa) wdrożone. **Następny krok:** UI polish (QA Toast/Badge) albo rest timer overlay.

---

## CURRENT — po PR #13

### Zrobione (produkt)
- [x] **Freestyle** — szybki start z katalogu
- [x] **Plany z katalogu** — `/plans` + `sheet/[id]` (D018); nie zakładka tab bara
- [x] Logowanie zbiorcze serii (D011) — historyczny model; rozszerzone przez D016
- [x] **D016 — logowanie per seria** — wiersz kg/powt. (lub czas) na serię; Volume w Sheets = suma serii
- [x] Sync Sheets / Edge Function `sync-sheets` (e2e 2026-09-03)
- [x] UI-A…UI-C polish (Home, summary, settings, stats, history)
- [x] UI-D komponenty `Toast` + `Badge` w kodzie (PR #4) — QA w apce `[do weryfikacji]`

### Otwórz teraz (wybór sprintu)

**A — UI polish / QA**
- [ ] **QA Toast / Badge** — potwierdzenia zapisu i badges wg `UI_REDESIGN_PROPOSAL.md` §3
- [ ] Drobne polish wg `UI_REDESIGN_PROPOSAL.md` / `UI_PROPOSAL GEMINI.md` (mapowanie zaktualizowane 2026-09-21)

**B — Sesja (kolejne po D016)**
- [ ] **Rest timer overlay** — pasek −15s / +30s / ✕; pref w Ustawieniach

**C — Integracje**
- [ ] **Deploy + sekrety** (jeśli nowe środowisko) — `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, opcjonalnie `JJ_WORKOUT_ALLOWED_USER_ID`
- [ ] *(Opcjonalnie)* link „Zsynchronizuj” na podsumowaniu treningu
- [ ] *(Opcjonalnie)* re-import sesji w szczegółach Historii
- [ ] **Przyszłość:** OAuth Google / eksport CSV z Ustawień

---

## BACKLOG (funkcje)

### Wysoki priorytet
- [ ] **Rest timer overlay** — patrz CURRENT §B
- [ ] **PowerSync** — offline-first sync (SQLite cache + Supabase)

### Średni priorytet
- [ ] **Sheet templates** — duplikowanie / szablony planów
- [ ] **PR / rekordy** — wizualizacja PR w Stats (Sheets: Brzycki; UI: Epley — D010)
- [ ] **Scroll horizontally** — swipe między zakładkami (opcjonalnie)

### Niski priorytet
- [ ] **i18n** — IT / EN
- [ ] **Data export** — CSV / PDF
- [ ] **Multi-user assignments** — model owner/assignee
- [ ] **Zakładka tab „Plany”** — tylko jeśli stack `/plans` okaże się niewystarczający (obecnie **nie** planowane; D018 = stack)

---

## Done (2026-09 — plany)

- [x] Home: Freestyle | Wybierz plan
- [x] `app/plans/index.tsx` — lista planów (bez Freestyle)
- [x] `app/sheet/[id].tsx` — edytor planu + start sesji (przywrócony z redirectu)
- [x] Import Split = nazwa planu albo `Freestyle`

---

## Done (2026-08 — freestyle sprint)

- [x] Katalog ćwiczeń PPL w `@bhmt3wp/shared` (`exerciseCatalog.ts`)
- [x] Freestyle: Home → szybki start (ukryty arkusz `"Freestyle"`)
- [x] Logowanie zbiorcze: serie + kg + powt. + uwagi → zapis wielu `session_set_logs`
- [x] Est. 1RM (Epley) + objętość na formularzu i w podsumowaniu ćwiczenia
- [x] Live stats sesji w nagłówku treningu
- [x] `OverflowMenu` w Historii (zamiast long-press delete)
- [x] Tab bar `#0b1220`, `ScreenHeader` leading-tight
- [x] Usunięto seed PPL i UI auto-splitów z Home
- [x] Fix resetu pól formularza przy odświeżaniu timera sesji

---

## Done (UI polish A–D — kod)

### Faza UI-A
- [x] Fix white line / height of text / Historia cards / Home hierarchy

### Faza UI-B
- [x] Ekran podsumowania, haptics, BottomSheet uwag, polish nagłówka statystyk

### Faza UI-C
- [x] Settings, Stats Pills, History streak

### Faza UI-D
- [x] Komponenty `Toast`, `Badge` (PR #4) — weryfikacja UX w apce nadal otwarta

### Faza UI-E
- [x] Edge Function `sync-sheets` + Ustawienia → Integracje
- [ ] Deploy/sekrety / opcjonalne linki sync — patrz CURRENT §C

---

## Done (wcześniej)

- [x] Initial project setup (Expo + NativeWind + monorepo)
- [x] Workout sheets CRUD
- [x] Exercises CRUD with sets
- [x] Workout sessions with set logging
- [x] Session history with calendar view
- [x] Rest timer between sets *(kod w repo; UI wyłączone 2026-08)*
- [x] Previous session weight/rep hints
- [x] Exercise notes (per-session)
- [x] Supabase Auth + RLS + migrate from SQLite
- [x] Web build + Vercel (**https://stravio-kappa.vercel.app/**)
- [x] Workout statistics (charts)
- [x] Push notifications scaffold
- [x] Drag-to-reorder exercises (sheet detail — używane w edytorze planu)
