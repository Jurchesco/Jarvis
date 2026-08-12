# Propozycja Interfejsu (UI/UX) dla JJ Workout Tool

> **Stan na 2026-08-12:** Ten dokument opisuje **docelową wizję UX** (ciemny motyw, one-thumb, tabele serii). **Obecna aplikacja** działa w trybie **freestyle** — patrz `ARCHITECTURE.md` i sekcja *Mapowanie* poniżej. Kolejny sprint = **UI polish** wg `UI_REDESIGN_PROPOSAL.md` §6 (UI-A…UI-D), **bez** zmian logiki logowania ćwiczeń.

## Mapowanie: wizja Gemini → stan obecny

| Gemini (sekcja) | Obecny stan | UI polish (następny krok) |
|-----------------|-------------|---------------------------|
| §3 Home „Moje Plany” | **Freestyle** — jeden CTA „Rozpocznij trening” | Polish ekranu startowego (UI-A) |
| §4 Sheet Details | **Wyłączone** (redirect Home) | Osobna zakładka „Plany” w przyszłości |
| §5 Active Session | **Inny model:** formularz zbiorczy (serie+kg+powt.), live stats, katalog | Summary po treningu, haptics, BottomSheet uwag (UI-B) |
| §5 Rest Timer | **Wyłączony** | Opcjonalny powrót jako overlay |
| §5 Tabela serii wiersz-po-wierszu | **Zastąpione** `ExerciseLogForm` | Nie wracać do per-set bez decyzji produktowej |
| §6 Historia | Kalendarz + lista (data, nazwa) | + objętość, czas, streak (UI-C) |
| §7 Stats | Wykresy (ostatnie 10 sesji) | Filtry Pills, wykres per ćwiczenie (UI-C) |
| §8 Settings | Minimalne | Pełna spec w `UI_REDESIGN_PROPOSAL.md` §4.6 |

---

Poniżej znajduje się kompleksowa propozycja przejrzystego i wygodnego interfejsu dla aplikacji JJ Workout Tool. Projekt został przemyślany pod kątem użytkowania na siłowni – z naciskiem na ciemny motyw (oszczędność baterii i wzroku), duże obszary klikalne (tzw. tap targets) ułatwiające obsługę spoconymi dłońmi oraz minimalną liczbę kliknięć potrzebnych do zapisania serii.

## 1. Zasadnicze wytyczne UX dla środowiska treningowego

*   **Dark Mode First:** Główny motyw powinien być ciemny (`bg-background` np. `#121212` lub głęboki granat). Kontrastowe przyciski (`bg-action-primary` np. jaskrawy niebieski lub neonowa zieleń) stosowane tylko do głównych akcji ("Rozpocznij", "Zapisz").
*   **One-Thumb Usage:** Większość kluczowych akcji (dodawanie serii, odhaczanie, start timera) powinna znajdować się w dolnej/środkowej części ekranu – w zasięgu kciuka operującego jedną ręką (drugą często trzymasz sprzęt, butelkę lub ręcznik).
*   **Minimalizm & Duże Fonty:** Na siłowni nie ma czasu na precyzyjne celowanie w małe ikony. Pola tekstowe (Inputs) na ciężary i powtórzenia muszą być duże i łatwe w trafieniu palcem.
*   **Haptic Feedback:** Każde zatwierdzenie serii (checkbox) powinno wywoływać wibrację telefonu, co daje fizyczne potwierdzenie bez dokładnego patrzenia w ekran.
*   **Bezpieczne wyjścia:** Akcje takie jak "Usuń plan" lub "Zakończ trening" zawsze chronione okienkiem dialogowym (Alert).

---

## 2. Nawigacja Główna (Bottom Tab Bar)

