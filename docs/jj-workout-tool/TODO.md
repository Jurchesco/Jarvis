# TODO

> **Stan na 2026-09-24 (produkcja kappa):** Freestyle + plany (**D018**). Logowanie **Zbiorczo | Per seria** (**D016**). **Profil / waga + Garmin w Supabase** (Sheets = mirror). **RIR/RPE**, JSON backup v2, kontekst AI CSV. **Następny krok:** PowerSync / Hermes na DB.

---

## CURRENT — produkcja

### Zrobione (produkt)
- [x] **Freestyle** — szybki start z katalogu
- [x] **Plany z katalogu** — `/plans` + `sheet/[id]` (D018)
- [x] Logowanie zbiorcze (D011) — nadal dostępne jako tryb **Zbiorczo**
- [x] **D016** — tryb **Per seria** + przełącznik; Volume w Sheets = suma serii (PR #17 → `main`)
- [x] Sync Sheets / Edge Function `sync-sheets` (e2e 2026-09-03)
- [x] UI-A…UI-C polish; UI-D Toast/Badge (**QA zamknięte** 2026-09-22)
- [x] **Profil + waga** — `body_and_health.sql`, weigh-in w Ustawieniach, openScale → Supabase
- [x] **Garmin → Supabase** — sen / dzień / forma / aktywności (mirror Sheets)
- [x] **Eksport kontekstu AI** — CSV/JSON allowlista 30 dni

### Otwórz teraz (wybór sprintu)

**A — UI polish / QA**
- [x] **QA Toast / Badge** — potwierdzenia zapisu i badges wg `UI_REDESIGN_PROPOSAL.md` §3
- [x] Drobne polish wg dokumentów UI (Cel/ghost, Badge, copy, SafeArea, empty states)

**B — Sesja (FORGE / D019)**
- [x] **Rest timer overlay** — pasek −15s / +30s / Pomiń; pref w Ustawieniach; nie w scrollu
- [x] **Baza ćwiczeń (dataset + GIF CDN)** — `/exercises`, picker z mediów; atrybucja Gym visual (NOTICE)
- [x] **UX sesji** — postęp %, chip Ostatnio, toast tonażu, wake lock

**C — Integracje**
- [ ] **Deploy + sekrety** — uruchom `body_and_health.sql` + `JJ_WORKOUT_USER_ID` w importerze
- [ ] *(Opcjonalnie)* sync na podsumowaniu / re-import w Historii
- [x] **Eksport CSV / kontekst AI** — Ustawienia
- [x] **Gotowość dziś** — Home strip
- [x] **Stats OpenGym-style** — tiles / heatmap / waga / missed
- [ ] Hermes czyta Supabase/JSON zamiast tylko Sheets (`docs/jarvis/HERMES_SUPABASE.md`)

---

## Inspiracja FORGE (2026-09-21) — kolejka

Źródło: [FORGE/PRO](https://forgeproapp.github.io/Aplikacja-treningowa-FORGE/). Nie kopiujemy plan-cycle-first / Firebase. Szczegóły: **D019**.

1. [x] **D016 per-set** (+ tryb zbiorczy) — na produkcji
2. [x] **Rest timer overlay**
3. [x] **Tagi partii + objętość tygodniowa** (główna 1.0 / pomocnicza 0.5)
4. [x] **Baza ćwiczeń + media (CDN)** — OpenGym-style Library; dane MIT, GIF © Gym visual
5. [x] **UX sesji** — pasek % serii; chip „Ostatnio…”; toast tonażu; wake lock
6. [x] **Export / import JSON**

**Pomijamy / później:** pełny mezocykl FORGE na Home; Firebase; in-app AI Coach (epik). Auto-awans planów = **D021** (MVP linear/double).

---

## BACKLOG (funkcje)

### Wysoki priorytet
- [x] **Rest timer overlay** — CURRENT §B
- [x] **Objętość per partia** — D019 §3 (Stats + tagi katalogu)
- [x] **UX sesji (D019 §5)** — postęp / Ostatnio / toast tonażu / wake lock
- [x] **Edytor planów (D018)** — cele serii×powt., reorder, duplikat
- [ ] **PowerSync** — offline-first

### Średni priorytet
- [x] **Export / import JSON** — D019 §4 (+ v2 body/Garmin; v3 progression/warmup)
- [x] **Pasek postępu sesji + ghost polish** — D019 §5
- [x] **Sheet templates** — duplikowanie planów
- [x] **PR / rekordy + trend 1RM** — Stats
- [x] **RIR / RPE opcjonalnie**
- [x] **Profil / waga + dziennik zdrowia w Supabase**
- [x] **Auto-progresja planów (D021)** — linear / double / Greyskull / time + deload + Cel w sesji
- [ ] **Scroll horizontally** — opcjonalnie
- [x] Warm-up poza progresją / bodyweight reps + SQL/backup (D021 complete)

### Niski priorytet
- [ ] **i18n** — IT / EN
- [ ] **Data export** — PDF
- [ ] **Multi-user assignments**
- [ ] **Zakładka tab „Plany”** — tylko jeśli `/plans` niewystarczy
- [x] **Mezocykl / auto-awans** — MVP D021 (linear + double na planach; Greyskull/time później)
- [ ] **In-app AI Coach** — consent + apply/revert (po Hermesie na DB)

---

## Done (2026-09 — D016)

- [x] Formularz: **Zbiorczo | Per seria** (pref + Ustawienia)
- [x] Zapis różnych kg/powt. w `session_set_logs`
- [x] Import: Volume = Σ serii; Ciezar/1RM = best Brzycki; PR = max kg
