import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { execSync } from "node:child_process"

const MAPS_DIR = path.join(os.homedir(), ".stella", "yandex-maps")

function ensureDir() {
  if (!fs.existsSync(MAPS_DIR)) fs.mkdirSync(MAPS_DIR, { recursive: true })
}

function openFile(filePath) {
  try {
    if (process.platform === "win32") {
      execSync(`start "" "${filePath}"`, { shell: "cmd.exe", stdio: "ignore" })
    } else if (process.platform === "darwin") {
      execSync(`open "${filePath}"`, { stdio: "ignore" })
    } else {
      execSync(`xdg-open "${filePath}"`, { stdio: "ignore" })
    }
  } catch {}
}

const YANDEX_MAP_TEMPLATE = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}}</title>
  <script src="https://api-maps.yandex.ru/2.1/?apikey={{API_KEY}}&lang=ru_RU"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; }
    #map { width: 100%; height: 100vh; }
    .info-panel {
      position: absolute; top: 12px; left: 12px; z-index: 100;
      background: rgba(30,30,46,0.95); color: #cdd6f4; padding: 16px;
      border-radius: 12px; max-width: 320px; backdrop-filter: blur(12px);
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    .info-panel h3 { margin-bottom: 8px; font-size: 16px; color: #89b4fa; }
    .info-panel p { font-size: 13px; line-height: 1.5; color: #a6adc8; }
    .search-box {
      position: absolute; top: 12px; right: 12px; z-index: 100;
    }
    .search-box input {
      padding: 10px 16px; border: none; border-radius: 8px;
      background: rgba(30,30,46,0.95); color: #cdd6f4; font-size: 14px;
      width: 300px; backdrop-filter: blur(12px); outline: none;
    }
    .search-box input::placeholder { color: #6c7086; }
    .route-info {
      position: absolute; bottom: 12px; left: 12px; z-index: 100;
      background: rgba(30,30,46,0.95); color: #cdd6f4; padding: 16px;
      border-radius: 12px; display: none; backdrop-filter: blur(12px);
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    .route-info h4 { color: #a6e3a1; margin-bottom: 8px; }
    .route-info p { font-size: 13px; color: #a6adc8; }
    .marker-label {
      background: rgba(30,30,46,0.95); color: #cdd6f4; padding: 6px 12px;
      border-radius: 8px; font-size: 12px; white-space: nowrap;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="search-box">
    <input type="text" id="searchInput" placeholder="Поиск места..." />
  </div>
  <div class="info-panel" id="infoPanel" style="display:none">
    <h3 id="infoTitle"></h3>
    <p id="infoBody"></p>
  </div>
  <div class="route-info" id="routeInfo">
    <h4>Маршрут</h4>
    <p id="routeDetails"></p>
  </div>
  <script>
    ymaps.ready(function() {
      const map = new ymaps.Map('map', {
        center: [{{CENTER_LAT}}, {{CENTER_LNG}}],
        zoom: {{ZOOM}},
        controls: ['zoomControl', 'fullscreenControl', 'geolocationControl', 'typeSelector']
      });

      {{MARKERS_JS}}

      {{PLACEMARKS_JS}}

      {{POLYLINE_JS}}

      {{POLYGON_JS}}

      {{CIRCLE_JS}}

      document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          const query = this.value;
          ymaps.geocode(query).then(function(result) {
            const obj = result.geoObjects.get(0);
            if (obj) {
              const coords = obj.geometry.getCoordinates();
              map.setCenter(coords, 16);
              const pm = new ymaps.Placemark(coords, {
                balloonContent: obj.getAddressLine(),
                hintContent: obj.getAddressLine()
              }, {
                preset: 'islands#redDotIcon'
              });
              map.geoObjects.add(pm);
              showInfo('Найдено', obj.getAddressLine() + '<br>Координаты: ' + coords.join(', '));
            }
          });
        }
      });

      {{GEOLOCATION_JS}}

      function showInfo(title, body) {
        document.getElementById('infoTitle').textContent = title;
        document.getElementById('infoBody').innerHTML = body;
        document.getElementById('infoPanel').style.display = 'block';
      }

      {{CUSTOM_JS}}
    });
  </script>
</body>
</html>`

export class YandexMaps {
  constructor(apiKey = "") {
    this.apiKey = apiKey || process.env.YANDEX_MAPS_API_KEY || ""
    ensureDir()
  }

  isConfigured() {
    return !!this.apiKey
  }

  setApiKey(key) {
    this.apiKey = key
  }

  async geocode(query) {
    if (!this.apiKey) return { success: false, error: "API key not set. Use /ymaps-key <key>" }
    const resp = await fetch(
      `https://geocode-maps.yandex.ru/1.x/?apikey=${this.apiKey}&geocode=${encodeURIComponent(query)}&format=json&lang=ru_RU`
    )
    const data = await resp.json()
    const member = data.response?.GeoObjectCollection?.featureMember?.[0]
    if (!member) return { success: false, error: "Not found" }

    const geo = member.GeoObject
    const pos = geo.Point?.pos?.split(" ") || []
    return {
      success: true,
      name: geo.name,
      description: geo.Description,
      address: geo.metaDataProperty?.GeocoderMetaData?.text,
      coordinates: { lng: parseFloat(pos[0]), lat: parseFloat(pos[1]) },
      kind: geo.metaDataProperty?.GeocoderMetaData?.kind,
      postalCode: geo.metaDataProperty?.GeocoderMetaData?.Address?.postal_code,
    }
  }

  async reverseGeocode(lat, lng) {
    return this.geocode(`${lng},${lat}`)
  }

  async searchNearby(lat, lng, query, radius = 1000) {
    if (!this.apiKey) return { success: false, error: "API key not set" }
    const resp = await fetch(
      `https://geocode-maps.yandex.ru/1.x/?apikey=${this.apiKey}&geocode=${lng},${lat}&format=json&lang=ru_RU&results=10&kind=house`
    )
    const data = await resp.json()
    const members = data.response?.GeoObjectCollection?.featureMember || []
    return {
      success: true,
      results: members.map(m => ({
        name: m.GeoObject.name,
        description: m.GeoObject.Description,
        address: m.GeoObject.metaDataProperty?.GeocoderMetaData?.text,
        coordinates: m.GeoObject.Point?.pos?.split(" ").map(Number),
      })),
    }
  }

  async getStaticMap({ center = [55.7558, 37.6173], zoom = 12, markers = [], polylines = [], size = "650x450" } = {}) {
    if (!this.apiKey) return { success: false, error: "API key not set" }
    const [lat, lng] = center
    let url = `https://static-maps.yandex.ru/v1?ll=${lng},${lat}&z=${zoom}&size=${size}&apikey=${this.apiKey}`

    if (markers.length > 0) {
      const pt = markers.map(m => `${m.lng || m[1]},${m.lat || m[0]},pm2${m.color || "rdm"}`).join("~")
      url += `&pt=${pt}`
    }

    try {
      const resp = await fetch(url)
      const buffer = Buffer.from(await resp.arrayBuffer())
      const filePath = path.join(MAPS_DIR, `map_${Date.now()}.png`)
      fs.writeFileSync(filePath, buffer)
      openFile(filePath)
      return { success: true, path: filePath, size: buffer.length }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async createMap({
    center = [55.7558, 37.6173],
    zoom = 12,
    markers = [],
    polylines = [],
    polygons = [],
    circles = [],
    title = "Яндекс Карта",
    showSearch = true,
    showGeolocation = false,
    mapType = "map",
  } = {}) {
    const markersJs = markers.map((m, i) => {
      const [lat, lng] = Array.isArray(m) ? m : [m.lat, m.lng]
      const label = m.label || m.name || `Метка ${i + 1}`
      const content = m.content || m.description || label
      return `
        var pm${i} = new ymaps.Placemark([${lat}, ${lng}], {
          balloonContent: \`${content}\`,
          hintContent: \`${label}\`,
          iconContent: \`${label}\`
        }, {
          preset: 'islands#${m.color || "violet"}DotIcon',
          iconColor: '${m.hex || "#7c3aed"}'
        });
        map.geoObjects.add(pm${i});
        pm${i}.events.add('click', function() {
          showInfo(\`${label}\`, \`${content}<br>Координаты: ${lat}, ${lng}\`);
        });`
    }).join("\n      ")

    const polylineJs = polylines.map((p, i) => {
      const coords = p.coords || p
      const color = p.color || "#7c3aed"
      const width = p.width || 3
      return `
        var pl${i} = new ymaps.Polyline(${JSON.stringify(coords)}, {}, {
          strokeColor: '${color}',
          strokeWidth: ${width}
        });
        map.geoObjects.add(pl${i});`
    }).join("\n      ")

    const polygonJs = polygons.map((p, i) => {
      const coords = p.coords || p
      const fillColor = p.fillColor || "rgba(124,58,237,0.2)"
      const strokeColor = p.strokeColor || "#7c3aed"
      return `
        var pg${i} = new ymaps.Polygon(${JSON.stringify(coords)}, {}, {
          fillColor: '${fillColor}',
          strokeColor: '${strokeColor}',
          strokeWidth: 2
        });
        map.geoObjects.add(pg${i});`
    }).join("\n      ")

    const circleJs = circles.map((c, i) => {
      const [lat, lng] = Array.isArray(c.center) ? c.center : [c.center.lat, c.center.lng]
      const radius = c.radius || 1000
      return `
        var cr${i} = new ymaps.Circle([[${lat}, ${lng}], ${radius}], {}, {
          fillColor: '${c.fillColor || "rgba(124,58,237,0.15)"}',
          strokeColor: '${c.strokeColor || "#7c3aed"}',
          strokeWidth: 2
        });
        map.geoObjects.add(cr${i});`
    }).join("\n      ")

    const geoJs = showGeolocation ? `
      ymaps.geolocation.get({ provider: 'yandex' }).then(function(result) {
        map.setCenter(result.position, 14);
        var pmGeo = new ymaps.Placemark(result.position, {
          balloonContent: 'Вы здесь',
          hintContent: 'Ваше местоположение'
        }, { preset: 'islands#greenDotIcon' });
        map.geoObjects.add(pmGeo);
      });` : ""

    const customJs = polylines.some(p => p.route) ? `
      ymaps.route([${JSON.stringify(polylines.find(p => p.route)?.coords || [])}]).then(function(route) {
        map.geoObjects.add(route);
        var path = route.getPaths();
        document.getElementById('routeInfo').style.display = 'block';
        document.getElementById('routeDetails').textContent = 'Расстояние: ' + route.getHumanLength();
      });` : ""

    const html = YANDEX_MAP_TEMPLATE
      .replace("{{TITLE}}", title)
      .replace("{{API_KEY}}", this.apiKey)
      .replace("{{CENTER_LAT}}", center[0])
      .replace("{{CENTER_LNG}}", center[1])
      .replace("{{ZOOM}}", zoom)
      .replace("{{MARKERS_JS}}", markersJs)
      .replace("{{PLACEMARKS_JS}}", "")
      .replace("{{POLYLINE_JS}}", polylineJs)
      .replace("{{POLYGON_JS}}", polygonJs)
      .replace("{{CIRCLE_JS}}", circleJs)
      .replace("{{GEOLOCATION_JS}}", geoJs)
      .replace("{{CUSTOM_JS}}", customJs)

    const filename = `yamap_${Date.now()}.html`
    const filePath = path.join(MAPS_DIR, filename)
    fs.writeFileSync(filePath, html)
    openFile(filePath)
    return { success: true, path: filePath, filename }
  }

  async showRoute(from, to, mode = "auto") {
    const fromGeo = await this.geocode(from)
    const toGeo = await this.geocode(to)
    if (!fromGeo.success || !toGeo.success) {
      return { success: false, error: "Could not geocode addresses" }
    }

    return this.createMap({
      center: [
        (fromGeo.coordinates.lat + toGeo.coordinates.lat) / 2,
        (fromGeo.coordinates.lng + toGeo.coordinates.lng) / 2,
      ],
      zoom: 11,
      markers: [
        { lat: fromGeo.coordinates.lat, lng: fromGeo.coordinates.lng, label: "Откуда", color: "green", hex: "#059669" },
        { lat: toGeo.coordinates.lat, lng: toGeo.coordinates.lng, label: "Куда", color: "red", hex: "#dc2626" },
      ],
      polylines: [{
        coords: [
          [fromGeo.coordinates.lat, fromGeo.coordinates.lng],
          [toGeo.coordinates.lat, toGeo.coordinates.lng],
        ],
        route: true,
      }],
      title: `Маршрут: ${from} → ${to}`,
    })
  }

  async showLocation(query) {
    const geo = await this.geocode(query)
    if (!geo.success) return { success: false, error: geo.error }

    return this.createMap({
      center: [geo.coordinates.lat, geo.coordinates.lng],
      zoom: 16,
      markers: [{
        lat: geo.coordinates.lat,
        lng: geo.coordinates.lng,
        label: geo.name,
        content: `${geo.address || geo.description}<br>${geo.coordinates.lat}, ${geo.coordinates.lng}`,
      }],
      title: geo.name,
    })
  }

  async showMultiplePlaces(places) {
    const markers = []
    const coords = []

    for (const place of places) {
      const geo = typeof place === "string" ? await this.geocode(place) : place
      if (geo.success || geo.coordinates) {
        const c = geo.coordinates || { lat: place.lat, lng: place.lng }
        markers.push({
          lat: c.lat,
          lng: c.lng,
          label: geo.name || place.name || place,
          content: geo.address || place.name || place,
        })
        coords.push([c.lat, c.lng])
      }
    }

    if (coords.length === 0) return { success: false, error: "No places found" }

    const avgLat = coords.reduce((s, c) => s + c[0], 0) / coords.length
    const avgLng = coords.reduce((s, c) => s + c[1], 0) / coords.length

    return this.createMap({
      center: [avgLat, avgLng],
      zoom: coords.length > 5 ? 10 : 12,
      markers,
      title: `Места (${markers.length})`,
    })
  }

  async showRouteFromHere(fromLat, fromLng, toQuery) {
    const toGeo = await this.geocode(toQuery)
    if (!toGeo.success) return { success: false, error: toGeo.error }

    return this.createMap({
      center: [(fromLat + toGeo.coordinates.lat) / 2, (fromLng + toGeo.coordinates.lng) / 2],
      zoom: 11,
      markers: [
        { lat: fromLat, lng: fromLng, label: "Отсюда", color: "green", hex: "#059669" },
        { lat: toGeo.coordinates.lat, lng: toGeo.coordinates.lng, label: toGeo.name, color: "red", hex: "#dc2626" },
      ],
      polylines: [{
        coords: [[fromLat, fromLng], [toGeo.coordinates.lat, toGeo.coordinates.lng]],
        route: true,
      }],
      title: `Маршрут до ${toGeo.name}`,
    })
  }

  listMaps() {
    if (!fs.existsSync(MAPS_DIR)) return []
    return fs.readdirSync(MAPS_DIR)
      .filter(f => f.endsWith(".html") || f.endsWith(".png"))
      .map(f => ({
        name: f,
        path: path.join(MAPS_DIR, f),
        created: fs.statSync(path.join(MAPS_DIR, f)).birthtime,
      }))
      .sort((a, b) => b.created - a.created)
  }
}
