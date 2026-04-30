/* ─────────────────────────────────────────────────────────────
   BHUTAN FIRE HOTSPOT DENSITY MAP — app.js
   Leaflet.js map logic. Bootstrap template sidebar + controls.
   ───────────────────────────────────────────────────────────── */

// ── CONFIG: Update paths to match your local GeoJSON files ──
const DATA_FILES = {
  admin:    'data/bhutan_dzong_web.geojson',    // Dzongkhag boundaries
  hotspots: 'data/Bhutan_active_fire.geojson',  // Fire hotspot points
  density:  'data/density.geojson',             // District density (field: Density)
  hexGrid:  'data/hex_grid_json.geojson'        // Hex grid (field: fire_count)
};

// ── Layer References (global for sidebar control) ─────────────
let mapLayers = {};
let baseLayersMap = {};

// ── 1. Initialise Map ─────────────────────────────────────────
const map = L.map('map', {
  center: [27.5, 90.5],
  zoom: 8,
  zoomControl: false   // repositioned below
});

L.control.zoom({ position: 'bottomleft' }).addTo(map);

const AppFullscreenControl = L.Control.extend({
  options: { position: 'topleft' },

  onAdd: () => {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-fullscreen');
    const button = L.DomUtil.create('a', 'leaflet-control-fullscreen-button', container);

    button.href = '#';
    button.title = 'View full screen';
    button.setAttribute('role', 'button');
    button.innerHTML = '<i class="bi bi-arrows-fullscreen"></i>';

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(button, 'click', (event) => {
      L.DomEvent.preventDefault(event);
      toggleAppFullscreen();
    });

    return container;
  }
});

new AppFullscreenControl().addTo(map);

function toggleAppFullscreen() {
  const fullscreenRoot = document.body;

  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else if (fullscreenRoot.requestFullscreen) {
    fullscreenRoot.requestFullscreen();
  }
}

document.addEventListener('fullscreenchange', () => {
  const fullscreenButton = document.querySelector('.leaflet-control-fullscreen-button');

  if (fullscreenButton) {
    const isFullscreen = Boolean(document.fullscreenElement);
    fullscreenButton.title = isFullscreen ? 'Exit full screen' : 'View full screen';
    fullscreenButton.innerHTML = isFullscreen
      ? '<i class="bi bi-fullscreen-exit"></i>'
      : '<i class="bi bi-arrows-fullscreen"></i>';
  }

  setTimeout(() => map.invalidateSize(), 150);
});

// ── 2. Base Tile Layers ────────────────────────────────────────
baseLayersMap['satellite'] = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { attribution: 'Esri', maxZoom: 19 }
);

baseLayersMap['dark'] = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  { attribution: '&copy; CartoDB', maxZoom: 19 }
);

baseLayersMap['street'] = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }
);

baseLayersMap['satellite'].addTo(map);

// ── 3. Colour Scale Helpers ────────────────────────────────────
// YlOrRd (yellow → orange → red) — matches folium YlOrRd_09
function ylOrRd(t) {
  const stops = [
    [1.00, 255, 255, 178],
    [0.875,254, 217, 107],
    [0.75, 254, 178,  76],
    [0.625,253, 141,  60],
    [0.50, 252,  78,  42],
    [0.375,227,  26,  28],
    [0.25, 189,   0,  38],
    [0.00, 128,   0,  38]
  ];
  return interpolate(stops, t);
}

// PuRd (pink/purple) — matches folium PuRd_09
function puRd(t) {
  const stops = [
    [1.00, 247, 244, 249],
    [0.875,231, 225, 239],
    [0.75, 212, 185, 218],
    [0.625,201, 148, 199],
    [0.50, 223, 101, 176],
    [0.375,231,  41, 138],
    [0.25, 206,  18,  86],
    [0.00, 103,   0,  31]
  ];
  return interpolate(stops, t);
}

function interpolate(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t1, r1, g1, b1] = stops[i];
    const [t2, r2, g2, b2] = stops[i + 1];
    if (t <= t1 && t >= t2) {
      const f = (t1 - t) / (t1 - t2);
      return `rgb(${Math.round(r1 + f * (r2 - r1))},${Math.round(g1 + f * (g2 - g1))},${Math.round(b1 + f * (b2 - b1))})`;
    }
  }
  const [, r, g, b] = stops[stops.length - 1];
  return `rgb(${r},${g},${b})`;
}

