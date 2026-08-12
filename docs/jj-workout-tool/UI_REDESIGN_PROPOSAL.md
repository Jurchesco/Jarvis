# JJ Workout Tool — Propozycja redesignu UI (oparta na analizie kodu)

> Ten dokument jest **komplementarny** do `UI_PROPOSAL GEMINI.md`. Tamten opisuje ogólną filozofię UX. Ten plik — **konkretne, wdrażalne zmiany** z odniesieniem do plików w repo.
>
> **Stan na 2026-08-12:** warstwa **logowania ćwiczeń (freestyle) uznana za zamrożoną** — nie rozwijamy funkcji zapisu serii w najbliższym sprincie. Kolejny krok = **UI polish** wg sekcji 6 poniżej.

---

## 0. Stan implementacji (2026-08-12)

### Zrobione ✅

| Obszar | Status |
|--------|--------|
| Freestyle Home (bez planów) | ✅ `app/(tabs)/index.tsx` — jeden CTA |
| Logowanie zbiorcze serii | ✅ `ExerciseLogForm` + `saveExerciseLogBatch` |
| Katalog ćwiczeń w sesji | ✅ `ExercisePicker` |
| Live stats sesji | ✅ siatka 2×3 w `workout/[id].tsx` |
| Menu ⋮ w Historii | ✅ `OverflowMenu` — bez long-press |
| Tab bar kolor | ✅ `#0b1220` |
| Nagłówki lineHeight | ✅ częściowo `ScreenHeader` |
| Rest timer | ⏸ **wyłączony** (decyzja produktowa) |
| Plany / splitty / seed PPL | ❌ usunięte z UI |
| Sheet detail | ↩ redirect Home |

### Nieaktualne sekcje tego audytu

Poniższe punkty odnoszą się do **starego** UI (plany, per-set rows, rest timer w scrollu). Traktuj je jako historyczne; przy implementacji UI patrz **zaktualizowaną sekcję 6**.

- §2.1 long-press na Home — **nie dotyczy** (brak kart planów)
- §2.2 duplikat „Utwórz plan” — **nie dotyczy**
- §2.3 Sheet Detail SetRow — **nie dotyczy** (sheet wyłączony)
- §2.4 Rest timer w scrollu — **timer wyłączony**; ewentualny powrót = floating overlay (Faza UI-B)
- §4.1–4.2 Home / Sheet Detail — zastąpione freestyle (patrz `ARCHITECTURE.md`)

### Nadal aktualne 🎯

- §2.5 Ekran podsumowania po treningu
- §2.6 Rozbudowa Ustawień
- §2.8 White line / SafeArea / typografia (dokończyć)
- §4.3 Polish ekranu treningu (haptics, BottomSheet uwag, summary)
- §4.4–4.5 Historia + Stats (więcej danych na kartach, filtry)
- §3 Design system (`Toast`, `BottomSheet`, `Pills`, …)

---

## 0b. Metoda (oryginalny audyt, 2026-03)
Przejrzałem:
- `app/(tabs)/index.tsx`, `app/(tabs)/history/index.tsx`, `app/(tabs)/stats/index.tsx`, `app/(tabs)/settings/index.tsx`, `app/(tabs)/_layout.tsx`
- `app/sheet/[id].tsx`, `app/workout/[id].tsx`
- `src/components/ui/*` (Button, Card, Input, ScreenHeader, StateBlock, icons)
- `tailwind.config.js` (paleta kolorów)
- `docs/jj-workout-tool/TODO.md`, `DECISIONS.md`, `CHANGELOG.md`

**Wniosek:** aplikacja jest już dość dojrzała funkcjonalnie (sesje, timer odpoczynku, historia z kalendarzem, statystyki z wykresami, drag&drop). To nie jest projektowanie UI od zera — to **audyt + polish pass**, dokładnie to, co masz zapisane w `TODO.md` pod „UI/UX polish pass" i „Enhance settings".

