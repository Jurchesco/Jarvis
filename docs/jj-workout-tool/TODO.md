# TODO

> **Stan na 2026-08-12:** logowanie ćwiczeń (freestyle) uznane za **stabilne** — nie rozwijamy tej warstwy funkcjonalnej w najbliższym sprincie. **Następny krok: UI polish** wg `UI_REDESIGN_PROPOSAL.md` + `UI_PROPOSAL GEMINI.md`.

---

## CURRENT — UI polish (następny sprint)

Priorytet wg `UI_REDESIGN_PROPOSAL.md` §6, zaktualizowany pod obecny kod:

### Faza UI-A — szybkie poprawki
- [x] **Fix white line** — `sceneStyle: { backgroundColor: '#0b1220' }` w tab layout
- [x] **Fix height of text** — `leading-tight` / `leading-5` na Home i Historii
- [x] **Historia** — objętość + czas trwania na karcie sesji + podsumowanie miesiąca
- [x] **Home** — ostatni trening, licznik treningów w miesiącu, lepsza hierarchia CTA

### Faza UI-B — aktywny trening (najważniejszy ekran)
- [x] **Ekran podsumowania** — `app/workout/summary/[id].tsx` po „Zakończ” (statystyki, porównanie, top ćwiczenia)
- [x] **Haptics** — `expo-haptics` przy zapisie ćwiczenia (toggle w Ustawieniach — później)
- [x] **BottomSheet na uwagi** — `BottomSheet.tsx` + tap na wiersz uwag w `ExerciseLogForm`
- [x] **Polish nagłówka statystyk** — siatka 2×3 z wspólną ramką w `workout/[id].tsx`

### Faza UI-C — pozostałe zakładki
- [x] **Enhance settings** — konto, rest timer (pref), haptics toggle, motyw, Wyloguj przeniesiony z Home
- [x] **Stats** — Pills 1M/3M/6M/Wszystko + wykres trendu per ćwiczenie
- [x] **History** — streak w podsumowaniu miesiąca + aktywna seria

### Faza UI-D — design system
- [ ] **`Toast`** — potwierdzenia „Zapisano ćwiczenie”
- [x] **`BottomSheet`** — notatki w treningu
- [x] **`Pills`** — Stats + Ustawienia
- [ ] **`Badge`** — wg tabeli w `UI_REDESIGN_PROPOSAL.md` §3

### Faza UI-E — Integracje Google Sheets (§6)
> Wymaga **deploy Edge Function** + sekretów w Supabase — patrz `supabase/functions/sync-sheets/README.md`

- [x] **Edge Function `sync-sheets`** — import Silownia_import (port logiki `workout.py`, TZ Warsaw)
- [x] **Ustawienia → Integracje** — status + „Synchronizuj teraz” + klient `sheetSync.ts`
- [ ] **Deploy + sekrety** — `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, opcjonalnie `JJ_WORKOUT_ALLOWED_USER_ID`
- [ ] *(Opcjonalnie)* link „Zsynchronizuj” na ekranie podsumowania treningu (§6.1)
- [ ] *(Opcjonalnie)* re-import sesji w szczegółach Historii (§6.1)
- [ ] **Przyszłość:** OAuth Google / eksport CSV z Ustawień (multi-user)

---

## BACKLOG (funkcje — po UI)

### Wysoki priorytet (produkt)
- [ ] **Zakładka Plany** — gotowe programy (PPL itd.) w **osobnej zakładce** tab bara; obecnie tylko freestyle
- [ ] **PowerSync** — offline-first sync (SQLite cache + Supabase)

### Średni priorytet
- [ ] **Sheet templates** — duplikowanie / szablony planów (gdy wróci moduł planów)
- [ ] **PR / rekordy** — wizualizacja PR w Stats (spójnie z importerem: Est. 1RM Brzycki w Sheets, Epley w UI)
- [ ] **Scroll horizontally** — swipe między zakładkami (opcjonalnie)
- [ ] **Rest timer** — ponowne włączenie jako overlay + ustawienie domyślnego czasu

### Niski priorytet
- [ ] **i18n** — IT / EN
- [ ] **Data export** — CSV / PDF
- [ ] **Multi-user assignments** — model owner/assignee

---

## Done (2026-08 — freestyle sprint)

- [x] Katalog ćwiczeń PPL w `@bhmt3wp/shared` (`exerciseCatalog.ts`)
- [x] Freestyle: Home → „Rozpocznij trening” (bez wyboru planu)
- [x] Logowanie zbiorcze: serie + kg + powt. + uwagi → zapis wielu `session_set_logs`
- [x] Est. 1RM (Epley) + objętość na formularzu i w podsumowaniu ćwiczenia
- [x] Live stats sesji w nagłówku treningu
- [x] `OverflowMenu` w Historii (zamiast long-press delete)
- [x] Tab bar `#0b1220`, `ScreenHeader` leading-tight
- [x] Usunięto seed PPL i UI splitów z Home
- [x] Fix resetu pól formularza przy odświeżaniu timera sesji

---

## Done (wcześniej)

- [x] Initial project setup (Expo + NativeWind + monorepo)
- [x] Workout sheets CRUD *(schemat; UI planów wyłączone)*
- [x] Exercises CRUD with sets
- [x] Workout sessions with set logging
- [x] Session history with calendar view
- [x] Rest timer between sets *(kod w repo; UI wyłączone 2026-08)*
- [x] Previous session weight/rep hints
- [x] Exercise notes (per-session)
- [x] Supabase Auth + RLS + migrate from SQLite
- [x] Web build + Vercel
- [x] Workout statistics (charts)
- [x] Push notifications scaffold
- [x] Drag-to-reorder exercises *(sheet detail — nieużywane w freestyle)*
