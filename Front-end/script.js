// Inicjalizacja mapy
let map;
try {
  map = L.map('map').setView([52.237, 21.017], 6); // Centrum Polski
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
} catch (e) {
  document.getElementById('map').innerHTML = '<div style="color:red;padding:2rem;">Nie udało się załadować mapy. Sprawdź połączenie z internetem lub Leaflet.js.</div>';
}

// Zmienne globalne
let userMarker = null;
let destinationMarker = null;
let routeLine = null;
let userLocation = null;

// Elementy DOM
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const routeInfo = document.getElementById('route-info');
const distanceElement = document.getElementById('distance');
const durationElement = document.getElementById('duration');
const startNavigationBtn = document.getElementById('start-navigation');
const userLocationElement = document.getElementById('user-location');
const locationCoords = document.getElementById('location-coords');
// Tryb podróży i motyw
const travelMode = document.getElementById('travel-mode');
const themeToggle = document.getElementById('theme-toggle');
const voiceBtn = document.getElementById('voice-btn');
const autocompleteList = document.getElementById('autocomplete-list');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const shareBtn = document.getElementById('share-btn');
const favBtn = document.getElementById('fav-btn');
const languageSwitch = document.getElementById('language-switch');
var historyList = document.getElementById('history-list');

// Spinner ładowania
const spinner = document.createElement('div');
spinner.id = 'spinner';
spinner.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;z-index:3000;background:rgba(255,255,255,0.7);font-size:2.5rem;display:none;';
spinner.innerHTML = '<div style="animation:spin 1s linear infinite;">⏳</div>';
document.body.appendChild(spinner);

function showSpinner() { spinner.style.display = 'flex'; }
function hideSpinner() { spinner.style.display = 'none'; }

// Motyw jasny/ciemny
function setTheme(dark) {
  document.body.classList.toggle('dark', dark);
  themeToggle.textContent = dark ? '☀️' : '🌙';
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  updateDayNightClass();
}

// Dodaj animowane boki do DOM
function injectAnimatedSides() {
  if (!document.querySelector('.animated-sides')) {
    const sides = document.createElement('div');
    sides.className = 'animated-sides';
    sides.innerHTML = '<div class="animated-side left"></div><div class="animated-side right"></div>';
    document.body.appendChild(sides);
  }
}
injectAnimatedSides();

// Ustaw klasę day/night na body w zależności od motywu
function updateDayNightClass() {
  if (document.body.classList.contains('dark')) {
    document.body.classList.add('night');
    document.body.classList.remove('day');
  } else {
    document.body.classList.add('day');
    document.body.classList.remove('night');
  }
}

// --- AUTO NIGHT MODE ---
const autoNightToggle = document.getElementById('auto-night-toggle');
let autoNight = localStorage.getItem('autoNight') === 'true';

function updateAutoNightUI() {
  autoNightToggle.checked = autoNight;
  themeToggle.disabled = autoNight;
  themeToggle.style.opacity = autoNight ? 0.5 : 1;
  themeToggle.style.cursor = autoNight ? 'not-allowed' : 'pointer';
}

function autoNightMode(force) {
  if (!autoNight && !force) return;
  const hour = new Date().getHours();
  // Noc: 20:00-6:00
  if (hour >= 20 || hour < 6) {
    setTheme(true);
  } else {
    setTheme(false);
  }
}

// Inicjalizacja motywu
const savedTheme = localStorage.getItem('theme');
if (!autoNight) setTheme(savedTheme === 'dark');
updateAutoNightUI();

// Obsługa przełącznika auto-noc
autoNightToggle.addEventListener('change', () => {
  autoNight = autoNightToggle.checked;
  localStorage.setItem('autoNight', autoNight);
  updateAutoNightUI();
  if (autoNight) {
    autoNightMode(true);
  } else {
    setTheme(localStorage.getItem('theme') === 'dark');
  }
});

// Przełącznik motywu (ręczny tylko gdy auto-noc wyłączony)
themeToggle.addEventListener('click', () => {
  if (autoNight) return;
  setTheme(!document.body.classList.contains('dark'));
});

// Automatyczny tryb nocny na podstawie godziny
if (autoNight) autoNightMode(true);
setInterval(() => { if (autoNight) autoNightMode(true); }, 60 * 1000);

