# 🛒 ShopPanel — Panel Zarządzania Sklepem (Ja & Patryk)

Nowoczesny, responsywny i lekki system zarządzania sklepem dla wspólników (spółka 50/50). Umożliwia pełną kontrolę nad stanem magazynowym, kalkulacją marż, sprzedażą, kosztami operacyjnymi, równym podziałem zysku, inwestycjami oraz wspólnymi zadaniami To-Do.

Aplikacja działa w modelu hybrydowym:
* **Online (Vercel + GitHub Gist API)** — pełna synchronizacja danych w czasie rzeczywistym między urządzeniami wspólników z bezpieczną autoryzacją JWT.
* **Offline / Standalone (lokalnie w przeglądarce)** — natychmiastowe działanie bez konieczności instalowania czegokolwiek (dane zapisywane w `localStorage`, fallback kryptograficzny Web Crypto API).

---

## 🚀 Główne moduły i funkcjonalności

- **🔐 Bezpieczny system logowania i profile użytkowników**:
  - Dedykowane role: **Administrator** (pełne uprawnienia) oraz **Wspólnik / Pracownik**.
  - Zabezpieczenie haseł zaawansowanym algorytmem PBKDF2 (SHA-512, 100 000 iteracji z unikalną solą kryptograficzną).
  - Domyślne konto administratora: login: `admin`, hasło: `admin123` (lub własne ustawione w zmiennych środowiskowych).
  - Możliwość tworzenia dedykowanych kont dla wspólników (np. *Ja*, *Patryk*) w panelu administratora.
  - Automatyczne przypisywanie sprzedawcy przy dodawaniu transakcji i autora w notatkach.

- **📊 Dashboard & Analityka**:
  - Podsumowanie przychodów brutto, kosztów zakupu towaru (COGS), kosztów operacyjnych i czystego zysku netto.
  - Interaktywny wykres sprzedaży i zysków w ujęciu dziennym.
  - Podgląd potencjalnego zysku zamrożonego w towarze na magazynie.
  - Alerty magazynowe: natychmiastowe ostrzeżenia o brakach towaru lub niskim stanie.

- **📦 Magazyn i kalkulator marży**:
  - Ewidencja asortymentu: cena zakupu, sugerowana cena sprzedaży, marża jednostkowa (%) i całkowity zysk potencjalny.
  - Błyskawiczne korekty stanu magazynowego (`+` / `-`).
  - Przycisk szybkiej rejestracji sprzedaży prosto z wiersza magazynu.
  - Filtrowanie po kategoriach oraz wyszukiwarka.

- **💳 Sprzedaż**:
  - Rejestr transakcji z przypisaniem do sprzedawcy (*Ja* / *Patryk*).
  - Automatyczne wyliczanie zysku transakcyjnego oraz odejmowanie sprzedanych sztuk ze stanu magazynowego.
  - Filtry po dacie, sprzedawcy oraz wyszukiwanie.

- **💰 Finanse & Koszty operacyjne**:
  - Rejestr wydatków (marketing, opakowania, wysyłka, oprogramowanie itp.).
  - Bilans zysku netto wg wzoru:  
    $$\text{Zysk netto} = \text{Przychód} - \text{COGS (koszt sprzedanych sztuk)} - \text{Koszty operacyjne}$$

- **🤝 Podział Zysku (50/50) & Wypłaty**:
  - Kafelki podsumowujące: łączny zysk netto, równy udział przypadający na każdego wspólnika (50%), suma wypłaconych zaliczek oraz stan wolnych środków w kasie.
  - Rejestr wypłat gotówki i zaliczek wraz z datą, odbiorcą i notatką.

- **📈 Inwestycje kapitałowe**:
  - Ewidencja wkładu finansowego wspólników w rozwój sklepu.
  - Śledzenie statusu inwestycji (aktywna / zakończona) oraz zwrotu z kapitału (ROI).

- **📝 Notatnik i checklisty To-Do**:
  - Interaktywne checklisty zadań: wiersze zaczynające się od `[ ]` lub `[x]` stają się klikalnymi polami wyboru w czasie rzeczywistym.
  - Kategoryzacja kolorystyczna, przypinanie ważnych notatek pinezką (📌) na samej górze oraz szybkie kopiowanie do schowka.

