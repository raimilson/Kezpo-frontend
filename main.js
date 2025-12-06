// --------------------
const BACKEND_URL = "https://kezpo-backend.onrender.com";
const REFRESH_MS = 15000;
// --------------------

let map = L.map('map').setView([-25.4, -49.35], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

const colors = ["blue", "red", "green", "purple", "orange", "yellow"];
let trackers = {};
let visible = {};
let markers = {};
let polylines = {};

async function loadTrackers() {
  const res = await fetch(`${BACKEND_URL}/trackers`);
  const list = await res.json();
  
  list.forEach(serial => {
    if (!visible[serial]) visible[serial] = true;
  });

  await renderStatsPanel(list);
  await loadAllData(list);
}

async function renderStatsPanel(list) {
  const panel = document.getElementById("statsPanel");
  const stats = await (await fetch(`${BACKEND_URL}/stats`)).json();
  
  panel.innerHTML = "";
  
  list.forEach((serial, i) => {
    const s = stats[serial] || {};
    
    const div = document.createElement("div");
    div.className = "trackerRow";
    
    div.innerHTML = `
      <label>
        <input type="checkbox" ${visible[serial] ? "checked" : ""} 
        onchange="toggleTracker('${serial}')">
        <span style="color:${colors[i % colors.length]}">${serial}</span>
      </label><br>
      Points: ${s.points || 0}<br>
      Last: ${formatTime(s.last) || "n/a"}<br>
    `;
    
    panel.appendChild(div);
  });
}

function toggleTracker(serial) {
  visible[serial] = !visible[serial];
  refreshMap();
}

async function loadAllData(list) {
  for (let i = 0; i < list.length; i++) {
    const serial = list[i];
    const res = await fetch(`${BACKEND_URL}/data/${serial}`);
    const geo = await res.json();
    
    trackers[serial] = geo.features.map(f => {
      const [lng, lat] = f.geometry.coordinates;
      return {
        lat, lng,
        ts: f.properties.timestamp,
        confidence: f.properties.confidence
      };
    });
  }
  refreshMap();
}

function refreshMap() {
  removeAll();

  Object.keys(trackers).forEach((serial, idx) => {
    if (!visible[serial]) return;
    const pts = trackers[serial];
    if (!pts.length) return;

    const color = colors[idx % colors.length];
    
    polylines[serial] = L.polyline(pts.map(p => [p.lat, p.lng]), {
      color, weight: 3
    }).addTo(map);
    
    // Latest point glow marker
    const latest = pts[pts.length - 1];
    markers[serial] = L.circleMarker([latest.lat, latest.lng], {
      radius: 10,
      color: color,
      fillColor: color,
      fillOpacity: 1,
      weight: 2
    }).bindPopup(
      `${serial}<br>${formatTime(latest.ts)}<br>Conf: ${latest.confidence}`
    ).addTo(map);
  });
}

function removeAll() {
  Object.values(polylines).forEach(p => map.removeLayer(p));
  Object.values(markers).forEach(m => map.removeLayer(m));
}

function formatTime(ts) {
  if (!ts) return null;
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

// 🔄 Update loop
loadTrackers();
setInterval(loadTrackers, REFRESH_MS);