function norm(val, min, max) {
  return max === min ? 0 : (val - min) / (max - min);
}

// ── 4. Bootstrap Toast helper ──────────────────────────────────
function showError(msg) {
  document.getElementById('error-msg').textContent = msg;
  const el = document.getElementById('error-toast');
  new bootstrap.Toast(el, { delay: 8000 }).show();
  // Also update the loading screen
  const overlay = document.getElementById('loading-overlay');
  const spinner = overlay.querySelector('.spinner-border');
  const message = overlay.querySelector('span');
  if (spinner) spinner.classList.replace('text-warning', 'text-danger');
  if (message) message.textContent = msg;
  console.error('[BhutanFireMap]', msg);
}

// ── 5. Fetch helper ────────────────────────────────────────────
async function fetchGeoJSON(path) {
  if (window.location.protocol === 'file:') {
    throw new Error('Open this project with Live Server or http://localhost; browsers block local GeoJSON fetches.');
  }

  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── 6. Build polygon centroid ──────────────────────────────────
function centroidOf(geometry) {
  let coords;
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0];
  } else if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates.reduce((a, b) => b[0].length > a.length ? b[0] : a, []);
  } else { return null; }
  if (!coords?.length) return null;
  let x = 0, y = 0;
  coords.forEach(([cx, cy]) => { x += cx; y += cy; });
  return [x / coords.length, y / coords.length];
}

// ── 7. Main init ───────────────────────────────────────────────
async function initMap() {
  try {
    // Parallel data fetch
    const [adminData, hotspotsData, densityData, hexData] = await Promise.all([
      fetchGeoJSON(DATA_FILES.admin),
      fetchGeoJSON(DATA_FILES.hotspots),
      fetchGeoJSON(DATA_FILES.density),
      fetchGeoJSON(DATA_FILES.hexGrid)
    ]);

    // ── District Density Layer (YlOrRd choropleth) ──────────
    const dVals   = densityData.features.map(f => f.properties.Density);
    const dMin    = Math.min(...dVals);
    const dMax    = Math.max(...dVals);

    const districtLayer = L.geoJSON(densityData, {
      style: f => ({
        fillColor:   ylOrRd(norm(f.properties.Density, dMin, dMax)),
        color:       'white',
        weight:      0.8,
        fillOpacity: 0.45
      }),
      onEachFeature: (f, layer) => {
        const p = f.properties;
        layer.bindTooltip(`
          <div class="fw-bold mb-1">${p.adm1_name ?? 'Unknown'}</div>
          <span class="text-secondary">Density:</span> ${p.Density?.toFixed(4) ?? '—'}
        `, { sticky: true });
      }
    });

    // ── Hex Grid Layer (PuRd / pink) ────────────────────────
    const hVals = hexData.features.map(f => f.properties.fire_count);
    const hMin  = Math.min(...hVals);
    const hMax  = Math.max(...hVals);

    const hexLayer = L.geoJSON(hexData, {
      style: f => {
        const count = f.properties.fire_count;
        return {
          fillColor:   count > 0 ? puRd(norm(count, hMin, hMax)) : 'transparent',
          color:       'white',
          weight:      0.3,
          fillOpacity: count > 0 ? 0.7 : 0
        };
      },
      onEachFeature: (f, layer) => {
        layer.bindTooltip(
          `<span class="text-secondary">Fire Count:</span> <strong>${f.properties.fire_count}</strong>`,
          { sticky: true }
        );
      }
    });

    // ── Heatmap Layer ───────────────────────────────────────
    const heatData = hotspotsData.features.map(f => {
      const [lng, lat] = f.geometry.coordinates;
      return [lat, lng];
    });

    const heatLayer = L.heatLayer(heatData, {
      radius: 15,
      blur: 12,
      maxZoom: 12,
      gradient: { 0: 'blue', 0.25: 'cyan', 0.5: 'lime', 0.75: 'yellow', 1: 'red' }
    });

    // ── Hotspot Points ──────────────────────────────────────
    const pointsLayer = L.geoJSON(hotspotsData, {
      pointToLayer: (f, latlng) => L.circleMarker(latlng, {
        radius: 3, color: '#ff2222', fillColor: '#ff4444',
        fillOpacity: 0.85, weight: 0.8
      }),
      onEachFeature: (f, layer) => {
        const p = f.properties;
        const date  = p.ACQ_DATE ?? '—';
        const time  = String(p.ACQ_TIME ?? '').padStart(4, '0') || '—';
        const frp   = p.FRP        != null ? `<br><span class="text-secondary">FRP:</span> ${p.FRP}` : '';
        const conf  = p.CONFIDENCE != null ? `<br><span class="text-secondary">Confidence:</span> ${p.CONFIDENCE}` : '';
        layer.bindTooltip(
          `<div class="fw-bold mb-1">🔥 Fire Hotspot</div>
           <span class="text-secondary">Time:</span> ${date} ${time}${frp}${conf}`,
          { sticky: true }
        );
      }
    });

    // ── Admin Borders ────────────────────────────────────────
    const bordersLayer = L.geoJSON(adminData, {
      style: () => ({ color: '#00d4ff', weight: 1.5, fill: false })
    });

    // ── District Labels ──────────────────────────────────────
    const labelsLayer = L.layerGroup();
    adminData.features.forEach(feature => {
      const c = centroidOf(feature.geometry);
      if (!c) return;
      const icon = L.divIcon({
        className: '',
        html: `<div class="district-label">${feature.properties.adm1_name ?? ''}</div>`,
        iconSize: [100, 20],
        iconAnchor: [50, 10]
      });
      L.marker([c[1], c[0]], { icon, interactive: false }).addTo(labelsLayer);
    });

    // ── Add all layers to map ────────────────────────────────
    mapLayers['district'] = districtLayer;
    mapLayers['hex'] = hexLayer;
    mapLayers['heatmap'] = heatLayer;
    mapLayers['points'] = pointsLayer;
    mapLayers['borders'] = bordersLayer;
    mapLayers['labels'] = labelsLayer;

    districtLayer.addTo(map);
    hexLayer.addTo(map);
    heatLayer.addTo(map);
    pointsLayer.addTo(map);
    bordersLayer.addTo(map);
    labelsLayer.addTo(map);

    // ── Update Stats Bar ──────────────────────────────────────
    setText('stat-hotspots', hotspotsData.features.length.toLocaleString());
    setText('stat-districts', adminData.features.length);
    setText('stat-hex', hexData.features.filter(f => f.properties.fire_count > 0).length.toLocaleString());

    // ── Hide Loading Overlay ───────────────────────────────────
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('fade-out');
    setTimeout(() => { overlay.style.display = 'none'; }, 600);

    // ── Setup Sidebar Controls ─────────────────────────────────
    setupLayerControls();
    setupBasemapControls();
    setupSidebarToggle();

  } catch (err) {
    showError(err.message);
  }
}