// Pobierz lokalizację użytkownika
function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = [position.coords.latitude, position.coords.longitude];
        
        // Dodaj marker użytkownika
        if (userMarker) {
          map.removeLayer(userMarker);
        }
        
        userMarker = L.marker(userLocation)
          .addTo(map)
          .bindPopup("Twoja lokalizacja");
        
        map.flyTo(userLocation, 13);
        
        // Pokaż współrzędne
        userLocationElement.classList.remove('hidden');
        locationCoords.textContent = `${userLocation[0].toFixed(4)}, ${userLocation[1].toFixed(4)}`;
      },
      (error) => {
        console.error("Błąd geolokalizacji:", error);
        alert("Nie udało się pobrać Twojej lokalizacji. Upewnij się, że zezwoliłeś na dostęp do geolokalizacji.");
      }
    );
  } else {
    alert("Twoja przeglądarka nie wspiera geolokalizacji.");
  }
}

// Zmień trasę po zmianie trybu podróży
travelMode.addEventListener('change', () => {
  if (userLocation && destinationMarker) {
    drawRoute(userLocation, destinationMarker.getLatLng(), travelMode.value);
  }
});

// Wyszukiwanie miejsca
async function searchLocation() {
  const query = searchInput.value.trim();
  let destLat, destLon;
  if (searchInput.dataset.lat && searchInput.dataset.lon) {
    destLat = searchInput.dataset.lat;
    destLon = searchInput.dataset.lon;
  } else {
    // fallback: pobierz z Nominatim
    showSpinner();
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
    const data = await response.json();
    hideSpinner();
    if (data.length > 0) {
      destLat = data[0].lat;
      destLon = data[0].lon;
    } else {
      alert('Nie znaleziono miejsca.');
      return;
    }
  }
  const destination = [parseFloat(destLat), parseFloat(destLon)];
  // Usuń poprzedni marker celu
  if (destinationMarker) map.removeLayer(destinationMarker);
  destinationMarker = L.marker(destination).addTo(map).bindPopup(`<b>${query}</b>`).openPopup();
  // Dodaj POI w okolicy celu
  addPOIMarkers(destination, 2000);
  // Wyznacz trasę po drogach (OSRM)
  if (userLocation) {
    await drawRouteOSRM(userLocation, destination, travelMode.value);
  } else {
    map.flyTo(destination, 13);
  }
}