- **👥 Zarządzanie użytkownikami (Panel Admina)**:
  - Bezpieczne dodawanie i usuwanie kont dla personelu lub wspólników.

- **📋 Historia operacji (Audit Log)**:
  - Rejestr wszystkich zdarzeń: logowania, zmiany magazynowe, transakcje, koszty, wypłaty.

---

## 💻 Uruchomienie lokalne (Tryb Standalone / Offline)

1. Otwórz plik `index.html` bezpośrednio w dowolnej przeglądarce internetowej (Chrome, Edge, Firefox).
2. Zaloguj się domyślnym kontem administratora:
   * **Login:** `admin`
   * **Hasło:** `admin123`
3. Przejdź do zakładki **Użytkownicy** i utwórz własne konta dla wspólników (np. *Ja*, *Patryk*).
4. Wszystkie dane są bezpiecznie zapisywane w pamięci przeglądarki (`localStorage`).

---

## ☁️ Wdrożenie w chmurze (Vercel + GitHub Gist)

Projekt jest w 100% dostosowany do platformy **Vercel**:
* Pliki statyczne (`index.html`, `app.js`, `style.css`) są serwowane bezpośrednio.
* Folder `/api` zawiera funkcje Serverless Node.js obsługujące autentykację JWT oraz synchronizację bazy danych.

### Konfiguracja zmiennych środowiskowych (Vercel Environment Variables):

W panelu Vercela w zakładce **Settings ➔ Environment Variables** dodaj:

| Zmienna | Wymagana | Opis |
| :--- | :---: | :--- |
| `SHOPPANEL_GH_TOKEN` | **Tak** | Twój osobisty token z GitHuba (Classic PAT z uprawnieniem `gist`). |
| `SHOPPANEL_GIST_ID` | Opcjonalnie | ID Gista z danymi (domyślnie używany jest skonfigurowany Gist). |
| `SHOPPANEL_SECRET` | **Tak** | Długi losowy ciąg znaków do podpisywania tokenów JWT sesji. |
| `ADMIN_PASSWORD` | Opcjonalnie | Własne hasło dla konta `admin` (jeśli nie podasz, działa domyślne `admin123`). |

> **Ważne zalecenie bezpieczeństwa:** Nigdy nie wpisuj tokenu GitHuba ani sekretów bezpośrednio do plików kodu źródłowego. Zawsze korzystaj ze zmiennych środowiskowych!

---

## 📱 Instalacja jako aplikacja (PWA) na iOS i Android

ShopPanel jest pełnoprawną aplikacją **PWA (Progressive Web App)**. Posiada dedykowany dolny pasek nawigacyjny, obsługę Safe Area (wycięcia w ekranie iPhone'a / Dynamic Island) oraz działa w trybie pełnoekranowym bez pasków przeglądarki.

### 🍏 iPhone / iPad (iOS Safari):
1. Otwórz wdrożony panel w przeglądarce **Safari**.
2. Kliknij ikonę **Udostępnij** (kwadrat ze strzałką w górę na dole ekranu).
3. Przewiń w dół i wybierz **„Do ekranu początkowego”** (ikona `➕`).
4. Zatwierdź klikając **„Dodaj”** w prawym górnym rogu.
5. Na pulpicie pojawi się ikona **ShopPanel** – po kliknięciu uruchamia się jak natywna aplikacja bez pasków Safari!

### 🤖 Android (Google Chrome / Edge):
1. Otwórz wdrożony panel w przeglądarce **Chrome**.
2. Kliknij wyskakujący na dole pasek **„Dodaj 📲”** lub kliknij menu z trzema kropkami (`⋮`) w prawym górnym rogu.
3. Wybierz opcję **„Zainstaluj aplikację”** (lub **„Dodaj do ekranu głównego”**).
4. Gotowe! Aplikacja zintegruje się z systemem Android i z szufladą aplikacji.

---

## 🚀 Wypychanie zmian na GitHub

W repozytorium znajduje się ulepszony skrypt:
* `wypchnij_na_githuba.bat` — automatycznie wykrywa instalację programu Git na komputerze, prosi o opis commita i wysyła zmiany na gałąź `main`.
