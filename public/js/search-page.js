(function () {
  function parsePageData() {
    const root = document.querySelector(".search-page[data-page-data]");
    if (!root) return { query: "", results: [], searchError: "" };
    try {
      return (
        JSON.parse(decodeURIComponent(root.dataset.pageData || "")) || {
          query: "",
          results: [],
          searchError: "",
        }
      );
    } catch (err) {
      console.warn("Search page data parse failed");
      return { query: "", results: [], searchError: "" };
    }
  }

  function safeText(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function buildInlineMessage(title, message, error = false) {
    return `
      <div class="empty-state ${error ? "error-state" : ""}">
        <div class="empty-icon">${error ? "!" : "☕"}</div>
        <div>
          <h3>${safeText(title)}</h3>
          <p>${safeText(message)}</p>
          ${error || title === "No cafes found" ? '<button type="button" id="retry-search" class="retry-button">Retry search</button>' : ""}
        </div>
      </div>
    `;
  }

  function renderResults(resultsEl, places) {
    const list = Array.isArray(places) ? places : [];
    if (!list.length) {
      resultsEl.innerHTML = buildInlineMessage(
        "No cafes found",
        "We couldn’t find cafes for that search. Try a nearby city, a different pincode, or fewer filters.",
      );
      return;
    }

    resultsEl.innerHTML = BrewMap.renderPlacesToHtml(list);
  }

  function clearNotice() {
    document.querySelectorAll(".search-left .empty-state").forEach((node) => {
      node.remove();
    });
  }

  window.addEventListener("load", async () => {
    const data = parsePageData();
    const resultsEl = document.getElementById("results");
    const loadingEl = document.getElementById("results-loading");
    const form = document.getElementById("search-form");
    const queryInput = form.querySelector('input[name="q"]');
    const headline = document.querySelector(".results-head span");

    await BrewMap.initMap("map");

    // Initialize filter UI early so initial searches respect URL params
    if (window.Filters) {
      window.Filters.init(document.querySelector(".filter-chips"), {
        onChange: (filters) => {
          const current = queryInput.value || data.query || "";
          if (current) runSearch(current);
        },
      });
      try {
        const params = new URLSearchParams(location.search || "");
        [
          "wifi",
          "vegan",
          "outdoorSeating",
          "codingFriendly",
          "quiet",
          "fastInternet",
        ].forEach((k) => {
          const v = params.get(k);
          if (v === "1" || v === "true" || v === "yes")
            window.Filters.setFilter(k);
        });
      } catch (e) {}
    }

    const setCount = (count) => {
      headline.textContent = `${count} cafes`;
    };

    const showInlineMessage = (title, message, error = false) => {
      resultsEl.hidden = false;
      loadingEl.hidden = true;
      clearNotice();
      resultsEl.innerHTML = buildInlineMessage(title, message, error);
      setCount(0);
    };

    const runSearch = async (queryText) => {
      const normalizedQuery = String(queryText || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!normalizedQuery) {
        showInlineMessage(
          "Enter a search term",
          "Please type a city, pincode, address, or cafe name before searching.",
        );
        return [];
      }
      resultsEl.hidden = true;
      loadingEl.hidden = false;
      try {
        const filters = window.Filters ? window.Filters.getActiveFilters() : {};
        const places = await BrewMap.searchAndRender({
          q: normalizedQuery,
          mapContainerId: "map",
          filters,
          resultsRenderer: (items) => {
            resultsEl.hidden = false;
            loadingEl.hidden = true;
            renderResults(resultsEl, items);
            setCount((items || []).length);
          },
        });
        resultsEl.hidden = false;
        loadingEl.hidden = true;
        clearNotice();
        setCount((places || []).length);
        return places;
      } catch (err) {
        loadingEl.hidden = true;
        resultsEl.hidden = false;
        resultsEl.innerHTML = buildInlineMessage(
          "Search service unavailable",
          "Location service temporarily unavailable.",
          true,
        );
        setCount(0);
        return [];
      }
    };

    if (Array.isArray(data.results) && data.results.length) {
      clearNotice();
      BrewMap.addPlaces(data.results);
      renderResults(resultsEl, data.results);
      setCount(data.results.length);
    } else if (data.searchError) {
      resultsEl.innerHTML = buildInlineMessage(
        "Search service unavailable",
        data.searchError,
        true,
      );
      setCount(0);
    }

    if (
      data.query &&
      !(Array.isArray(data.results) && data.results.length) &&
      !data.searchError
    ) {
      await runSearch(data.query);
    }

    BrewMap.bindSuggestions({
      inputSelector: '.search-toolbar .search-bar input[name="q"]',
      listSelector: "#search-suggestions",
      onSelect: (item) => {
        queryInput.value = item.name || item.displayName || "";
        runSearch(queryInput.value);
      },
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      runSearch(queryInput.value);
    });

    // Filters were initialized earlier to ensure initial runSearch picks them up

    resultsEl.addEventListener("click", (event) => {
      const target = event.target.closest("#retry-search");
      if (!target) return;
      runSearch(queryInput.value || data.query || "");
    });
  });
})();