// ── Sidebar Layer Control Setup ────────────────────────────────
function setupLayerControls() {
  const layerMappings = {
    'layer-district': 'district',
    'layer-hex': 'hex',
    'layer-heatmap': 'heatmap',
    'layer-points': 'points',
    'layer-borders': 'borders',
    'layer-labels': 'labels'
  };

  Object.keys(layerMappings).forEach(elementId => {
    const checkbox = document.getElementById(elementId);
    if (!checkbox) return;

    checkbox.addEventListener('change', (e) => {
      const layerKey = layerMappings[elementId];
      const layer = mapLayers[layerKey];
      
      if (e.target.checked) {
        layer.addTo(map);
      } else {
        map.removeLayer(layer);
      }
    });
  });
}

// ── Sidebar Basemap Control Setup ──────────────────────────────
function setupBasemapControls() {
  const basemapRadios = document.querySelectorAll('input[name="basemap"]');
  let currentBaseLayer = 'satellite';

  basemapRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (!e.target.checked) return;

      const newBaseLayer = e.target.value;
      
      // Remove old basemap
      map.removeLayer(baseLayersMap[currentBaseLayer]);
      
      // Add new basemap
      map.addLayer(baseLayersMap[newBaseLayer]);
      
      currentBaseLayer = newBaseLayer;
    });
  });
}

// ── Sidebar Toggle for Mobile ──────────────────────────────────
function setupSidebarToggle() {
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');

  if (!sidebarToggle) return;

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
  });

  // Close sidebar on item click (mobile)
  document.querySelectorAll('.sidebar-section input').forEach(input => {
    input.addEventListener('change', () => {
      if (window.innerWidth < 768) {
        sidebar.classList.remove('active');
      }
    });
  });
}

// ── Kick off ──────────────────────────────────────────────────
initMap();
