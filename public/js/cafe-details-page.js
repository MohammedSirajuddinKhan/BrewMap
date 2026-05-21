(function () {
  function parsePageData() {
    const root = document.querySelector(".cafe-page[data-page-data]");
    if (!root) return { cafe: null, place: null };
    try {
      return (
        JSON.parse(decodeURIComponent(root.dataset.pageData || "")) || {
          cafe: null,
          place: null,
        }
      );
    } catch (err) {
      console.warn("Cafe details page data parse failed");
      return { cafe: null, place: null };
    }
  }

  window.addEventListener("load", async () => {
    const data = parsePageData();
    const place = data.place || null;
    const lat = Number(place?.lat);
    const lng = Number(place?.lng);
    const center =
      Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : undefined;
    await BrewMap.initMap("map", { center, zoom: 16 });
    if (place && Number.isFinite(lat) && Number.isFinite(lng)) {
      BrewMap.addPlaces([place]);
    }
  });
})();
