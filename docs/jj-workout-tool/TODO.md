# TODO

> **Stan na 2026-09-24 (produkcja kappa):** Freestyle + plany (**D018**). Logowanie **Zbiorczo | Per seria** (**D016**). UI-D Toast/Badge QA. **Objętość per partia** (D019 §3). **Rest timer overlay** (D019). **Baza ćwiczeń 1324 + GIF (CDN)** + nazwy PL. **UX sesji** (pasek %, Ostatnio, toast tonażu, wake lock). **Edytor planów** (cele serii/powt., kolejność, duplikat). **RIR/RPE** (opcjonalnie, PR). **Następny krok:** JSON backup.

---

## CURRENT — produkcja

### Zrobione (produkt)
- [x] **Freestyle** — szybki start z katalogu
- [x] **Plany z katalogu** — `/plans` + `sheet/[id]` (D018)
- [x] Logowanie zbiorcze (D011) — nadal dostępne jako tryb **Zbiorczo**
- [x] **D016** — tryb **Per seria** + przełącznik; Volume w Sheets = suma serii (PR #17 → `main`)
- [x] Sync Sheets / Edge Function `sync-sheets` (e2e 2026-09-03)
- [x] UI-A…UI-C polish; UI-D Toast/Badge (**QA zamknięte** 2026-09-22)

### Otwórz teraz (wybór sprintu)

**A — UI polish / QA**
- [x] **QA Toast / Badge** — potwierdzenia zapisu i badges wg `UI_REDESIGN_PROPOSAL.md` §3
- [ ] Drobne polish wg dokumentów UI

**B — Sesja (FORGE / D019)**
- [x] **Rest timer overlay** — pasek −15s / +30s / Pomiń; pref w Ustawieniach; nie w scrollu
- [x] **Baza ćwiczeń (dataset + GIF CDN)** — `/exercises`, picker z mediów; atrybucja Gym visual (NOTICE)
- [x] **UX sesji** — postęp %, chip Ostatnio, toast tonażu, wake lock

**C — Integracje**
- [ ] **Deploy + sekrety** (jeśli nowe środowisko)
- [ ] *(Opcjonalnie)* sync na podsumowaniu / re-import w Historii
- [ ] **Przyszłość:** OAuth Google / eksport CSV

---

## Inspiracja FORGE (2026-09-21) — kolejka

Źródło: [FORGE/PRO](https://forgeproapp.github.io/Aplikacja-treningowa-FORGE/). Nie kopiujemy plan-cycle-first / Firebase. Szczegóły: **D019**.

1. [x] **D016 per-set** (+ tryb zbiorczy) — na produkcji
2. [x] **Rest timer overlay**
3. [x] **Tagi partii + objętość tygodniowa** (główna 1.0 / pomocnicza 0.5)
4. [x] **Baza ćwiczeń + media (CDN)** — OpenGym-style Library; dane MIT, GIF © Gym visual
5. [x] **UX sesji** — pasek % serii; chip „Ostatnio…”; toast tonażu; wake lock
6. [ ] **Export / import JSON**

**Pomijamy / później:** mezocykl+RIR jako rdzeń Home; obwody w apce (waga = openScale→Sheets); Firebase.

---

## BACKLOG (funkcje)

### Wysoki priorytet
- [x] **Rest timer overlay** — CURRENT §B
- [x] **Objętość per partia** — D019 §3 (Stats + tagi katalogu)
- [x] **UX sesji (D019 §5)** — postęp / Ostatnio / toast tonażu / wake lock
- [x] **Edytor planów (D018)** — cele serii×powt., reorder, duplikat
- [ ] **PowerSync** — offline-first

### Średni priorytet
- [ ] **Export / import JSON** — D019 §4
- [x] **Pasek postępu sesji + ghost polish** — D019 §5 (postęp + Ostatnio + toast; ghost później)
- [x] **Sheet templates** — duplikowanie planów
- [x] **PR / rekordy + trend 1RM** — Stats (Epley UI / Brzycki Sheets)
- [x] **RIR / RPE opcjonalnie** — pref + per seria; kolumna Wysilek w Sheets
- [ ] **Scroll horizontally** — opcjonalnie

### Niski priorytet
- [ ] **i18n** — IT / EN
- [ ] **Data export** — CSV / PDF (po JSON)
- [ ] **Multi-user assignments**
- [ ] **Zakładka tab „Plany”** — tylko jeśli `/plans` niewystarczy
- [ ] **Mezocykl / auto-awans** — epik (D019; nie mylić z prostym RIR/RPE)

---

## Done (2026-09 — D016)

- [x] Formularz: **Zbiorczo | Per seria** (pref + Ustawienia)
- [x] Zapis różnych kg/powt. w `session_set_logs`
- [x] Import: Volume = Σ serii; Ciezar/1RM = best Brzycki; PR = max kg
- [x] GEM_INSTRUKCJA — Volume / rampa

---

## Done (2026-09 — plany)

- [x] Home: Freestyle | Wybierz plan
- [x] `app/plans/index.tsx`, `app/sheet/[id].tsx`
- [x] Import Split = nazwa planu albo `Freestyle`
- [x] Cele serii/powt. w `exercise_sets`; reorder; duplikat planu

---

## Done (2026-08 — freestyle sprint)

- [x] Katalog PPL, freestyle, Est. 1RM (Epley), live stats, OverflowMenu, tab bar, usunięty seed PPL

---

## Done (UI polish A–D — kod)

- [x] UI-A…C; UI-D Toast/Badge (PR #4) — QA zamknięte 2026-09-22 (toast web+historia, badge plany/historia)
- [x] UI-E Edge Function + Ustawienia Integracje

---

## Done (wcześniej)

- [x] Expo + NativeWind + Supabase + Vercel (**kappa**)
- [x] Historia, Stats, rest timer w kodzie (UI wyłączone), hints, notes