Klasyczny, przyklejony do dołu pasek nawigacyjny. Ikony (Lucide Icons):
1.  **Plany (Home)** - Ikona `Dumbbell` lub `ClipboardList`. Widok startowy.
2.  **Historia** - Ikona `History`. Zakończone treningi i ich szczegóły.
3.  **Statystyki** - Ikona `TrendingUp` lub `BarChart2`. Analiza postępów.
4.  **Ustawienia** - Ikona `Settings` lub `User`.

*Zalecenie UI:* Aktywna karta ma mocniejszy akcent kolorystyczny (np. świecący `text-action-primary`), ikony pozbawione wypełnienia (outline) dla elegancji, brak zbędnych ramek dookoła ikon.

---

## 3. Ekran Główny: "Moje Plany" (Home)

**Cel:** Ultraszybki dostęp do rozpoczęcia treningu. Wchodzisz na siłownię, otwierasz aplikację, klikasz plan, zaczynasz.

*   **Nagłówek (Header):** Duży, czytelny napis "Twoje Plany" w lewym górnym rogu. Profilowane powitanie (np. "Cześć, Jakub").
*   **Karty Planów (Sheet Cards):**
    *   Duże kafle (`Card`, `rounded-2xl`, `bg-surface`).
    *   Pogrubiony tytuł planu (np. "Góra Ciała (Push)").
    *   Subtelny opis obok/pod tytułem: "6 ćwiczeń • Ost. trening: 3 dni temu".
    *   Karta posiada cień na krawędzi (elevation).
    *   Cała powierzchnia karty prowadzi do widoku szczegółów planu.
*   **Floating Action Button (FAB):** Okrągły, bardzo kontrastowy przycisk `+` (lub przycisk z tekstem `+ Nowy Plan`) unoszący się nad listą w prawym dolnym rogu.

---

## 4. Ekran Szczegółów Planu (Sheet Details)

**Cel:** Szybki przegląd struktury treningu oraz jego modyfikacja (zanim go rozpoczniesz).

*   **Nagłówek:** Tytuł planu, po lewej przycisk `ArrowLeft`, po prawej przycisk ukrytego menu (trzy kropki) z opcjami: "Zmień nazwę", "Usuń plan".
*   **Lista Ćwiczeń:**
    *   Każdy wiersz to ćwiczenie (z wyraźną, małą ikoną uchwytu "Drag" po prawej stronie, aby szybko zmieniać kolejność).
    *   Wyświetla podgląd domyślnych obciążeń (np. "Wyciskanie sztangi: 3 serie x 10-12").
    *   Subtelny przycisk na końcu listy: `+ Dodaj ćwiczenie`.
*   **Sticky Footer (Fixed na dole):**
    *   Masywny, rzucający się w oczy przycisk "Rozpocznij Trening" (`bg-action-primary`). Wypełniający niemal 100% szerokości ekranu, na delikatnie rozmazanym tle (blur effect/gradient), aby nie zasłaniać scrollowanej listy do końca, ale by był zawsze pod kciukiem.

---

## 5. Ekran Aktywnego Treningu (Active Session) – NAJWAŻNIEJSZY!

**Cel:** Logowanie danych w jak najprostszy sposób. Płynne poleganie na autouzupełnianiu.

**Układ interfejsu (Vertical Scroll):**
*   **Górny pasek (Sticky):** Tytuł planu, mały stoper pokazujący aktualny czas trwania (np. `45:12`) oraz przycisk "Zakończ".
*   **Bloki Ćwiczeń:** Trening składa się z poukładanych jeden pod drugim kafelków (bloków) reprezentujących ćwiczenia.

