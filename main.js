const BACKEND_URL = "https://kezpo-backend.onrender.com";
const REFRESH_MS = 15000;

let map = L.map('map').setView([-25.4, -49.35], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom:19
}).addTo(map);

const colors = ["#1e90ff","#ff4136","#2ecc40","#b10dc9","#ff851b"];
let trackersData = {};
let visible = {};
let markerGroups = {};
let polyGroups = {};
let selectedBounds = [];

let showPaths = true;

async function refreshAll() {
  const trackerList = await (await fetch(`${BACKEND_URL}/trackers`)).json();
  trackerList.forEach(id => visible[id] ??= true);

  const stats = await (await fetch(`${BACKEND_URL}/stats`)).json();
  await loadAllData(trackerList);
  drawMap(trackerList);
  renderPanel(trackerList, stats);
}

async function loadAllData(list) {
  for (let i = 0; i < list.length; i++) {
    const id = list[i];
    const geo = await (await fetch(`${BACKEND_URL}/data/${id}`)).json();
    trackersData[id] = geo.features.map(f => ({
      lat:f.geometry.coordinates[1],
      lng:f.geometry.coordinates[0],
      ts:f.properties.timestamp,
      confidence:f.properties.confidence
    }));
  }
}

function drawMap(list) {
  // Remove existing layers
  Object.values(markerGroups).forEach(g => g.clearLayers());
  Object.values(polyGroups).forEach(g => g.clearLayers());
  markerGroups = {};
  polyGroups = {};
  selectedBounds = [];

  list.forEach((id, idx) => {
    if (!visible[id]) return;
    const pts = trackersData[id];
    if (!pts || !pts.length) return;

    const color = colors[idx % colors.length];

    const mGroup = L.layerGroup().addTo(map);
    markerGroups[id] = mGroup;

    pts.forEach((p, i) => {
      const isLast = (i === pts.length - 1);
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: isLast ? 9 : 5,
        color, fillColor: color,
        fillOpacity: isLast ? 1 : 0.5,
        weight: isLast ? 3 : 1
      })
      .bindPopup(`${id}<br>${formatTime(p.ts)}<br>Conf: ${p.confidence}`)
      .addTo(mGroup);

      selectedBounds.push([p.lat,p.lng]);
    });

    if (showPaths && pts.length > 1) {
      const pGroup = L.layerGroup().addTo(map);
      polyGroups[id] = pGroup;

      L.polyline(pts.map(p => [p.lat,p.lng]), {
        color, weight: 2, opacity: 0.7
      }).addTo(pGroup);
    }
  });

  if (selectedBounds.length)
    map.fitBounds(selectedBounds, {padding:[50,50]});
}

function renderPanel(list, stats) {
  const panel = document.getElementById("statsPanel");
  panel.innerHTML = `
    <b>Tracked Devices</b><br>
    <label>
      <input type="checkbox" ${showPaths?"checked":""}
      onchange="togglePaths()">
      Show Paths
    </label><br><br>
  `;

  list.forEach((id, idx) => {
    const s = stats[id] || {};
    const color = colors[idx % colors.length];

    panel.innerHTML += `
      <div class="trackerRow">
        <label>
          <input type="checkbox" ${visible[id]?"checked":""}
          onchange="toggleVisible('${id}')">
          <b style="color:${color}">${id}</b>
        </label><br>
        Points: ${s.points || 0}<br>
        Latest: ${formatTime(s.last) || "—"}<br>
      </div>`;
  });
}

function toggleVisible(id) {
  visible[id] = !visible[id];
  drawMap(Object.keys(visible));
}

function togglePaths() {
  showPaths = !showPaths;
  drawMap(Object.keys(visible));
}

function formatTime(ts) {
  if (!ts) return null;
  return new Date(ts * 1000).toLocaleString();
}

refreshAll();
setInterval(refreshAll, REFRESH_MS);
