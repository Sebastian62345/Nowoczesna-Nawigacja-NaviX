# NaviX – Nowoczesna aplikacja nawigacyjna 

NaviX to nowoczesna, responsywna aplikacja webowa do nawigacji po Polsce i Europie, stworzona w HTML, CSS i JavaScript z wykorzystaniem Leaflet oraz OSRM.

## Funkcje
- Interaktywna mapa Leaflet
- Wyszukiwanie celu (Nominatim) z autouzupełnianiem i historią
- Wyznaczanie tras po drogach (OSRM), alternatywne trasy, zmiana trasy
- Tryby transportu: samochód, pieszo, rower, autobus, pociąg, samolot
- Panel trasy: ETA, dystans, czas, liczba utrudnień i fotoradarów (symulacja)
- Legenda z ikonami, możliwość chowania/pokazywania
- Tryb ciemny/jasny, automatyczny tryb nocny
- Obsługa offline (Service Worker)
- Głosowe wyszukiwanie (Web Speech API)
- Udostępnianie trasy, ulubione, pełny ekran, przełącznik języka (PL/EN)
- Animacje, spinner ładowania, kliknięcie na mapie jako cel
- Historia wyszukiwań i tras
- Wyświetlanie POI: restauracje, sklepy, stacje benzynowe, szpitale, galerie, salony fryzjerskie
- Filtrowanie/ukrywanie POI na mapie

## Pliki
- `index.html` – główny plik aplikacji
- `style.css` – nowoczesny, responsywny styl
- `script.js` – cała logika nawigacji, mapy, tras, POI, trybów, historii itd.
- `sw.js` – Service Worker do obsługi offline

## Uruchomienie
1. Otwórz `index.html` w przeglądarce (zalecany Chrome lub Edge)
2. Aplikacja działa w pełni po stronie frontendowej, nie wymaga backendu
3. Do działania offline wymagane jest uruchomienie przez serwer lokalny (np. `npx serve .` lub `python -m http.server`)

## Wymagania
- Nowoczesna przeglądarka (Chrome, Edge, Firefox)
- Dostęp do internetu (do pobierania map i tras, tryb offline ograniczony)

## Autor
Sebastian Woźniak nr albumu:159851
