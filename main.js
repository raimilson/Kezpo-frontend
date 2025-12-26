const BACKEND_URL = "https://kezpo-backend.onrender.com";

/* ---------- STATE ---------- */
let trackers = [];
let visibleTrackers = {};
let hiddenTrackers = new Set(JSON.parse(localStorage.getItem("hiddenTrackers") || "[]"));
let selectedTrackers = new Set();     // 🔥 NEW
let isolatedTrackers = new Set();     // 🔥 NEW

let trackerNames = JSON.parse(localStorage.getItem("trackerNames") || {});
let trackerColorKeys = JSON.parse(localStorage.getItem("trackerColorKeys") || {});

/* ---------- COLOR ---------- */
function colorFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360},70%,50%)`;
}
function genKey() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/* ---------- HELPERS ---------- */
function formatTimestamp(ts) {
  return ts ? new Date(ts * 1000).toLocaleString() : "N/A";
}
function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/* ---------- FETCH ---------- */
async function fetchTrackers() {
  const res = await fetch(`${BACKEND_URL}/stats`);
  const data = await res.json();

  trackers = Object.keys(data).map(serial => {
    if (!trackerColorKeys[serial]) {
      trackerColorKeys[serial] = genKey();
    }
    return {
      serial,
      name: trackerNames[serial] || serial,
      points: data[serial].points,
      color: colorFromString(trackerColorKeys[serial])
    };
  });

  renderTrackerList();
  refreshMap();
}

/* ---------- LIST ---------- */
function renderTrackerList() {
  const list = document.getElementById("trackerList");
  clear(list);

  trackers.forEach(t => {
    if (hiddenTrackers.has(t.serial)) return;

    const row = document.createElement("div");

    // 🔥 select for isolate
    const select = document.createElement("input");
    select.type = "checkbox";
    select.checked = selectedTrackers.has(t.serial);
    select.onchange = () => {
      select.checked
        ? selectedTrackers.add(t.serial)
        : selectedTrackers.delete(t.serial);
    };

    // visibility
    const vis = document.createElement("input");
    vis.type = "checkbox";
    vis.checked = visibleTrackers[t.serial] ?? true;
    vis.onchange = () => {
      visibleTrackers[t.serial] = vis.checked;
      refreshMap();
    };

    const label = document.createElement("span");
    label.textContent = `${t.name} (${t.points})`;
    label.style.color = t.color;

    row.append(select, vis, label);
    list.appendChild(row);
  });
}

/* ---------- MAP ---------- */
let map, markers = {}, lines = {};

function initMap() {
  map = L.map("map").setView([0, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  fetchTrackers();
}

async function refreshMap() {
  Object.values(markers).flat().forEach(m => map.removeLayer(m));
  Object.values(lines).forEach(l => map.removeLayer(l));
  markers = {};
  lines = {};

  for (const t of trackers) {
    if (hiddenTrackers.has(t.serial)) continue;
    if (visibleTrackers[t.serial] === false) continue;
    if (isolatedTrackers.size && !isolatedTrackers.has(t.serial)) continue;

    const res = await fetch(`${BACKEND_URL}/data/${t.serial}`);
    const geo = await res.json();
    if (!geo.features?.length) continue;

    markers[t.serial] = [];
    const latlngs = [];

    geo.features.forEach(f => {
      const [lng, lat] = f.geometry.coordinates;
      latlngs.push([lat, lng]);

      const m = L.circleMarker([lat, lng], {
        radius: 6,
        color: "#000",
        fillColor: "#000",
        fillOpacity: 0.9
      })
        .bindPopup(
          `<b>${t.name}</b><br>Lat: ${lat}<br>Lng: ${lng}<br>${formatTimestamp(f.properties.timestamp)}`
        )
        .addTo(map);

      markers[t.serial].push(m);
    });

    lines[t.serial] = L.polyline(latlngs, {
      color: t.color,
      weight: 3
    }).addTo(map);
  }
}

/* ---------- ISOLATE CONTROLS ---------- */
document.getElementById("isolateBtn").onclick = () => {
  isolatedTrackers = new Set(selectedTrackers);
  refreshMap();
};

document.getElementById("clearIsolationBtn").onclick = () => {
  // 1. Clear isolation + selection
  isolatedTrackers.clear();
  selectedTrackers.clear();

  // 2. Reset visibility (important)
  trackers.forEach(t => {
    visibleTrackers[t.serial] = true;
  });

  // 3. Re-render UI + map
  renderTrackerList();
  refreshMap();
};


/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", initMap);
