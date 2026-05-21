(function () {
  function parsePageData() {
    const root = document.querySelector(".home[data-page-data]");
    if (!root) return { featured: [] };
    try {
      return (
        JSON.parse(decodeURIComponent(root.dataset.pageData || "")) || {
          featured: [],
        }
      );
    } catch (err) {
      console.warn("Home page data parse failed");
      return { featured: [] };
    }
  }

  window.addEventListener("load", async () => {
    const data = parsePageData();
    await BrewMap.initMap("map");

    const showFeatured = () => {
      BrewMap.addPlaces(Array.isArray(data.featured) ? data.featured : []);
    };

    showFeatured();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const nearby = await BrewMap.searchNearby({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              radius: 10000,
            });
            if (Array.isArray(nearby) && nearby.length) {
              BrewMap.addPlaces(nearby);
            }
          } catch (err) {
            showFeatured();
          }
        },
        () => {
          showFeatured();
        },
      );
    }

    BrewMap.bindSuggestions({
      inputSelector: '.home .search-bar input[name="q"]',
      listSelector: "#home-suggestions",
      onSelect: (item) => {
        window.location.href = `/search?q=${encodeURIComponent(item.name || item.displayName || "")}`;
      },
    });
  });
})();