// Oblicz odległość w km (Haversine formula)
function calculateDistance(coord1, coord2) {
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;
  
  const R = 6371; // Promień Ziemi w km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Oblicz czas podróży w minutach (zależnie od trybu)
function calculateDuration(distanceKm, mode = 'car') {
  const speed = getSpeedByMode(mode); // km/h
  return Math.round((distanceKm / speed) * 60);
}

// --- NAWIGACJA KROK PO KROKU ---
let navigationInterval = null;
let navigationStep = 0;
let navigationRoute = null;

function startNavigation() {
  if (!userLocation || !destinationMarker || !navigationRoute) {
    alert("Najpierw wyznacz trasę i pozwól na dostęp do swojej lokalizacji.");
    return;
  }
  if (navigationInterval) clearInterval(navigationInterval);
  navigationStep = 0;
  map.flyTo(navigationRoute[0], 16);
  // Dodaj marker "start"
  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.marker(navigationRoute[0], {icon: L.divIcon({className:'',html:'<span style="color:#27ae60;font-size:1.7em;">🚶‍♂️</span>'})}).addTo(map).bindPopup('Start').openPopup();
  navigationInterval = setInterval(() => {
    navigationStep++;
    if (navigationStep >= navigationRoute.length) {
      clearInterval(navigationInterval);
      map.flyTo(navigationRoute[navigationRoute.length-1], 16);
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.marker(navigationRoute[navigationRoute.length-1], {icon: L.divIcon({className:'',html:'<span style="color:#e67e22;font-size:1.7em;">🏁</span>'})}).addTo(map).bindPopup('Cel').openPopup();
      alert('Dotarłeś do celu!');
      return;
    }
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker(navigationRoute[navigationStep], {icon: L.divIcon({className:'',html:'<span style="color:#27ae60;font-size:1.7em;">🚶‍♂️</span>'})}).addTo(map);
    map.panTo(navigationRoute[navigationStep]);
  }, 1200); // co 1.2 sekundy krok
}

// --- ZBIERANIE PUNKTÓW TRASY DO NAWIGACJI ---
async function drawRouteOSRM(start, end, mode = 'car') {
  showSpinner();
  let profile = 'driving';
  if (mode === 'walk') profile = 'foot';
  if (mode === 'bike') profile = 'bike';
  if (mode === 'bus') profile = 'driving';
  if (mode === 'train') profile = 'driving';
  if (mode === 'plane') {
    // Samolot: prosta linia, czas liczony po prostej
    hideSpinner();
    if (routeLine) map.removeLayer(routeLine);
    const latlngs = [start, end];
    routeLine = L.polyline(latlngs, {color:'#2986cc',weight:5,dashArray:'8 8'}).addTo(map);
    map.fitBounds(L.polyline(latlngs).getBounds());
    const distance = calculateDistance(start, end);
    const duration = calculateDuration(distance, 'plane');
    const now = new Date();
    const eta = new Date(now.getTime() + duration * 60 * 1000);
    const etaStr = eta.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    routeInfo.innerHTML = `
      <h3>Informacje o trasie</h3>
      <div class="info-row"><span class="info-icon">🕒</span> <span>Czas do celu:</span> <b>${duration} min</b></div>
      <div class="info-row"><span class="info-icon">📏</span> <span>Dystans:</span> <b>${distance.toFixed(1)} km</b></div>
      <div class="info-row"><span class="info-icon">⏰</span> <span>ETA:</span> <b>${etaStr}</b></div>
      <div class="info-row"><span class="info-icon">✈️</span> <span>Środek transportu:</span> <b>Samolot</b></div>
      <button id="start-navigation">Rozpocznij nawigację</button>
    `;
    routeInfo.classList.remove('hidden');
    document.getElementById('start-navigation').addEventListener('click', startNavigation);
    // Przygotuj trasę do nawigacji
    navigationRoute = [start, end];
    return;
  }
  const url = `https://router.project-osrm.org/route/v1/${profile}/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&alternatives=true&steps=true`;
  const resp = await fetch(url);
  const data = await resp.json();
  hideSpinner();
  if (!data.routes || !data.routes[0]) {
    alert('Nie udało się wyznaczyć trasy.');
    return;
  }
  let route = data.routes[0];
  let alternatives = data.routes.slice(1);
  if (routeLine) map.removeLayer(routeLine);
  let color = mode === 'train' ? '#2ecc40' : (mode === 'bus' ? '#e67e22' : (mode === 'bike' ? '#27ae60' : (mode === 'walk' ? '#8e44ad' : '#2563eb')));
  routeLine = L.geoJSON(route.geometry, {color, weight: 5}).addTo(map);
  map.fitBounds(L.geoJSON(route.geometry).getBounds());
  const now = new Date();
  const eta = new Date(now.getTime() + route.duration * 1000);
  const etaStr = eta.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  let remaining = Math.round(route.duration/60);
  let obstacles = [], radars = [];
  if (route.legs && route.legs[0] && route.legs[0].steps) {
    for (const step of route.legs[0].steps) {
      if (step.maneuver && step.maneuver.location && step.way_points) {
        if (step.way_points[0] % 3 === 0) obstacles.push(step.maneuver.location);
        if (step.way_points[0] % 5 === 0) radars.push(step.maneuver.location);
      }
    }
  }
  obstacles.forEach(loc => L.marker([loc[1], loc[0]], {icon: L.divIcon({className:'',html:'<span style="color:#f39c12;font-size:1.5em;">⚠️</span>'})}).addTo(map));
  radars.forEach(loc => L.marker([loc[1], loc[0]], {icon: L.divIcon({className:'',html:'<span style="color:#e74c3c;font-size:1.5em;">📸</span>'})}).addTo(map));
  // Dostępne środki transportu (symulacja)
  let available = ['car','walk','bike','bus','train'].filter(m=>{
    if (mode==='train') return m==='train';
    if (mode==='bus') return m!=='train';
    if (mode==='bike') return m!=='train'&&m!=='bus';
    if (mode==='walk') return m!=='train'&&m!=='bus';
    return true;
  });
  // Dodano: pokaż info o dostępnych i niedostępnych środkach transportu
  showTransportInfo(mode, available);
  // Dodano: zapisz trasę do historii tras
  saveRouteToHistory(start, end, mode, null);
  let transportIcons = available.map(m=>({car:'🚗',walk:'🚶‍♂️',bike:'🚲',bus:'🚌',train:'🚆'})[m]).join(' ');
  let altBtn = alternatives.length ? `<button class="change-route-btn" id="change-route">Zmień trasę (${alternatives.length})</button>` : '';
  routeInfo.innerHTML = `
    <h3>Informacje o trasie</h3>
    <div class="info-row"><span class="info-icon">🕒</span> <span>Czas do celu:</span> <b>${remaining} min</b></div>
    <div class="info-row"><span class="info-icon">📏</span> <span>Dystans:</span> <b>${(route.distance/1000).toFixed(1)} km</b></div>
    <div class="info-row"><span class="info-icon">⏰</span> <span>ETA:</span> <b>${etaStr}</b></div>
    <div class="info-row"><span class="info-icon">🚦</span> <span>Utrudnienia:</span> <b>${obstacles.length}</b></div>
    <div class="info-row"><span class="info-icon">📸</span> <span>Fotoradary:</span> <b>${radars.length}</b></div>
    <div class="info-row"><span class="info-icon">🚍</span> <span>Dostępne środki transportu:</span> <b>${transportIcons}</b></div>
    <button id="start-navigation">Rozpocznij nawigację</button>
    ${altBtn}
  `;
  routeInfo.classList.remove('hidden');
  document.getElementById('start-navigation').addEventListener('click', startNavigation);
  if (alternatives.length) {
    document.getElementById('change-route').addEventListener('click', () => {
      let alt = alternatives.shift();
      alternatives.push(route);
      route = alt;
      if (routeLine) map.removeLayer(routeLine);
      map.eachLayer(l => {
        if (l instanceof L.Marker && l !== userMarker && l !== destinationMarker) map.removeLayer(l);
      });
      let color2 = mode === 'train' ? '#2ecc40' : (mode === 'bus' ? '#e67e22' : (mode === 'bike' ? '#27ae60' : (mode === 'walk' ? '#8e44ad' : '#2563eb')));
      routeLine = L.geoJSON(route.geometry, {color: color2, weight: 5}).addTo(map);
      map.fitBounds(L.geoJSON(route.geometry).getBounds());
      const now2 = new Date();
      const eta2 = new Date(now2.getTime() + route.duration * 1000);
      const etaStr2 = eta2.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
      let remaining2 = Math.round(route.duration/60);
      let obstacles2 = [], radars2 = [];
      if (route.legs && route.legs[0] && route.legs[0].steps) {
        for (const step of route.legs[0].steps) {
          if (step.maneuver && step.maneuver.location && step.way_points) {
            if (step.way_points[0] % 3 === 0) obstacles2.push(step.maneuver.location);
            if (step.way_points[0] % 5 === 0) radars2.push(step.maneuver.location);
          }
        }
      }
      obstacles2.forEach(loc => L.marker([loc[1], loc[0]], {icon: L.divIcon({className:'',html:'<span style="color:#f39c12;font-size:1.5em;">⚠️</span>'})}).addTo(map));
      radars2.forEach(loc => L.marker([loc[1], loc[0]], {icon: L.divIcon({className:'',html:'<span style="color:#e74c3c;font-size:1.5em;">📸</span>'})}).addTo(map));
      let available2 = ['car','walk','bike','bus','train'].filter(m=>{
        if (mode==='train') return m==='train';
        if (mode==='bus') return m!=='train';
        if (mode==='bike') return m!=='train'&&m!=='bus';
        if (mode==='walk') return m!=='train'&&m!=='bus';
        return true;
      });
      let transportIcons2 = available2.map(m=>({car:'🚗',walk:'🚶‍♂️',bike:'🚲',bus:'🚌',train:'🚆'})[m]).join(' ');
      routeInfo.innerHTML = `
        <h3>Informacje o trasie</h3>
        <div class="info-row"><span class="info-icon">🕒</span> <span>Czas do celu:</span> <b>${remaining2} min</b></div>
        <div class="info-row"><span class="info-icon">📏</span> <span>Dystans:</span> <b>${(route.distance/1000).toFixed(1)} km</b></div>
        <div class="info-row"><span class="info-icon">⏰</span> <span>ETA:</span> <b>${etaStr2}</b></div>
        <div class="info-row"><span class="info-icon">🚦</span> <span>Utrudnienia:</span> <b>${obstacles2.length}</b></div>
        <div class="info-row"><span class="info-icon">📸</span> <span>Fotoradary:</span> <b>${radars2.length}</b></div>
        <div class="info-row"><span class="info-icon">🚍</span> <span>Dostępne środki transportu:</span> <b>${transportIcons2}</b></div>
        <button id="start-navigation">Rozpocznij nawigację</button>
        <button class="change-route-btn" id="change-route">Zmień trasę (${alternatives.length})</button>
      `;
      document.getElementById('start-navigation').addEventListener('click', startNavigation);
      document.getElementById('change-route').addEventListener('click', arguments.callee);
    });
  }
}

// --- SKRÓTY DO TRAS, POMOC, INFO O TRANSPORCIE ---
const routeShortcuts = document.getElementById('route-shortcuts');
const routeTransportInfo = document.getElementById('route-transport-info');
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeHelp = document.getElementById('close-help');

// Skróty do tras (ulubione, ostatnia, dom, praca)
const shortcuts = [
  {name:'Dom', icon:'🏠', key:'home'},
  {name:'Praca', icon:'💼', key:'work'},
  {name:'Ulubiona', icon:'★', key:'fav'},
  {name:'Ostatnia', icon:'⏪', key:'last'}
];
function renderShortcuts() {
  routeShortcuts.innerHTML = shortcuts.map(s => `<button class="shortcut-btn" data-key="${s.key}" title="${s.name}">${s.icon} ${s.name}</button>`).join(' ');
  document.querySelectorAll('.shortcut-btn').forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.key;
      let data = null;
      if (key==='last') data = JSON.parse(localStorage.getItem('lastRoute')||'null');
      else data = JSON.parse(localStorage.getItem('shortcut_'+key)||'null');
      if (data && data.start && data.end) {
        userLocation = data.start;
        drawRouteOSRM(data.start, data.end, data.mode||'car');
      } else {
        alert('Brak zapisanej trasy dla: '+s.name);
      }
    };
  });
}
renderShortcuts();