---

## 1. Co już działa dobrze (zostaw bez zmian)

- Spójna ciemna paleta kolorów (`background`, `surface`, `action-primary`, `emphasis`, `danger`) — trzymaj się jej konsekwentnie, nie wprowadzaj nowych kolorów ad-hoc.
- `Card`, `Button`, `Input`, `ScreenHeader`, `StateBlock` jako reużywalne prymitywy — to dobry fundament design systemu, rozbudowuj go dalej zamiast pisać nowe style inline.
- Drag & drop do zmiany kolejności planów/ćwiczeń.
- Podpowiedzi z poprzedniej sesji (`Ostatnio: X kg x Y`) podczas treningu.
- Kalendarz w historii z zielonymi kropkami dni treningowych.
- Autofill wagi/powtórzeń z poprzedniej serii.

---

## 2. Zidentyfikowane problemy w obecnym UI

### 2.1 Konflikt gestów long-press (Home, `app/(tabs)/index.tsx`)

Obecnie: long-press na **całej karcie** planu → usuwanie (`handleDelete`), a long-press na **uchwycie** (`GripVertical`) → przeciąganie. Oba triggery żyją na tym samym elemencie z różnym `delayLongPress` (350ms vs 180ms). To ryzykowne — użytkownik przytrzymujący kartę odrobinę za długo przypadkiem otworzy dialog usuwania planu treningowego (nieodwracalna operacja, kaskadowo kasuje ćwiczenia i serie).

**Rekomendacja:** Usuń `onLongPress` z całej karty. Usuwanie planu przenieś do:
- swipe-to-delete (np. `react-native-gesture-handler` `Swipeable` — już masz zainstalowany gesture-handler) **lub**
- menu trzech kropek (ikona `MoreVertical` z lucide) przy każdej karcie, z akcjami „Zmień nazwę" / „Usuń".

To samo dotyczy `app/(tabs)/history/index.tsx` (usuwanie sesji przez long-press na karcie).

### 2.2 Zduplikowana akcja tworzenia planu (Home)

Na ekranie głównym istnieją **dwa** sposoby na utworzenie planu: przycisk „Utwórz plan" w nagłówku oraz FAB (`+`) w prawym dolnym rogu. Oba otwierają ten sam formularz `showCreate`. To zbędna duplikacja, zajmuje miejsce i myli hierarchię akcji.

**Rekomendacja:** Zostaw tylko FAB (spójny wzorzec z resztą listopodobnych ekranów). Przycisk „Program PPL" przenieś do menu FAB rozwijanego (speed-dial: `+` → „Nowy plan pusty" / „Program PPL") albo do osobnej karty typu „Szybki start" widocznej tylko gdy lista planów jest pusta.

### 2.3 Edycja serii w Sheet Detail wymaga 2 kroków (`app/sheet/[id].tsx`, `SetRow`)

Aby zmienić wagę/powtórzenia szablonu serii, trzeba: tap na wiersz → wejść w tryb edycji → wpisać wartość → tap na checkmark, żeby zapisać. To wolniejsze niż w ekranie aktywnego treningu, gdzie pola są od razu edytowalne inline.

**Rekomendacja:** Ujednolić — pola `kg`/`reps`/`rest` w `SetRow` powinny być zawsze aktywnymi `TextInput`, zapisywanymi na `onBlur` (tak jak już działa w `app/workout/[id].tsx`). Usuń stan `isEditing` i przycisk potwierdzenia — to zbędny krok pośredni.

### 2.4 Rest Timer znika ze scrolla (`app/workout/[id].tsx`)

Timer odpoczynku renderuje się jako `Card` **nad** listą ćwiczeń, ale sama lista ćwiczeń jest w osobnym `ScrollView` poniżej — więc jeśli ćwiczeń jest dużo, trzeba przewinąć w górę, żeby zobaczyć ile czasu zostało. To kluczowy element „NAJWAŻNIEJSZEGO" ekranu i powinien być zawsze widoczny.

