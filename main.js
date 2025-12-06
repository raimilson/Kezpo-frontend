// ---- CONFIG ----
const BACKEND_URL = "https://kezpo-backend.onrender.com";
const REFRESH_MS = 15000;
// ----------------

let map = L.map('map').setView([0, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

let markers = [];
let selectedTracker = null;

async function loadTrackers() {
  const res = await fetch(`${BACKEND_URL}/trackers`);
  const trackers = await res.json();
  
  const select = document.getElementById("trackerSelect");
  select.innerHTML = "";
  trackers.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });
  
  if (!selectedTracker && trackers.length > 0) {
    selectedTracker = trackers[0];
  }
  select.value = selectedTracker;
}

async function addTracker() {
  const id = document.getElementById("newTracker").value.trim();
  if (!id) return;
  await fetch(`${BACKEND_URL}/add/${id}`);
  document.getElementById("newTracker").value = "";
  selectedTracker = id;
  await loadTrackers();
  await loadMap();
}

async function loadMap() {
  if (!selectedTracker) return;
  const res = await fetch(`${BACKEND_URL}/data/${selectedTracker}`);
  const geo = await res.json();
  
  // Clear old markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  if (geo.features.length === 0) return;

  const bounds = [];

  geo.features.forEach(f => {
    const [lng, lat] = f.geometry.coordinates;
    const marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup(`Time: ${f.properties.timestamp}`);
    markers.push(marker);
    bounds.push([lat, lng]);
  });

  map.fitBounds(bounds, {padding: [40,40]});
}

document.getElementById("trackerSelect").addEventListener("change", async (e) => {
  selectedTracker = e.target.value;
  await loadMap();
});

// First load
loadTrackers().then(loadMap);

// Auto refresh
setInterval(loadMap, REFRESH_MS);