// Dodawanie do skrótów (przycisk ulubione, dom, praca)
document.getElementById('fav-btn').onclick = () => {
  if (!userLocation || !destinationMarker) return alert('Najpierw wyznacz trasę!');
  localStorage.setItem('shortcut_fav', JSON.stringify({start:userLocation, end:destinationMarker.getLatLng(), mode:travelMode.value}));
  alert('Dodano trasę do ulubionych!');
};
// Możesz dodać podobne przyciski do dom/praca w UI jeśli chcesz

// Pomoc - modal
helpBtn.onclick = () => helpModal.classList.remove('hidden');
closeHelp.onclick = () => helpModal.classList.add('hidden');
window.addEventListener('keydown', e => { if (!helpModal.classList.contains('hidden') && e.key==='Escape') helpModal.classList.add('hidden'); });

// Info o dostępnych i niedostępnych środkach transportu
function showTransportInfo(mode, available) {
  const all = ['car','walk','bike','bus','train'];
  const icons = {car:'🚗',walk:'🚶‍♂️',bike:'🚲',bus:'🚌',train:'🚆'};
  let info = '<b>Dostępne:</b> ' + available.map(m=>icons[m]+" "+m).join(', ');
  let not = all.filter(m=>!available.includes(m));
  if (not.length) info += '<br><b>Niedostępne:</b> ' + not.map(m=>icons[m]+" "+m).join(', ');
  routeTransportInfo.innerHTML = info;
}