**Rekomendacja:** Zamień na floating overlay przyklejony do dołu ekranu (nad tab barem/przyciskiem zakończenia), tak jak dolny pasek płatności w appkach e-commerce — widoczny niezależnie od scrolla listy ćwiczeń. Duży czas, przyciski `-15s` / `+15s` / „Pomiń".

### 2.5 Brak ekranu podsumowania po zakończeniu treningu

`handleFinishWorkout` po sukcesie robi `router.dismissAll()` → `router.replace("/")`. Użytkownik nie widzi żadnego podsumowania („Ukończyłeś trening! 6 ćwiczeń, 18 serii, 4520 kg objętości, 52 minuty"). To strata okazji na pozytywne wzmocnienie nawyku (gamifikacja retencji).

**Rekomendacja:** Nowy ekran `app/workout/summary/[id].tsx` (modal) pokazywany po `completeSession.mutateAsync`, zanim wrócimy do Home. Duże liczby, ikona sukcesu, przycisk „Zamknij".

### 2.6 Ustawienia — bardzo okrojone (`app/(tabs)/settings/index.tsx`)

Obecnie tylko jeden toggle (powiadomienia). `TODO.md` wprost wymienia braki: domyślny czas odpoczynku, wybór motywu, zarządzanie kontem.

**Rekomendacja:** patrz sekcja 4.6 poniżej — pełna specyfikacja.

### 2.7 Tab bar — brak przewijania poziomego (z `TODO.md`)

Wymieniony wprost w TODO jako CURRENT. Obecnie `Tabs` z `expo-router` ma 4 zakładki, które mieszczą się na ekranie — przewijanie poziome prawdopodobnie ma sens dopiero przy dodaniu kolejnych zakładek (np. „Katalog ćwiczeń" z backlogu). Zamiast przewijania, rozważ **swipe między zakładkami przez zawartość ekranu** (gesture na content area, nie na tab barze) — to bardziej naturalny wzorzec na mobile niż scrollowalny tab bar.

### 2.8 „Fix white line" i „Fix height of text" (z `TODO.md`)

Prawdopodobna przyczyna białej linii: `SafeAreaView` na kilku ekranach używa `edges={["top"]}` (Home, History, Settings) zamiast `edges={["top", "bottom"]}`, podczas gdy tab bar ma stały `height: 68` — na niektórych Androidach z gesture navigation może zostać nie pokryty pasek tła. Sprawdź też, czy `tabBarStyle.backgroundColor` (`#0f1728`) pokrywa się z `background` tokenem (`#0b1220`) — obecnie to **dwa różne kolory**, co może dawać wizualny „szew" (nie biały, ale widoczny) na styku contentu i tab bara.

**Rekomendacja:** ujednolić `tabBarStyle.backgroundColor` z tokenem `background`/`surface-muted`, i przetestować `edges` na fizycznym urządzeniu z Android gesture bar.

„Fix height of text" — prawdopodobnie brak `lineHeight` w klasach Tailwind dla `text-lg`/`text-xl` powoduje przycinanie descenderów (np. w polskich znakach `ą, ę, y, g`). Dodaj `leading-tight`/`leading-normal` konsekwentnie do nagłówków w `ScreenHeader` i kartach.

---

## 3. Nowe elementy Design Systemu do dodania w `src/components/ui`

| Komponent | Plik | Cel |
|---|---|---|
| `SwipeableRow` | `SwipeableRow.tsx` | Swipe-to-delete dla kart planów/sesji/ćwiczeń, zamiast ryzykownego long-press |
| `Menu` / `ActionSheet` | `Menu.tsx` | Menu 3 kropek (rename/delete) jako bezpieczna alternatywa dla long-press |
| `Toast` | `Toast.tsx` | Potwierdzenia typu „Zapisano", „Seria cofnięta" zamiast polegania wyłącznie na wizualnej zmianie stanu |
| `Pills` / `SegmentedControl` | `Pills.tsx` | Przełączniki zakresu czasu w Statystykach (1M/3M/6M/Wszystko) |
| `BottomSheet` | `BottomSheet.tsx` | Rest Timer overlay, formularz „Utwórz plan”, notatki na pełnym ekranie |
| `Badge` | `Badge.tsx` | Liczba ćwiczeń/serii na kartach planów, status „w trakcie” |

Wszystkie powinny przyjmować `className` i korzystać z istniejących tokenów (`bg-surface`, `border-border`, `text-text-primary` itd.), zgodnie z konwencją `cx()` z `utils.ts`.

---

## 4. Specyfikacja ekran po ekranie

### 4.1 Home — `app/(tabs)/index.tsx`

- **Nagłówek:** zostaw `ScreenHeader`, ale dodaj małe podsumowanie tygodnia pod tytułem, np. „3 treningi w tym tygodniu 🔥” (dane już dostępne przez `useCompletedSessions`/`useStatsData`).
- **Karta planu:** dodaj `Badge` z liczbą ćwiczeń (`sheet.exercises.length`) i datą ostatniego treningu na danym planie (wymaga dociągnięcia `lastSessionBySheet` per karta — można zserializować w hooku `useSheetsWithLastSession`).
- **Usuń** duplikat przycisku „Utwórz plan” w nagłówku — zostaw tylko FAB.
- **Usuń** `onLongPress` na całej karcie → zamień na `Menu` (3 kropki) w prawym górnym rogu karty z opcjami „Zmień nazwę”, „Usuń”, „Duplikuj” (przyszły `TODO`: „Sheet templates”).
- Grip do przeciągania zostaje jak jest (już OK, osobny mały touch target).

### 4.2 Sheet Detail — `app/sheet/[id].tsx`

- **Ujednolić `SetRow`:** zawsze inline-editable (zob. 2.3), bez trybu `isEditing`/przycisku zapisu — zapisuj na `onBlur`, tak jak `app/workout/[id].tsx`.
- **Nagłówek serii:** dodaj kolumnę `REST` jako edytowalną razem z KG/POWT (już jest kolumna „ODP." — upewnij się że też jest inline).
- **Usuwanie ćwiczenia:** obecny przycisk kosza (`Trash2`) w rogu karty ćwiczenia jest OK (nie polega na long-press) — zostaw.
- **CTA „Start”** w `ScreenHeader.rightAction` — rozważ przeniesienie na sticky footer (pełna szerokość, duży przycisk) zamiast małego przycisku w nagłówku, zgodnie z zasadą „główna akcja pod kciukiem” z dokumentu Gemini.

### 4.3 Active Workout — `app/workout/[id].tsx` (najważniejszy ekran)

- **Rest Timer jako floating overlay** (zob. 2.4) zamiast karty w normalnym flow.
- **Haptics:** dodaj `expo-haptics` (`Haptics.impactAsync(ImpactFeedbackStyle.Medium)`) w `handleCompleteSet`, żeby dać fizyczne potwierdzenie bez patrzenia na ekran.
- **Przycisk „Gotowe”/„Wróć”:** obecna logika już jest dobra (odwracalne, zgodnie z `CHANGELOG.md` — „Done is now reversible with Undo”). Zostaw.
- **Notatki ćwiczenia:** obecnie inline `TouchableOpacity` → `Input`. Rozważ `BottomSheet` na pełną szerokość dla dłuższych notatek (RPE, wskazówki) — łatwiej pisać bez zasłaniania reszty karty klawiaturą.
- **Po zakończeniu:** pokaż ekran podsumowania (zob. 2.5) zamiast bezpośredniego powrotu na Home.
- **Wskaźnik postępu:** pasek postępu w górnej karcie już istnieje (`progress` bar) — dobrze, zostaw. Rozważ dodanie też licznika całkowitego czasu trwania sesji (stoper od `session.startedAt`).

### 4.4 History — `app/(tabs)/history/index.tsx`

- Zamień `onLongPress` usuwania sesji na `Menu`/swipe (zob. 2.1).
- Dodaj mini-podsumowanie miesiąca nad listą: łączna objętość, liczba treningów, najdłuższa seria dni z rzędu (streak) — dane masz już w `sessions`.
- Karta sesji: dodaj czas trwania i objętość (masz te dane w `SessionDetailFull`, podobnie jak w `stats/index.tsx` `sessionVolume()`) zamiast tylko daty — więcej kontekstu bez wchodzenia w szczegóły.

### 4.5 Stats — `app/(tabs)/stats/index.tsx`

- Dodaj `Pills` na górze: `1M / 3M / 6M / Wszystko` filtrujące `sessions` przed przekazaniem do wykresów (obecnie zawsze ostatnie 10 sesji, zahardkodowane w `useStatsData`).
- Dodaj rozwijaną listę wyboru konkretnego ćwiczenia → osobny wykres trendu ciężaru/objętości w czasie tylko dla niego (zamiast tylko zbiorczego rankingu top 8).
- Rozważ kartę z rekordami osobistymi (PR) — max ciężar, max objętość w jednej sesji, najdłuższy trening.

### 4.6 Settings — `app/(tabs)/settings/index.tsx` (pełne rozszerzenie zgodnie z `TODO.md`)

Nowa struktura ekranu (sekcje jako osobne `Card`):

1. **Konto**
   - Adres e-mail (readonly, z `useAuth()`)
   - Przycisk „Zmień hasło” (otwiera formularz/modal)
   - Przycisk „Wyloguj” (obecnie w Home — rozważ przeniesienie tutaj, zgodnie z konwencją że ustawienia to miejsce na akcje konta)
2. **Trening**
   - „Domyślny czas odpoczynku” — wybór przez `Pills` (30s/60s/90s/120s), zapisywany np. w `profiles` lub lokalnie w async storage
   - „Autouzupełniaj z poprzedniego treningu” — `Switch` (już masz wzorzec `Switch` z tego pliku)
   - „Wibracje przy zaliczeniu serii” — `Switch` (haptics toggle)
3. **Powiadomienia** (istniejąca sekcja, zostaw jak jest)
4. **Wygląd**
   - Wybór motywu: Ciemny (domyślny, jedyny w pełni wspierany) / Jasny (oznaczony jako „Wkrótce”, disabled) — nie inwestuj w pełny light theme, dopóki nie ma wyraźnej potrzeby (koszt/zysk niski wg `DECISIONS.md`)
5. **O aplikacji**
   - Wersja aplikacji, link do `CHANGELOG.md`/politki (jeśli dotyczy)

### 4.7 Nawigacja / Tab Bar — `app/(tabs)/_layout.tsx`

- Ujednolić `tabBarStyle.backgroundColor` z paletą (`#0b1220` lub nowy token `surface-nav`), patrz 2.8.
- Rozważ dodanie subtelnej górnej krawędzi z cieniem/blur zamiast płaskiego `borderTopWidth: 1`, żeby oddzielić wizualnie tab bar od treści przy przewijaniu.

---

## 5. Nowy ekran: Podsumowanie treningu

**Plik:** `app/workout/summary/[id].tsx` (modal, `presentation: "modal"` w `_layout.tsx`)

Zawartość:
- Duża ikona sukcesu (`CheckCircle2` z lucide, kolor `emphasis`)
- Nagłówek: „Świetna robota!” + „Freestyle” (lub data sesji)
- Siatka 2x2 statystyk: Czas trwania / Liczba serii / Objętość (kg) / Liczba ćwiczeń
- Ewentualnie: porównanie z poprzednią sesją tego planu („+120 kg objętości względem ostatniego razu”)
- Przycisk „Zamknij” → powrót na Home

---

## 6. Integracja z importem do Google Sheets (Jarvis)

### 6.0 Ograniczenie architektoniczne (przeczytaj przed implementacją)

Import (`Scripts/import/jarvis_import/importers/workout.py`) działa dziś jako skrypt Pythona uruchamiany lokalnie lub w GitHub Actions co godzinę (`jarvis/ARCHITECTURE.md`). Korzysta z dwóch sekretów, które **nie mogą trafić do klienta mobilnego/webowego** (JJ Workout Tool ma publiczny build webowy na Vercelu):

- `SUPABASE_SECRET_KEY` (service role, omija RLS)
- `google-service-account.json` (pełny dostęp zapisu do arkusza)

**Wniosek:** przycisk w aplikacji nie może uruchamiać Pythona bezpośrednio. Musi wołać backend pośredniczący, np.:
- Supabase Edge Function, która trzyma sekrety po stronie serwera i albo sama robi upsert do Sheets (reimplementacja logiki z `workout.py` w TS/Deno), albo
- Edge Function, która odpala GitHub Actions workflow przez `workflow_dispatch`/`repository_dispatch` (GH token też trzymany tylko po stronie serwera).

To osobne zadanie backendowe, nie tylko UI — uwzględnij je w planie wdrożenia, zanim zaczniesz podpinać przyciski pod prawdziwą logikę.

### 6.1 Rekomendowane rozmieszczenie UI

Pipeline już działa automatycznie co godzinę i jest idempotentny (upsert). Manualny przycisk importu powinien być **opcjonalnym przyspieszeniem**, nie jedynym sposobem synchronizacji — inaczej ryzykujesz ten sam wzorzec błędu co bug D-5 w `PLAN_NAPRAWCZY.md` (dane puste, bo zależą od kroku, o którym nikt nie pamięta).

| Miejsce | Rola | Priorytet |
|---|---|---|
| **Ustawienia → sekcja „Integracje"** (nowa) | Status „Ostatnia synchronizacja: X temu" + przycisk „Synchronizuj teraz" (globalnie, bez wyboru daty) | **Główne miejsce** — realizuje zadanie 2.1 (zakładka Meta) z `PLAN_NAPRAWCZY.md` |
| **Ekran podsumowania treningu** (sekcja 5) | Mały link tekstowy pod przyciskiem „Zamknij”: „Zsynchronizuj teraz” (opcjonalny, nie blokujący) | Nice-to-have |
| **Historia → szczegóły sesji** | Ikona „Importuj ponownie tę sesję” — do naprawy pojedynczego przypadku (błąd importu, sesja sprzed konfiguracji pipeline'u) | Power-user / troubleshooting |

### 6.2 Sekcja „Integracje” w Ustawieniach — specyfikacja

Nowa `Card` w `app/(tabs)/settings/index.tsx`, pod sekcją „Powiadomienia”:

- Nagłówek: „Synchronizacja z Google Sheets”
- Wiersz statusu: ikona (`RefreshCw` gdy w trakcie, `CheckCircle2` gdy OK, `AlertCircle` gdy błąd) + tekst „Ostatnia synchronizacja: 12 min temu” / „Nigdy” / „Błąd — sprawdź połączenie”
- `Button` „Synchronizuj teraz” (`variant="secondary"`, `loading` podczas wywołania Edge Function)
- Drobny tekst pomocniczy: „Dane synchronizują się automatycznie co godzinę. Użyj tego przycisku, jeśli chcesz zobaczyć dzisiejszy trening w Gemie od razu.”

Dane o „ostatniej synchronizacji” najlepiej czerpać z przyszłej zakładki **Meta** (zadanie 2.1 z `PLAN_NAPRAWCZY.md`) — jeśli ta zakładka istnieje w arkuszu, Edge Function może ją odczytać i zwrócić do apki; jeśli nie, tymczasowo można zapisywać timestamp lokalnie po każdym udanym wywołaniu.

---

## 7. Priorytetowy plan wdrożenia (zaktualizowany 2026-08-12)

> **Logowanie ćwiczeń — zamrożone.** Poniżej tylko UI/UX. Szczegóły w `TODO.md` (sekcja CURRENT).

### Faza UI-A — szybkie poprawki
1. Napraw białą linię / szew tab bara (2.8) — przetestuj na Androidzie *(tab bar kolor: done)*
2. Dokończ `lineHeight` na kartach treningu i historii
3. Historia: objętość + czas na karcie sesji (4.4)
4. Home: polish wizualny ekranu freestyle

### Faza UI-B — aktywny trening
5. Ekran podsumowania po „Zakończ” (2.5, sekcja 5)
6. Haptics przy zapisie ćwiczenia (4.3)
7. BottomSheet na dłuższe uwagi (4.3)
8. *(Opcjonalnie)* Rest timer floating — tylko jeśli wróci w produkcie

### Faza UI-C — pozostałe zakładki
9. Rozbudowa Settings (4.6)
10. Pills + filtry w Stats (4.5)
11. Podsumowanie miesiąca w Historii (4.4)

### Faza UI-D — design system
12. `Toast`, `Badge` (sekcja 3) — `BottomSheet` i `Pills` ✅

### Faza UI-E — Integracje Google Sheets (§6)
13. Edge Function + sekcja Integracje w Ustawieniach (§6.0–6.2)
14. *(Opcjonalnie)* sync link na summary / re-import w Historii (§6.1)

### Przyszłość (osobny epik)
- **Zakładka Plany** — gotowe programy (stary model „Moje Plany” z Gemini §3)
- PowerSync, PR w Stats, swipe między tabami

---

## 6-legacy. Oryginalny plan (2026-03)

### Faza 1 — szybkie poprawki (bugfix, niski koszt, z `TODO.md`)
1. Napraw białą linię / niespójny kolor tab bara (2.8)
2. Popraw `lineHeight` nagłówków (2.8)
3. Usuń zduplikowany przycisk tworzenia planu na Home (2.2)
4. Zamień `onLongPress`-delete na `Menu` (3 kropki) na Home i History (2.1)

### Faza 2 — polish aktywnego treningu (najważniejszy ekran)
5. Rest Timer jako floating overlay (2.4)
6. Haptics przy zaliczaniu serii
7. Ujednolić inline-edit w `SetRow` na Sheet Detail (2.3)
8. Ekran podsumowania treningu (2.5, sekcja 5)

### Faza 3 — Ustawienia i konfiguracja
9. Rozbudowa Settings wg sekcji 4.6
10. Domyślny czas odpoczynku wpływający na `handleCompleteSet`

### Faza 4 — Statystyki i Historia
11. Filtry czasowe (Pills) w Statystykach
12. Wykres trendu dla pojedynczego ćwiczenia
13. Podsumowanie miesiąca w Historii

### Faza 5 — nice to have / większy zakres
14. `SwipeableRow` jako spójny wzorzec zamiast `Menu`
15. Rekordy osobiste (PR) na Stats
16. Wskaźnik trybu offline (PowerSync)

---

## 8. Jak używać tego dokumentu w Cursorze

**Prompt na UI polish (2026-08):**

> „Zaimplementuj Fazę UI-A z `docs/jj-workout-tool/UI_REDESIGN_PROPOSAL.md` §6. Nie zmieniaj logiki `ExerciseLogForm`, `saveExerciseLogBatch` ani flow freestyle. Tylko warstwa wizualna i UX.”

Dla konkretnego ekranu wklej sekcję **4.x**, np. 4.4 Historia — z zastrzeżeniem, że Home/plany (4.1–4.2) są nieaktualne.

Wdrażaj **fazami** (UI-A → UI-B → …), commit po każdej fazie.
