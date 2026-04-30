# Bhutan Fire Hotspot Density Map

Interactive web map for visualizing Bhutan fire hotspot density with Leaflet.js and Bootstrap 5. The app runs fully in the browser and loads local GeoJSON files from the `data/` folder.

## Project Structure

```text
bhutan-fire-map/
|-- index.html          Main map page and Bootstrap layout
|-- style.css           Custom styles for sidebar, legend, map, and controls
|-- app.js              Leaflet map logic, data loading, layers, and controls
|-- dev-server.ps1      Small local PowerShell server for Windows
|-- README.md           Project notes
`-- data/
    |-- bhutan_dzong_web.geojson
    |-- Bhutan_active_fire.geojson
    |-- density.geojson
    |-- hex_grid_json.geojson
    `-- Bhutan_fire_per_Dzo.geojson
```

## Setup

### 1. Keep the GeoJSON files in `data/`

The app expects these files:

| File | Description | Required field |
|---|---|---|
| `bhutan_dzong_web.geojson` | Dzongkhag admin boundaries | `adm1_name` |
| `Bhutan_active_fire.geojson` | Fire hotspot points | `ACQ_DATE`, `ACQ_TIME` |
| `density.geojson` | District-level fire density | `Density` |
| `hex_grid_json.geojson` | Hex grid fire counts | `fire_count` |

If a filename changes, update `DATA_FILES` at the top of `app.js`.

### 2. Start a local server

Do not double-click `index.html`. Browsers block `fetch()` from local files, so the GeoJSON files will not load through `file://`.

Recommended on this Windows project:

```powershell
powershell -ExecutionPolicy Bypass -File .\dev-server.ps1
```

Then open:

```text
http://127.0.0.1:8000/
```

Other options also work:

```bash
python -m http.server 8000
```

or use the VS Code Live Server extension.

## Features

- Satellite, dark canvas, and street basemap options
- District density choropleth using the `Density` field
- Hex grid density layer using the `fire_count` field
- Fire hotspot heatmap
- Individual hotspot point layer with tooltips
- Dzongkhag border layer
- District labels
- Sidebar layer and basemap controls
- Summary counts for hotspots, districts, and active hexes
- Legend overlay for density, heatmap, and symbols
- Fullscreen button that keeps the sidebar controls and legend visible
- Bootstrap toast errors for failed data loading

## Map Layers

| Layer | Style | Toggle |
|---|---|---|
| District Density | Yellow-to-red choropleth | Layer checkbox |
| Hex Grid Density | Pink-to-purple choropleth | Layer checkbox |
| Fire Heatmap | Blue-to-red heatmap | Layer checkbox |
| Hotspot Points | Red circle markers | Layer checkbox |
| Dzongkhag Borders | Cyan outlines | Layer checkbox |
| District Labels | White uppercase labels | Layer checkbox |

## Dependencies

All main libraries are loaded from CDNs in `index.html`.

| Library | Version | Role |
|---|---|---|
| Bootstrap 5 | 5.3.3 | Layout, controls, toast, spinner, dark theme |
| Bootstrap Icons | 1.11.3 | UI icons |
| Leaflet.js | 1.9.4 | Interactive map |
| Leaflet.heat | 0.2.0 | Heatmap layer |
| Leaflet.fullscreen CSS | 3.0.2 | Fullscreen control styling |
| Google Fonts | Rajdhani, DM Sans | Typography |

Note: the current fullscreen behavior is implemented in `app.js` so the whole app enters fullscreen, not only the map container. This keeps the layer controls and legend visible.

## Troubleshooting

| Problem | Fix |
|---|---|
| Map stays on loading screen | Open the app through a local server, not `file://` |
| Error says local GeoJSON fetches are blocked | Start `dev-server.ps1`, Python server, or Live Server |
| GeoJSON returns 404 | Check filenames in `DATA_FILES` and the `data/` folder |
| Map loads but a layer is empty | Check that the expected field exists: `Density`, `fire_count`, or `adm1_name` |
| Heatmap is hard to see | Switch to the dark canvas basemap |
| Icons or fonts do not load | Check internet access because CDNs are used |

## Notes for Development

- Edit map data paths in `app.js` under `DATA_FILES`.
- Edit layer styling and color scales in `app.js`.
- Edit layout and visual styling in `style.css`.
- Keep the map container served over HTTP so `fetch()` can load GeoJSON.