// --- FILTROWANIE I UKRYWANIE POI ---
const poiLayerGroups = {
  shop: L.layerGroup().addTo(map),
  fuel: L.layerGroup().addTo(map),
  hospital: L.layerGroup().addTo(map),
  mall: L.layerGroup().addTo(map),
  hairdresser: L.layerGroup().addTo(map),
  restaurant: L.layerGroup().addTo(map)
};

function clearPOILayers() {
  Object.values(poiLayerGroups).forEach(g => g.clearLayers());
}

async function addPOIMarkers(center, radius = 2000) {
  clearPOILayers();
  const categories = [
    {key: 'restaurant', icon: '🍽️', color: '#e67e22', label: 'Restauracja', query: 'amenity=restaurant'},
    {key: 'fuel', icon: '⛽', color: '#27ae60', label: 'Stacja benzynowa', query: 'amenity=fuel'},
    {key: 'shop', icon: '🛒', color: '#2563eb', label: 'Sklep', query: 'shop=supermarket'},
    {key: 'hospital', icon: '🏥', color: '#e74c3c', label: 'Szpital', query: 'amenity=hospital'},
    {key: 'mall', icon: '🛍️', color: '#8e44ad', label: 'Galeria handlowa', query: 'shop=mall'},
    {key: 'hairdresser', icon: '💇‍♂️', color: '#f39c12', label: 'Salon fryzjerski', query: 'shop=hairdresser'}
  ];
  for (const cat of categories) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&${cat.query}&limit=15&viewbox=${center[1]-0.02},${center[0]-0.01},${center[1]+0.02},${center[0]+0.01}`;
    try {
      const resp = await fetch(url);
      const data = await resp.json();
      data.forEach(item => {
        const marker = L.marker([item.lat, item.lon], {
          icon: L.divIcon({className:'',html:`<span style='font-size:1.5em;color:${cat.color};'>${cat.icon}</span>`})
        }).bindPopup(`<b>${cat.label}</b><br>${item.display_name}`);
        poiLayerGroups[cat.key].addLayer(marker);
      });
    } catch {}
  }
  updatePOIFilters();
}

function updatePOIFilters() {
  const filters = {
    shop: document.getElementById('filter-shop').checked,
    fuel: document.getElementById('filter-fuel').checked,
    hospital: document.getElementById('filter-hospital').checked,
    mall: document.getElementById('filter-mall').checked,
    hairdresser: document.getElementById('filter-hairdresser').checked,
    restaurant: true // zawsze widoczne
  };
  Object.entries(filters).forEach(([key, show]) => {
    if (show) map.addLayer(poiLayerGroups[key]);
    else map.removeLayer(poiLayerGroups[key]);
  });
}

['filter-shop','filter-fuel','filter-hospital','filter-mall','filter-hairdresser'].forEach(id => {
  document.addEventListener('change', e => {
    if (e.target && e.target.id === id) updatePOIFilters();
  });
});

// --- POI: RESTAURACJE, STACJE PALIW, SKLEPY, SZPITALE, GALERIE, FRYZJERSKIE ---
async function addPOIMarkers(center, radius = 2000) {
  clearPOILayers();
  const categories = [
    {key: 'restaurant', icon: '🍽️', color: '#e67e22', label: 'Restauracja', query: 'amenity=restaurant'},
    {key: 'fuel', icon: '⛽', color: '#27ae60', label: 'Stacja benzynowa', query: 'amenity=fuel'},
    {key: 'shop', icon: '🛒', color: '#2563eb', label: 'Sklep', query: 'shop=supermarket'},
    {key: 'hospital', icon: '🏥', color: '#e74c3c', label: 'Szpital', query: 'amenity=hospital'},
    {key: 'mall', icon: '🛍️', color: '#8e44ad', label: 'Galeria handlowa', query: 'shop=mall'},
    {key: 'hairdresser', icon: '💇‍♂️', color: '#f39c12', label: 'Salon fryzjerski', query: 'shop=hairdresser'}
  ];
  for (const cat of categories) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&${cat.query}&limit=15&viewbox=${center[1]-0.02},${center[0]-0.01},${center[1]+0.02},${center[0]+0.01}`;
    try {
      const resp = await fetch(url);
      const data = await resp.json();
      data.forEach(item => {
        const marker = L.marker([item.lat, item.lon], {
          icon: L.divIcon({className:'',html:`<span style='font-size:1.5em;color:${cat.color};'>${cat.icon}</span>`})
        }).bindPopup(`<b>${cat.label}</b><br>${item.display_name}`);
        poiLayerGroups[cat.key].addLayer(marker);
      });
    } catch {}
  }
  updatePOIFilters();
}

