/* Centralized single-active filter manager
   - Use data-filter attributes on buttons
   - Exposes: init, getActiveFilters, setFilter, clearFilter
*/
(function () {
  const PRIMARY_FILTERS = new Set([
    "wifi",
    "vegan",
    "outdoorSeating",
    "codingFriendly",
    "quiet",
    "fastInternet",
  ]);

  let activeFilter = null;
  let containerEl = null;
  let onChangeCb = null;
  let debounceTimer = null;

  function applyUiState() {
    if (!containerEl) return;
    const buttons = [...containerEl.querySelectorAll("[data-filter]")];
    buttons.forEach((btn) => {
      const name = btn.dataset.filter;
      if (!name) return;
      if (name === "reset") {
        btn.classList.toggle("is-hidden", !activeFilter);
        return;
      }
      const isActive = name === activeFilter;
      btn.classList.toggle("is-active", isActive);
      btn.classList.toggle("is-inactive", !!activeFilter && !isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
  }

  function notifyChange() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (typeof onChangeCb === "function") onChangeCb(getActiveFilters());
    }, 120);
  }

  function getActiveFilters() {
    if (!activeFilter) return {};
    return { [activeFilter]: true };
  }

  function setFilter(name) {
    if (!name || !PRIMARY_FILTERS.has(name)) {
      activeFilter = null;
    } else {
      activeFilter = name;
    }
    applyUiState();
    notifyChange();
  }

  function clearFilter() {
    if (!activeFilter) return;
    activeFilter = null;
    applyUiState();
    notifyChange();
  }

  function toggleFilter(name) {
    if (!name || !PRIMARY_FILTERS.has(name)) return;
    if (activeFilter === name) clearFilter();
    else setFilter(name);
  }

  function onClick(e) {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    e.preventDefault();
    const name = btn.dataset.filter;
    if (name === "reset") return clearFilter();
    // guard against rapid double clicks
    btn.disabled = true;
    setTimeout(() => (btn.disabled = false), 250);
    toggleFilter(name);
  }

  function init(selectorOrEl, options = {}) {
    containerEl =
      typeof selectorOrEl === "string"
        ? document.querySelector(selectorOrEl)
        : selectorOrEl;
    onChangeCb = options.onChange;
    if (!containerEl) return;
    containerEl.addEventListener("click", onClick);
    applyUiState();
  }

  window.Filters = {
    init,
    getActiveFilters,
    setFilter,
    clearFilter,
    toggleFilter,
    _debug: () => ({ activeFilter }),
  };
})();
