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

/*************************************************
 * HELPERS
 *************************************************/
function saveHiddenTrackers() {
  localStorage.setItem(
    "hiddenTrackers",
    JSON.stringify(Array.from(hiddenTrackers))
  );
}

function clearElement(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/*************************************************
 * FETCH TRACKERS (FIXED FOR /stats SHAPE)
 *************************************************/
async function fetchTrackers() {
  const res = await fetch(`${BACKEND_URL}/stats`);
  const data = await res.json();

  // Backend returns { SERIAL: { points, first, last } }
  trackers = Object.keys(data).map(serial => ({
    serial,
    ...data[serial]
  }));

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
      label.textContent = ` ${tracker.serial} `;
      label.style.marginRight = "6px";

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
  // Clear existing layers
  for (const serial of Object.keys(markers)) {
    markers[serial].forEach(m => map.removeLayer(m));
    polylines[serial]?.remove();
  }

  markers = {};
  polylines = {};

  for (const tracker of trackers) {
    const serial = tracker.serial;

    if (hiddenTrackers.has(serial)) continue;
    if (!visibleTrackers[serial]) continue;

    const res = await fetch(`${BACKEND_URL}/data/${serial}`);
    const geojson = await res.json();

    if (!geojson.features || geojson.features.length === 0) continue;

    markers[serial] = [];
    const latlngs = [];

    geojson.features.forEach(f => {
      const [lng, lat] = f.geometry.coordinates;
      const latlng = [lat, lng];
      latlngs.push(latlng);

      const marker = L.circleMarker(latlng, {
        radius: 4,
        color: "blue"
      }).addTo(map);

      markers[serial].push(marker);
    });

    polylines[serial] = L.polyline(latlngs, {
      color: "blue"
    }).addTo(map);
  }
}

/*************************************************
 * INIT
 *************************************************/
document.addEventListener("DOMContentLoaded", initMap);