// Wywołuj po wyznaczeniu trasy lub kliknięciu na mapie:
// addPOIMarkers(destination, 2000);

// Event listeners
searchBtn.addEventListener('click', searchLocation);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchLocation();
});
startNavigationBtn.addEventListener('click', startNavigation);

// Inicjalizacja - pobierz lokalizację użytkownika przy starcie
getUserLocation();

// Autouzupełnianie celu (Nominatim)
let autocompleteTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(autocompleteTimeout);
  const query = searchInput.value.trim();
  if (!query) {
    autocompleteList.classList.remove('active');
    autocompleteList.innerHTML = '';
    return;
  }
  autocompleteTimeout = setTimeout(async () => {
    showSpinner();
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`);
    const data = await resp.json();
    hideSpinner();
    if (data.length > 0) {
      autocompleteList.innerHTML = data.map((item, idx) => `<div class="autocomplete-item" data-lat="${item.lat}" data-lon="${item.lon}" tabindex="0">${item.display_name}</div>`).join('');
      autocompleteList.classList.add('active');
    } else {
      autocompleteList.innerHTML = '<div class="autocomplete-item">Brak wyników</div>';
      autocompleteList.classList.add('active');
    }
  }, 300);
});

autocompleteList.addEventListener('click', e => {
  if (e.target.classList.contains('autocomplete-item') && e.target.dataset.lat) {
    searchInput.value = e.target.textContent;
    autocompleteList.classList.remove('active');
    autocompleteList.innerHTML = '';
    searchInput.dataset.lat = e.target.dataset.lat;
    searchInput.dataset.lon = e.target.dataset.lon;
    searchBtn.click();
  }
});

document.addEventListener('click', e => {
  if (!autocompleteList.contains(e.target) && e.target !== searchInput) {
    autocompleteList.classList.remove('active');
  }
});

// Legenda: chowanie/pokazywanie
const legend = document.getElementById('legend');
const legendToggle = document.getElementById('legend-toggle');
const legendShow = document.getElementById('legend-show');
legendToggle.addEventListener('click', () => {
  legend.classList.add('hide');
});
legendShow.addEventListener('click', () => {
  legend.classList.remove('hide');
});

// Historia wyszukiwania
var historyList = document.getElementById('history-list');

function addToHistory(query) {
  let hist = JSON.parse(localStorage.getItem('history')||'[]');
  hist = hist.filter(item => item !== query); // unikaj duplikatów
  hist.unshift(query);
  if (hist.length>10) hist = hist.slice(0,10);
  localStorage.setItem('history', JSON.stringify(hist));
}

searchInput.addEventListener('focus', () => {
  let hist = JSON.parse(localStorage.getItem('history')||'[]');
  if (hist.length) {
    historyList.innerHTML = hist.map(f=>`<div class="history-item">${f}</div>`).join('');
    historyList.classList.add('active');
  }
});
searchInput.addEventListener('blur', () => {
  setTimeout(()=>historyList.classList.remove('active'), 200);
});
document.addEventListener('click', e => {
  if (!historyList.contains(e.target) && e.target !== searchInput) {
    historyList.classList.remove('active');
  }
});
historyList.addEventListener('click', e => {
  if (e.target.classList.contains('history-item')) {
    searchInput.value = e.target.textContent;
    historyList.classList.remove('active');
    searchBtn.click();
  }
});
searchBtn.addEventListener('click', () => {
  const query = searchInput.value.trim();
  if (query) addToHistory(query);
});

// --- HISTORIA WYSZUKIWANYCH TRAS ---
const showHistoryBtn = document.getElementById('show-history-btn');
const historyModal = document.getElementById('history-modal');
const closeHistory = document.getElementById('close-history');
const historyRoutesList = document.getElementById('history-routes-list');

function saveRouteToHistory(start, end, mode, label) {
  let hist = JSON.parse(localStorage.getItem('routesHistory')||'[]');
  const entry = {start, end, mode, label: label||null, date: new Date().toLocaleString()};
  hist.unshift(entry);
  if (hist.length>15) hist = hist.slice(0,15);
  localStorage.setItem('routesHistory', JSON.stringify(hist));
}

function renderRoutesHistory() {
  let hist = JSON.parse(localStorage.getItem('routesHistory')||'[]');
  if (!hist.length) {
    historyRoutesList.innerHTML = '<div style="color:#888;">Brak zapisanych tras.</div>';
    return;
  }
  historyRoutesList.innerHTML = hist.map((r,i)=>
    `<div class="history-route-item" style="padding:8px 0;border-bottom:1px solid #eee;cursor:pointer;" data-idx="${i}">
      <b>${r.label?r.label:'Trasa '+(i+1)}</b><br>
      <span style="font-size:0.95em;">${r.start?`${r.start[0].toFixed(4)},${r.start[1].toFixed(4)}`:''} → ${r.end?`${r.end[0].toFixed(4)},${r.end[1].toFixed(4)}`:''} (${r.mode})</span><br>
      <span style="font-size:0.85em;color:#888;">${r.date}</span>
    </div>`
  ).join('');
  document.querySelectorAll('.history-route-item').forEach(item => {
    item.onclick = () => {
      const idx = +item.dataset.idx;
      const r = hist[idx];
      if (r && r.start && r.end) {
        userLocation = r.start;
        drawRouteOSRM(r.start, r.end, r.mode||'car');
        historyModal.classList.add('hidden');
      }
    };
  });
}

showHistoryBtn.onclick = () => {
  renderRoutesHistory();
  historyModal.classList.remove('hidden');
};
closeHistory.onclick = () => historyModal.classList.add('hidden');
window.addEventListener('keydown', e => { if (!historyModal.classList.contains('hidden') && e.key==='Escape') historyModal.classList.add('hidden'); });

// Dodaj do historii tras po wyznaczeniu trasy
// W drawRouteOSRM po wyznaczeniu trasy:
// saveRouteToHistory(start, end, mode, null);

// --- WYSZUKIWANIE GŁOSOWE ---
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'pl-PL';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  voiceBtn.addEventListener('click', () => {
    recognition.start();
    voiceBtn.textContent = '🎤...';
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    searchInput.value = transcript;
    voiceBtn.textContent = '🎤';
    searchBtn.click();
  };
  recognition.onerror = (event) => {
    voiceBtn.textContent = '🎤';
    alert('Błąd rozpoznawania mowy: ' + event.error);
  };
  recognition.onend = () => {
    voiceBtn.textContent = '🎤';
  };
} else {
  voiceBtn.disabled = true;
  voiceBtn.title = 'Twoja przeglądarka nie obsługuje rozpoznawania mowy';
}

// --- PEŁNY EKRAN ---
fullscreenBtn.addEventListener('click', () => {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  }
});

// --- DZIELNICE DO MIAST ---
const cityDistricts = {
  'Warszawa': ['Śródmieście', 'Mokotów', 'Wola', 'Praga-Północ', 'Praga-Południe', 'Bielany', 'Ursynów', 'Ochota', 'Żoliborz', 'Targówek', 'Bemowo', 'Wawer', 'Wilanów', 'Rembertów', 'Ursus', 'Wesoła', 'Białołęka'],
  'Kraków': ['Stare Miasto', 'Podgórze', 'Nowa Huta', 'Krowodrza', 'Prądnik Biały', 'Prądnik Czerwony', 'Czyżyny', 'Dębniki', 'Bieżanów-Prokocim', 'Swoszowice', 'Bronowice', 'Łagiewniki-Borek Fałęcki'],
  'Łódź': ['Bałuty', 'Górna', 'Polesie', 'Śródmieście', 'Widzew'],
  'Wrocław': ['Stare Miasto', 'Śródmieście', 'Krzyki', 'Psie Pole', 'Fabryczna'],
  'Poznań': ['Stare Miasto', 'Nowe Miasto', 'Jeżyce', 'Grunwald', 'Wilda', 'Chartowo', 'Rataje'],
  'Gdańsk': ['Śródmieście', 'Wrzeszcz', 'Oliwa', 'Przymorze', 'Zaspa', 'Orunia', 'Chełm', 'Ujeścisko-Łostowice', 'Letnica'],
  'Szczecin': ['Śródmieście', 'Prawobrzeże', 'Zachód', 'Północ', 'Dąbie', 'Gumieńce'],
  'Katowice': ['Śródmieście', 'Ligota-Panewniki', 'Załęże', 'Dąb', 'Bogucice', 'Szopienice-Burowiec', 'Janów-Nikiszowiec', 'Giszowiec', 'Piotrowice-Ochojec'],
  'Lublin': ['Śródmieście', 'Czechów', 'Węglin', 'Bronowice', 'Tatary', 'Dziesiąta', 'Ponikwoda', 'Rury'],
  'Bydgoszcz': ['Śródmieście', 'Fordon', 'Szwederowo', 'Wyżyny', 'Błonie', 'Bartodzieje', 'Górzyskowo', 'Leśne']
};

// Funkcja do pobierania dzielnic po nazwie miasta
function getDistrictsForCity(city) {
  return cityDistricts[city] || [];
}

// Dodaj tryb samolotu do getSpeedByMode
function getSpeedByMode(mode) {
  if (mode === 'car') return 50;
  if (mode === 'walk') return 5;
  if (mode === 'bike') return 15;
  if (mode === 'bus') return 30;
  if (mode === 'train') return 90;
  if (mode === 'plane') return 800; // Samolot: 800 km/h
  return 50;
}
