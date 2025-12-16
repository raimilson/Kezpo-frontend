/*************************************************
 * CONFIG
 *************************************************/
const BACKEND_URL = "https://kezpo-backend.onrender.com";

/*************************************************
 * STATE
 *************************************************/
let trackers = [];
let visibleTrackers = {};
let hiddenTrackers = new Set(
  JSON.parse(localStorage.getItem("hiddenTrackers") || "[]")
);

let trackerNames = JSON.parse(
  localStorage.getItem("trackerNames") || "{}"
);

let trackerColorKeys = JSON.parse(
  localStorage.getItem("trackerColorKeys") || "{}"
);

/*************************************************
 * COLOR GENERATOR
 *************************************************/
function colorFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

function generateColorKey() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/*************************************************
 * HELPERS
 *************************************************/
function saveHiddenTrackers() {
  localStorage.setItem(
    "hiddenTrackers",
    JSON.stringify(Array.from(hiddenTrackers))
  );
}

function saveTrackerNames() {
  localStorage.setItem("trackerNames", JSON.stringify(trackerNames));
}

function saveTrackerColorKeys() {
  localStorage.setItem(
    "trackerColorKeys",
    JSON.stringify(trackerColorKeys)
  );
}

function clearElement(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function formatTimestamp(ts) {
  if (!ts) return "N/A";
  const d = new Date(ts * 1000); // unix seconds → ms
  return d.toLocaleString();
}

/*************************************************
 * FETCH TRACKERS
 *************************************************/
async function fetchTrackers() {
  const res = await fetch(`${BACKEND_URL}/stats`);
  const data = await res.json();

  trackers = Object.keys(data).map(serial => {
    const name = trackerNames[serial] || serial;

    if (!trackerColorKeys[serial]) {
      trackerColorKeys[serial] = generateColorKey();
      saveTrackerColorKeys();
    }

    return {
      serial,
      name,
      points: data[serial].points || 0,
      color: colorFromString(trackerColorKeys[serial])
    };
  });

  trackers.forEach(t => {
    if (!(t.serial in visibleTrackers)) {
      visibleTrackers[t.serial] = true;
    }
  });

  renderTrackerList();
  refreshMap();
}

/*************************************************
 * RENDER TRACKER LIST
 *************************************************/
function renderTrackerList() {
  const list = document.getElementById("trackerList");
  clearElement(list);

  if (hiddenTrackers.size > 0) {
    const restoreBtn = document.createElement("button");
    restoreBtn.textContent = "Show all trackers";
    restoreBtn.style.marginBottom = "10px";
    restoreBtn.onclick = () => {
      hiddenTrackers.clear();
      saveHiddenTrackers();
      renderTrackerList();
      refreshMap();
    };
    list.appendChild(restoreBtn);
  }

  trackers
    .filter(t => !hiddenTrackers.has(t.serial))
    .forEach(tracker => {
      const row = document.createElement("div");
      row.style.marginBottom = "6px";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = visibleTrackers[tracker.serial];
      checkbox.onchange = () => {
        visibleTrackers[tracker.serial] = checkbox.checked;
        refreshMap();
      };

      const label = document.createElement("span");
      label.textContent = ` ${tracker.name} `;
      label.style.color = tracker.color;
      label.style.fontWeight = "bold";
      label.style.marginRight = "4px";

      const count = document.createElement("span");
      count.textContent = `(${tracker.points})`;
      count.style.fontSize = "12px";
      count.style.marginRight = "6px";

      const renameBtn = document.createElement("button");
      renameBtn.textContent = "Rename";
      renameBtn.onclick = () => {
        const newName = prompt("Enter new name:", tracker.name);
        if (newName && newName.trim()) {
          trackerNames[tracker.serial] = newName.trim();
          trackerColorKeys[tracker.serial] = generateColorKey();
          saveTrackerNames();
          saveTrackerColorKeys();
          fetchTrackers();
        }
      };

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.onclick = () => {
        hiddenTrackers.add(tracker.serial);
        saveHiddenTrackers();
        renderTrackerList();
        refreshMap();
      };

      row.appendChild(checkbox);
      row.appendChild(label);
      row.appendChild(count);
      row.appendChild(renameBtn);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
}

/*************************************************
 * MAP
 *************************************************/
let map;
let markers = {};
let polylines = {};

function initMap() {
  map = L.map("map").setView([0, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  fetchTrackers();
}

async function refreshMap() {
  for (const serial of Object.keys(markers)) {
    markers[serial].forEach(m => map.removeLayer(m));
    polylines[serial]?.remove();
  }

  markers = {};
  polylines = {};

  for (const tracker of trackers) {
    if (hiddenTrackers.has(tracker.serial)) continue;
    if (!visibleTrackers[tracker.serial]) continue;

    const res = await fetch(`${BACKEND_URL}/data/${tracker.serial}`);
    const geojson = await res.json();

    if (!geojson.features || geojson.features.length === 0) continue;

    markers[tracker.serial] = [];
    const latlngs = [];

    geojson.features.forEach(f => {
      const [lng, lat] = f.geometry.coordinates;
      const ts = f.properties?.timestamp;
      const latlng = [lat, lng];
      latlngs.push(latlng);

      const popupHtml = `
        <strong>${tracker.name}</strong><br/>
        Lat: ${lat.toFixed(6)}<br/>
        Lng: ${lng.toFixed(6)}<br/>
        Time: ${formatTimestamp(ts)}
      `;

      const marker = L.circleMarker(latlng, {
        radius: 4,
        color: tracker.color,
        fillColor: tracker.color,
        fillOpacity: 0.8
      })
        .bindPopup(popupHtml)
        .addTo(map);

      markers[tracker.serial].push(marker);
    });

    polylines[tracker.serial] = L.polyline(latlngs, {
      color: tracker.color,
      weight: 3
    }).addTo(map);
  }
}

/*************************************************
 * INIT
 *************************************************/
document.addEventListener("DOMContentLoaded", initMap);