**Wnętrze Bloku Ćwiczenia (Ćwiczenie Card):**
*   **Nagłówek:** Tytuł (np. "Wyciskanie Żołnierskie"), obok ikona "Notatki" `MessageSquare` (pojawia się czerwona kropka, jeśli notatka istnieje). Z prawej strony menu 3-kropek do zamiany/usunięcia ćwiczenia.
*   **Tabela Serii (Nagłówki kolumn):** `SERIA` | `POPRZEDNIO` | `KG` | `POWT.` | `ZALICZ`
*   **Wiersze (Serie):**
    *   **Seria:** Nr serii w małym, szarym kółku.
    *   **Poprzednio:** Jasnoszary tekst (np. `60kg x 8`). Jeśli to nowy wynik, widnieje `-`.
    *   **KG i Powt.:** Szare, zintegrowane pola tekstowe (Inputs). Numeryczna klawiatura otwiera się od razu. Wartości powinny domyślnie autouzupełniać się tymi z poprzedniej serii lub poprzedniego treningu.
    *   **Zalicz:** Duży, okrągły checkbox (`CheckCircle`). Po kliknięciu:
        1. Cały wiersz przygasa (lekko wyszarzony, pokazując, że wykonane).
        2. Klawiatura (jeśli była otwarta) natychmiast zjeżdża w dół.
        3. Odpala się Haptic Feedback.
        4. Automatycznie wysuwa się "Rest Timer".
*   **Stopka Bloku:** Delikatny przycisk `+ Dodaj serię` dodający kolejny wiersz.

**Rest Timer (Global Overlay / Bottom Sheet):**
*   Wyjeżdża z dołu ekranu po zaliczeniu serii (lub pojawia się nad przyciskiem zakończenia).
*   Duży zegar odliczający w dół (np. `01:30`).
*   Przyciski po bokach: `-30s`, `+30s`. Przycisk z prawej strony "Pomiń" (Skip). Zegar wibruje 3 sekundy przed końcem.

**Przycisk Zakończenia:**
*   Na samym dole strony, czerwony `outline`, tekst "Zakończ Trening". Wyskakuje pop-up "Czy na pewno chcesz zakończyć i zapisać? [Tak] / [Nie]".

---

## 6. Ekran Historii (History)

**Cel:** Satysfakcja z logów i przegląd wykonanej pracy.

*   **Pasek Kalendarza (Top Horizontal Scroll):** Pasek z 7-14 ostatnimi dniami. Dni z treningiem mają np. zieloną kropeczkę pod spodem. Daje to fajny wizualny "streak" motywujący użytkownika.
*   **Lista (Vertical):** Ostatnie treningi od najnowszego w dół.
    *   **Karta z historią:** Data (np. "Wczoraj, 18:00"), Tytuł Planu ("Góra Ciała"), Czas trwania ("1h 10m"), Łączny podniesiony ciężar (Volume: "4,520 kg"), Liczba wykonanych ćwiczeń ("6 ćwiczeń, 18 serii").
    *   Możliwość wejścia w poszczególny wpis, co ukazuje zablokowany ekran z podglądem na to, co dokładnie zrobiono w tamtej sesji.

---

## 7. Ekran Statystyk (Stats)

**Cel:** Udowodnienie postępu w liczbach.

*   Górne przełączniki (Pills): `1 Miesiąc` | `3 Miesiące` | `6 Miesięcy` | `Wszystko`
*   Wykres objętości całkowitej na trening (Line/Bar chart).
*   Top ćwiczenia – wybór ćwiczenia z rozwijanej listy (np. "Martwy ciąg") wygeneruje wykres przedstawiający szacowany 1RM (1 Rep Max) lub maksymalny podniesiony ciężar w zadanym czasie.

---

## 8. Ekran Ustawień (Settings)

*   **Konto:** Nazwa, Adres E-mail (wyszarzony), przycisk "Wyloguj".
*   **Preferencje Treningowe:**
    *   "Domyślny czas odpoczynku" (Wybór: 1m, 1:30m, 2m, etc.)
    *   "Autouzupełniaj powtórzenia i ciężar z poprzedniego treningu" (Przełącznik/Toggle)
    *   "Dźwięk na koniec timera" (Toggle)
*   **Aplikacja:**
    *   Wybór motywu (Jasny, Ciemny, System)
    *   "O aplikacji" (Wersja 1.0)
