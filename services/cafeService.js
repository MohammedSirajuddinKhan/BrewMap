const axios = require("axios");
const Cafe = require("../models/Cafe");

const NOMINATIM_BASE_URL =
  process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
const OVERPASS_API_URL =
  process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter";
const CACHE_TTL_SECONDS = Number(
  process.env.GEOSPATIAL_CACHE_TTL_SECONDS || 300,
);
const DEFAULT_SEARCH_RADIUS = 10000;
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  "BrewMap/1.0 (contact: hello@brewmap.local)";

function isRecoverableGeoError(err) {
  const status = err?.response?.status;
  return (
    status === 406 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

const cache = new Map();

function cacheKey(prefix, value) {
  return `${prefix}:${JSON.stringify(value)}`;
}

function getCache(key) {
  try {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  } catch (err) {
    return null;
  }
}

function setCache(key, value, ttlSeconds = CACHE_TTL_SECONDS) {
  try {
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    cache.set(key, { value, expiresAt });
  } catch (err) {
    // ignore cache failures
  }
}

function normalizeSearchQuery(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchRadius(options = {}) {
  const radius = Number(options.radius);
  if (Number.isFinite(radius) && radius > 0) return Math.min(radius, 50000);
  return DEFAULT_SEARCH_RADIUS;
}

function isLikelyPostalCode(query) {
  const cleaned = normalizeSearchQuery(query).replace(/\s+/g, "");
  return /^[A-Za-z0-9-]{3,12}$/.test(cleaned) && /\d/.test(cleaned);
}

function isIndianPostalCode(query) {
  return /^\d{6}$/.test(normalizeSearchQuery(query));
}

function hasValidCoords(value) {
  return (
    Number.isFinite(Number(value?.lat)) && Number.isFinite(Number(value?.lng))
  );
}

function hasCafeSignals(item) {
  const category = String(item?.category || "").toLowerCase();
  const typeLabel = String(item?.typeLabel || "").toLowerCase();
  return /cafe|coffee|restaurant|bakery|food|eatery/.test(
    `${category} ${typeLabel}`,
  );
}

function isDirectCafeMatch(item, query) {
  if (!item || !query) return false;
  if (!hasCafeSignals(item)) return false;
  const haystack = [item.name, item.displayName, item.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const queryTokens = normalizeSearchQuery(query)
    .toLowerCase()
    .split(" ")
    .filter((token) => token.length > 1);
  return queryTokens.some((token) => haystack.includes(token));
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function haversineDistanceKm(a, b) {
  const lat1 = Number(a?.lat);
  const lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat);
  const lng2 = Number(b?.lng);
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

function normalizeCafeDocument(cafe) {
  const coordinates = Array.isArray(cafe?.location?.coordinates)
    ? cafe.location.coordinates
    : [];
  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);

  return {
    type: "local",
    placeId: String(cafe?.placeId || cafe?._id || ""),
    name: cafe?.name || "Cafe",
    address: cafe?.address || "",
    displayName: cafe?.address || cafe?.name || "Cafe",
    lat,
    lng,
    category: "cafe",
    typeLabel: Array.isArray(cafe?.types) ? cafe.types.join(", ") : "",
    rating: Number(cafe?.rating || 0),
    ratingsTotal: Number(cafe?.ratingsTotal || 0),
    openNow: Boolean(cafe?.openNow),
    phone: cafe?.phone || "",
    website: cafe?.website || "",
    amenities: cafe?.amenities || {},
    raw: cafe,
  };
}

async function localCafeSearch(query, options = {}) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return [];

  const regex = new RegExp(escapeRegex(normalizedQuery), "i");
  const docs = await Cafe.find({ $or: [{ name: regex }, { address: regex }] })
    .limit(20)
    .lean();

  const uniqueDocs = docs.filter((doc, index, array) => {
    const key = String(doc?.placeId || doc?._id || index);
    return (
      index ===
      array.findIndex((item) => String(item?.placeId || item?._id) === key)
    );
  });

  let results = uniqueDocs
    .map(normalizeCafeDocument)
    .filter((item) => hasValidCoords(item));

  const center = options.center;
  if (hasValidCoords(center)) {
    const maxDistanceKm = getSearchRadius(options) / 1000;
    results = results
      .filter(
        (item) => haversineDistanceKm(center, item) <= maxDistanceKm + 0.5,
      )
      .sort(
        (left, right) =>
          haversineDistanceKm(center, left) -
          haversineDistanceKm(center, right),
      );
  }

  if (!hasValidCoords(center)) {
    results.sort((left, right) => {
      if (right.rating !== left.rating) return right.rating - left.rating;
      return right.ratingsTotal - left.ratingsTotal;
    });
  }

  return results;
}

async function nominatimSearch(query, options = {}) {
  const normalizedQuery = normalizeSearchQuery(query);
  const key = cacheKey("nominatimSearch", { query: normalizedQuery, options });
  const cached = getCache(key);
  if (cached) return cached;

  const params = {
    format: "jsonv2",
    addressdetails: 1,
    limit: options.limit || 8,
    countrycodes: options.countrycodes || undefined,
    dedupe: 1,
    extratags: 1,
    namedetails: 1,
  };

  if (options.postalcode)
    params.postalcode = normalizeSearchQuery(options.postalcode);
  if (options.city) params.city = normalizeSearchQuery(options.city);
  if (options.state) params.state = normalizeSearchQuery(options.state);
  if (options.street) params.street = normalizeSearchQuery(options.street);
  if (options.q === false) {
    delete params.q;
  } else {
    params.q = normalizedQuery;
  }

  try {
    const res = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
      params,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Accept-Language": "en",
      },
      timeout: 12000,
    });

    const normalized = (res.data || []).map((item) => ({
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

    setCache(key, normalized);
    return normalized;
  } catch (err) {
    if (isRecoverableGeoError(err)) return [];
    throw err;
  }
}

async function nominatimReverse(lat, lng) {
  const key = cacheKey("nominatimReverse", { lat, lng });
  const cached = getCache(key);
  if (cached) return cached;

  try {
    const res = await axios.get(`${NOMINATIM_BASE_URL}/reverse`, {
      params: { lat, lon: lng, format: "jsonv2", addressdetails: 1 },
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Accept-Language": "en",
      },
      timeout: 12000,
    });

    setCache(key, res.data);
    return res.data;
  } catch (err) {
    if (isRecoverableGeoError(err)) return null;
    throw err;
  }
}

function buildCafeOverpassQuery({ lat, lng, radius = 2000, filters = {} }) {
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
      ${selectors.join("\n      ")}
    );
    out center tags;
  `;
}

function normalizeOverpassElement(element) {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
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
      addressParts.join(", ") || tags["addr:full"] || tags["addr:street"] || "",
    displayName: name,
    lat: Number(lat),
    lng: Number(lng),
    category: tags.amenity || tags.shop || "cafe",
    typeLabel: tags.cuisine || tags["coffee"] || "",
    rating: Number(tags.stars || 0) || 0,
    openNow: tags.opening_hours ? true : false,
    phone: tags.phone || tags["contact:phone"] || "",
    website: tags.website || tags["contact:website"] || "",
    wifi: tags.internet_access || tags["internet_access:fee"] || "",
    raw: element,
  };
}

async function nearbySearch({ lat, lng, radius = 2000, filters = {} }) {
  const numericLat = Number(lat);
  const numericLng = Number(lng);
  if (!Number.isFinite(numericLat) || !Number.isFinite(numericLng)) return [];

  const key = cacheKey("nearbySearch", { lat, lng, radius, filters });
  const cached = getCache(key);
  if (cached) return cached;

  const query = buildCafeOverpassQuery({
    lat: numericLat,
    lng: numericLng,
    radius,
    filters,
  });
  try {
    const res = await axios.get(OVERPASS_API_URL, {
      params: { data: query },
      timeout: 25000,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    const normalized = (res.data?.elements || [])
      .map(normalizeOverpassElement)
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));

    setCache(key, normalized);
    return normalized;
  } catch (err) {
    if (isRecoverableGeoError(err)) return [];
    throw err;
  }
}

async function cafeSearch(query, options = {}) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return [];
  const searchRadius = getSearchRadius(options);

  const candidateSearches = [];

  if (isLikelyPostalCode(normalizedQuery)) {
    candidateSearches.push(
      nominatimSearch(normalizedQuery, {
        limit: 5,
        countrycodes: isIndianPostalCode(normalizedQuery)
          ? "in"
          : options.countrycodes,
        postalcode: normalizedQuery,
      }),
    );
  }

  candidateSearches.push(
    nominatimSearch(normalizedQuery, {
      limit: 5,
      countrycodes: options.countrycodes,
    }),
  );

  const geocodedBatches = await Promise.allSettled(candidateSearches);
  const geocoded = geocodedBatches
    .filter((batch) => batch.status === "fulfilled")
    .flatMap((batch) => batch.value || [])
    .filter((item) => hasValidCoords(item));
  if (!geocoded.length) {
    return localCafeSearch(normalizedQuery, { radius: searchRadius });
  }

  const directCafeMatches = geocoded.filter((item) =>
    isDirectCafeMatch(item, normalizedQuery),
  );
  if (directCafeMatches.length) {
    return directCafeMatches;
  }

  const first = geocoded[0];
  if (!hasValidCoords(first)) {
    return localCafeSearch(normalizedQuery, { radius: searchRadius });
  }

  try {
    const nearby = await nearbySearch({
      lat: first.lat,
      lng: first.lng,
      radius: searchRadius,
      filters: options.filters || {},
    });
    if (nearby.length) return nearby;
  } catch (err) {
    // Fall through to the local database-backed search below.
  }

  const localResults = await localCafeSearch(normalizedQuery, {
    radius: searchRadius,
    center: { lat: first.lat, lng: first.lng },
  });
  if (localResults.length) return localResults;

  const fallbackResults = geocoded
    .filter((item) => hasValidCoords(item))
    .slice(0, 10);
  if (fallbackResults.length) return fallbackResults;

  return localCafeSearch(normalizedQuery, { radius: searchRadius });
}

async function cafeDetails(placeId) {
  const cached = getCache(cacheKey("cafeDetails", placeId));
  if (cached) return cached;

  const [type, id] = String(placeId).split("/");
  if (!type || !id) return null;

  let element = null;
  try {
    const res = await axios.get(OVERPASS_API_URL, {
      params: {
        data: `[out:json][timeout:20];(${type}(${id}););out center tags;`,
      },
      timeout: 25000,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
    element = res.data?.elements?.[0] || null;
  } catch (err) {
    element = null;
  }

  if (!element) return null;

  const normalized = normalizeOverpassElement(element);
  const reverse = await nominatimReverse(normalized.lat, normalized.lng).catch(
    () => null,
  );
  const cafe = await Cafe.findOneAndUpdate(
    { placeId },
    {
      placeId,
      name: normalized.name,
      address: reverse?.display_name || normalized.address,
      location: {
        type: "Point",
        coordinates: [normalized.lng, normalized.lat],
      },
      types: [normalized.category, normalized.typeLabel].filter(Boolean),
      rating: normalized.rating || 0,
      ratingsTotal: 0,
      openNow: normalized.openNow,
      phone: normalized.phone,
      website: normalized.website,
      photos: [],
      amenities: {
        wifi: Boolean(normalized.wifi),
        vegan: false,
        outdoorSeating: false,
        codingFriendly: Boolean(normalized.wifi),
        quiet: false,
        fastInternet: Boolean(normalized.wifi),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const result = { cafe, place: normalized, reverseGeocode: reverse };
  setCache(cacheKey("cafeDetails", placeId), result);
  return result;
}

async function syncCafeToDB(item) {
  if (!item || !item.placeId) return null;
  const cafe = await Cafe.findOneAndUpdate(
    { placeId: item.placeId },
    {
      placeId: item.placeId,
      name: item.name,
      address: item.address,
      location: { type: "Point", coordinates: [item.lng, item.lat] },
      types: item.types || [item.category, item.typeLabel].filter(Boolean),
      rating: item.rating || 0,
      ratingsTotal: item.ratingsTotal || 0,
      openNow: Boolean(item.openNow),
      phone: item.phone,
      website: item.website,
      photos: item.photos || [],
      amenities: item.amenities || {
        wifi: Boolean(item.wifi),
        vegan: Boolean(item.vegan),
        outdoorSeating: Boolean(item.outdoorSeating),
        codingFriendly: Boolean(item.codingFriendly),
        quiet: Boolean(item.quiet),
        fastInternet: Boolean(item.fastInternet),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return cafe;
}

module.exports = {
  nominatimSearch,
  nominatimReverse,
  nearbySearch,
  cafeSearch,
  cafeDetails,
  syncCafeToDB,
};
