(function () {
  const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  const CLUSTER_JS =
    "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
  const NOMINATIM_PROXY = "/api/geo/suggest";
  const NEARBY_PROXY = "/api/geo/nearby";
  const REVERSE_PROXY = "/api/geo/reverse";
  const NOMINATIM_BASE =
    document.querySelector('meta[name="nominatim-base"]')?.content ||
    "https://nominatim.openstreetmap.org";
  const OVERPASS_BASE =
    document.querySelector('meta[name="overpass-base"]')?.content ||
    "https://overpass-api.de/api/interpreter";

  let map = null;
  let markerLayer = null;
  let userMarker = null;
  let assetsPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some((script) => script.src === src))
        return resolve();
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensureAssets() {
    if (window.L && window.L.markerClusterGroup) return;
    if (!assetsPromise) {
      assetsPromise = loadScript(LEAFLET_JS).then(() => loadScript(CLUSTER_JS));
    }
    await assetsPromise;
  }

  function getCoords(item) {
    if (!item) return null;
    if (Number.isFinite(item.lat) && Number.isFinite(item.lng))
      return [item.lat, item.lng];
    if (
      Array.isArray(item.location?.coordinates) &&
      item.location.coordinates.length === 2
    ) {
      return [
        Number(item.location.coordinates[1]),
        Number(item.location.coordinates[0]),
      ];
    }
    if (item.geometry?.location) {
      return [
        Number(item.geometry.location.lat),
        Number(item.geometry.location.lng),
      ];
    }
    if (item.center?.lat != null && item.center?.lon != null) {
      return [Number(item.center.lat), Number(item.center.lon)];
    }
    return null;
  }

  function getTitle(item) {
    return item?.name || item?.display_name || item?.title || "Cafe";
  }

  function getAddress(item) {
    return (
      item?.address ||
      item?.displayName ||
      item?.vicinity ||
      item?.formatted_address ||
      ""
    );
  }

  async function initMap(containerId = "map", options = {}) {
    const el = document.getElementById(containerId);
    if (!el) return null;

    await ensureAssets();

    const center = options.center || [37.7749, -122.4194];
    const zoom = options.zoom || 13;

    if (map) {
      map.remove();
      map = null;
    }

    map = L.map(el, {
      zoomControl: true,
      scrollWheelZoom: true,
      preferCanvas: true,
    }).setView(center, zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      detectRetina: true,
    }).addTo(map);

    markerLayer = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16,
    });

    map.addLayer(markerLayer);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const current = [pos.coords.latitude, pos.coords.longitude];
          map.flyTo(current, 15, { animate: true, duration: 0.8 });
          if (userMarker) userMarker.remove();
          userMarker = L.circleMarker(current, {
            radius: 10,
            color: "#0b525b",
            weight: 2,
            fillColor: "#006466",
            fillOpacity: 0.25,
          })
            .addTo(map)
            .bindPopup("Your location");
        },
        () => {},
      );
    }

    return map;
  }

  function clearMarkers() {
    if (markerLayer) markerLayer.clearLayers();
  }

  function placePopupMarkup(item) {
    const title = getTitle(item);
    const address = getAddress(item);
    const score = item?.rating || item?.importance || "";
    return `
      <div class="map-popup">
        <strong>${escapeHtml(title)}</strong>
        <div>${escapeHtml(address)}</div>
        ${score ? `<div class="map-popup-score">${escapeHtml(String(score))}</div>` : ""}
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function addPlaces(places = []) {
    if (!map || !markerLayer) return;
    clearMarkers();

    const bounds = [];
    places.forEach((item) => {
      const coords = getCoords(item);
      if (!coords) return;
      const [lat, lng] = coords;
      const marker = L.marker([lat, lng], {
        riseOnHover: true,
        keyboard: true,
      });
      marker.bindPopup(placePopupMarkup(item), {
        closeButton: true,
        autoPan: true,
        offset: [0, -4],
      });
      marker.on("click", () => marker.openPopup());
      markerLayer.addLayer(marker);
      bounds.push([lat, lng]);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36], animate: true });
    } else if (bounds.length === 1) {
      map.flyTo(bounds[0], Math.max(map.getZoom(), 15), {
        animate: true,
        duration: 0.7,
      });
    }
  }

  async function searchNearby(params) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "")
        query.set(key, String(value));
    });
    const res = await fetch(`${NEARBY_PROXY}?${query.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Failed to load nearby cafes");
    return res.json();
  }

  async function reverseGeocode(lat, lng) {
    const res = await fetch(
      `${REVERSE_PROXY}?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
      {
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) throw new Error("Failed to reverse geocode");
    return res.json();
  }

  function debounce(fn, wait = 250) {
    let timeout = null;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  }

  async function getSuggestions(query) {
    const q = String(query || "").trim();
    if (!q) return [];
    try {
      const res = await fetch(`${NOMINATIM_PROXY}?q=${encodeURIComponent(q)}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length)
        return data.results;
    } catch (err) {
      // Fall through to direct geocoder.
    }

    const direct = await directNominatimSearch(q);
    return direct.slice(0, 8);
  }

  function buildOverpassQuery({ lat, lng, radius = 10000, filters = {} }) {
    const extraFilters = [];
    if (filters.wifi) extraFilters.push('["internet_access"~"wlan|wifi|yes"]');
    if (filters.outdoorSeating) extraFilters.push('["outdoor_seating"="yes"]');
    if (filters.vegan) extraFilters.push('["diet:vegan"~"yes|only"]');
    if (filters.quiet) extraFilters.push('["noise"~"low|quiet"]');
    if (filters.codingFriendly)
      extraFilters.push('["internet_access"~"wlan|wifi|yes"]');
    if (filters.fastInternet)
      extraFilters.push('["internet_access"~"wlan|wifi|yes"]');

    const filterString = extraFilters.join("");
    const selectors = [
      `node["amenity"~"cafe|coffee_shop"]${filterString}(around:${radius},${lat},${lng});`,
      `way["amenity"~"cafe|coffee_shop"]${filterString}(around:${radius},${lat},${lng});`,
      `relation["amenity"~"cafe|coffee_shop"]${filterString}(around:${radius},${lat},${lng});`,
      `node["shop"="coffee"]${filterString}(around:${radius},${lat},${lng});`,
      `way["shop"="coffee"]${filterString}(around:${radius},${lat},${lng});`,
      `relation["shop"="coffee"]${filterString}(around:${radius},${lat},${lng});`,
    ];

    return `
      [out:json][timeout:25];
      (
        ${selectors.join("\n        ")}
      );
      out center tags;
    `;
  }

  async function directNominatimSearch(query) {
    const params = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      limit: "8",
      dedupe: "1",
      extratags: "1",
      namedetails: "1",
      q: query,
    });
    const res = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
      headers: { Accept: "application/json", "Accept-Language": "en" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((item) => ({
      type: "nominatim",
      placeId: `${item.osm_type}/${item.osm_id}`,
      name: item.display_name?.split(",")[0] || item.display_name,
      displayName: item.display_name,
      address: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
      bbox: item.boundingbox,
      category: item.category,
      typeLabel: item.type,
      importance: item.importance || 0,
      osmType: item.osm_type,
      osmId: item.osm_id,
      raw: item,
    }));
  }

  async function directOverpassSearch({ lat, lng, radius = 10000, filters }) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      return [];
    }

    const query = buildOverpassQuery({
      lat: Number(lat),
      lng: Number(lng),
      radius,
      filters,
    });

    const res = await fetch(
      `${OVERPASS_BASE}?data=${encodeURIComponent(query)}`,
      {
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.elements || [])
      .map((element) => {
        const latValue = element.lat ?? element.center?.lat;
        const lngValue = element.lon ?? element.center?.lon;
        const tags = element.tags || {};
        const name = tags.name || tags.brand || tags.operator || "Cafe";
        const addressParts = [
          tags["addr:housenumber"],
          tags["addr:street"],
          tags["addr:city"],
          tags["addr:postcode"],
        ].filter(Boolean);

        return {
          type: "overpass",
          placeId: `${element.type}/${element.id}`,
          name,
          address:
            addressParts.join(", ") ||
            tags["addr:full"] ||
            tags["addr:street"] ||
            "",
          displayName: name,
          lat: Number(latValue),
          lng: Number(lngValue),
          category: tags.amenity || tags.shop || "cafe",
          typeLabel: tags.cuisine || tags["coffee"] || "",
          rating: Number(tags.stars || 0) || 0,
          openNow: tags.opening_hours ? true : false,
          phone: tags.phone || tags["contact:phone"] || "",
          website: tags.website || tags["contact:website"] || "",
          wifi: tags.internet_access || tags["internet_access:fee"] || "",
          raw: element,
        };
      })
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  }

  function distanceKm(left, right) {
    const lat1 = Number(left?.lat);
    const lng1 = Number(left?.lng);
    const lat2 = Number(right?.lat);
    const lng2 = Number(right?.lng);
    if (
      !Number.isFinite(lat1) ||
      !Number.isFinite(lng1) ||
      !Number.isFinite(lat2) ||
      !Number.isFinite(lng2)
    ) {
      return Number.POSITIVE_INFINITY;
    }
    const toRadians = (degrees) => (degrees * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLng = toRadians(lng2 - lng1);
    const sinLat = Math.sin(deltaLat / 2);
    const sinLng = Math.sin(deltaLng / 2);
    const aValue =
      sinLat * sinLat +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * sinLng * sinLng;
    return (
      2 * earthRadiusKm * Math.atan2(Math.sqrt(aValue), Math.sqrt(1 - aValue))
    );
  }

  function getBrowserLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
      );
    });
  }

  async function searchFallback(params) {
    const normalizedQuery = String(params.q || "").trim();
    const radius = Number(params.radius) || 10000;
    const filters = params.filters || {};

    const directPlaces = await directNominatimSearch(normalizedQuery);
    const queryCafeResults = await directNominatimSearch(
      `${normalizedQuery} cafe`,
    );
    const cafeishDirect = directPlaces.filter((item) => {
      const haystack =
        `${item.name || ""} ${item.displayName || ""}`.toLowerCase();
      return /cafe|coffee|starbucks|blue tokai|third wave|barista/.test(
        haystack,
      );
    });
    if (cafeishDirect.length) return cafeishDirect;

    const cafeishQueryMatches = queryCafeResults.filter((item) => {
      const haystack =
        `${item.name || ""} ${item.displayName || ""}`.toLowerCase();
      return /cafe|coffee|starbucks|blue tokai|third wave|barista/.test(
        haystack,
      );
    });
    if (cafeishQueryMatches.length) return cafeishQueryMatches.slice(0, 10);

    const center =
      directPlaces.find(
        (item) => Number.isFinite(item.lat) && Number.isFinite(item.lng),
      ) || (await getBrowserLocation());

    const cafePool = await directNominatimSearch("cafe");
    if (cafePool.length && center) {
      return cafePool
        .filter(
          (item) => Number.isFinite(item.lat) && Number.isFinite(item.lng),
        )
        .sort(
          (left, right) => distanceKm(center, left) - distanceKm(center, right),
        )
        .slice(0, 10);
    }

    if (cafePool.length) {
      return cafePool.slice(0, 10);
    }

    return directPlaces;
  }

  function renderSuggestions(listEl, items, onSelect) {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!items.length) {
      listEl.hidden = true;
      return;
    }
    items.forEach((item, index) => {
      const li = document.createElement("button");
      li.type = "button";
      li.className = "suggestion-item";
      li.role = "option";
      li.dataset.index = String(index);
      li.innerHTML = `<strong>${escapeHtml(getTitle(item))}</strong><span>${escapeHtml(getAddress(item))}</span>`;
      li.addEventListener("click", () => onSelect?.(item));
      listEl.appendChild(li);
    });
    listEl.hidden = false;
  }

  function escapeHtmlAttribute(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderPlacesToHtml(places = []) {
    if (!places.length) {
      return "";
    }

    return places
      .map((item) => {
        const title = escapeHtmlAttribute(getTitle(item));
        const address = escapeHtmlAttribute(getAddress(item));
        const ratingValue = item?.rating
          ? item.rating.toFixed
            ? item.rating.toFixed(1)
            : item.rating
          : "New";
        return `
        <article class="result card hover-card">
          <div>
            <h3><a href="/cafes/details/${encodeURIComponent(item.placeId || "")}">${title}</a></h3>
            <p>${address}</p>
          </div>
          <div class="result-meta">
            <span>${escapeHtmlAttribute(ratingValue)}</span>
          </div>
        </article>
      `;
      })
      .join("");
  }

  function bindSuggestions({ inputSelector, listSelector, onSelect } = {}) {
    const input = document.querySelector(inputSelector);
    const list = document.querySelector(listSelector);
    if (!input || !list) return;
    let itemsCache = [];
    let activeIndex = -1;

    const updateActiveItem = () => {
      const buttons = [...list.querySelectorAll(".suggestion-item")];
      buttons.forEach((button, index) => {
        const isActive = index === activeIndex;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
        if (isActive) button.scrollIntoView({ block: "nearest" });
      });
    };

    const chooseActive = () => {
      if (activeIndex < 0 || activeIndex >= itemsCache.length) return false;
      onSelect?.(itemsCache[activeIndex]);
      return true;
    };

    const runSearch = debounce(async () => {
      const value = input.value.trim();
      if (!value) {
        itemsCache = [];
        activeIndex = -1;
        renderSuggestions(list, [], onSelect);
        return;
      }
      input.setAttribute("aria-busy", "true");
      try {
        const items = await getSuggestions(value);
        itemsCache = items;
        activeIndex = items.length ? 0 : -1;
        renderSuggestions(list, items, onSelect);
        updateActiveItem();
      } catch (err) {
        itemsCache = [];
        activeIndex = -1;
        renderSuggestions(list, [], onSelect);
      } finally {
        input.removeAttribute("aria-busy");
      }
    }, 220);

    input.addEventListener("input", runSearch);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        itemsCache = [];
        activeIndex = -1;
        renderSuggestions(list, [], onSelect);
        return;
      }

      if (!itemsCache.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % itemsCache.length;
        updateActiveItem();
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex =
          activeIndex <= 0 ? itemsCache.length - 1 : activeIndex - 1;
        updateActiveItem();
      }

      if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        chooseActive();
      }
    });

    list.addEventListener("mouseover", (event) => {
      const item = event.target.closest(".suggestion-item");
      if (!item) return;
      const index = Number(item.dataset.index);
      if (Number.isFinite(index)) {
        activeIndex = index;
        updateActiveItem();
      }
    });
  }

  async function searchAndRender({
    q,
    lat,
    lng,
    radius,
    filters,
    mapContainerId,
    resultsRenderer,
  }) {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (Number.isFinite(lat)) query.set("lat", String(lat));
    if (Number.isFinite(lng)) query.set("lng", String(lng));
    if (radius) query.set("radius", String(radius));
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value) query.set(key, "1");
    });
    const response = await fetch(`/api/geo/search?${query.toString()}`, {
      headers: { Accept: "application/json" },
    }).then((res) => {
      if (!res.ok) throw new Error("Failed to search cafes");
      return res.json();
    });
    let places = response.results || [];
    if (
      !places.length &&
      (q || (Number.isFinite(lat) && Number.isFinite(lng)))
    ) {
      try {
        places = await searchFallback({ q, lat, lng, radius, filters });
      } catch (err) {
        places = [];
      }
    }
    if (resultsRenderer) resultsRenderer(places);
    if (mapContainerId) {
      if (!map) await initMap(mapContainerId);
      addPlaces(places);
    }
    return places;
  }

  window.BrewMap = {
    initMap,
    addPlaces,
    clearMarkers,
    searchNearby,
    reverseGeocode,
    getSuggestions,
    bindSuggestions,
    searchAndRender,
    renderPlacesToHtml,
  };
})();
