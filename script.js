const body = document.body;
const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menu-button");
const backdrop = document.getElementById("backdrop");
const currentPage = body.dataset.page;
const root = document.documentElement;
const textFormatter = window.siteTextFormatter || {};

const SEARCH_PAGE_HREF = "search.html";
const SEARCH_PAGE_MANIFEST = [
  {
    href: "index.html",
    title: "Home",
    description: "Home",
    resultLabel: "New Game Plus",
  },
  {
    href: "setting.html",
    title: "Setting",
    description: "Setting",
    resultLabel: "New Game Plus",
  },
  {
    href: "starter-guide.html",
    title: "Starter Guide",
    description: "Starter Guide",
    resultLabel: "New Game Plus",
  },
  {
    href: "starter-traits.html",
    title: "Traits",
    description: "Traits",
    resultLabel: "New Game Plus",
  },
  {
    href: "starter-skills.html",
    title: "Skills",
    description: "Skills",
    resultLabel: "New Game Plus",
  },
  {
    href: "starter-races.html",
    title: "Races",
    description: "Races",
    resultLabel: "New Game Plus",
  },
  {
    href: "skill-examples.html",
    title: "Skill Examples",
    description: "Skill Examples",
    resultLabel: "New Game Plus",
  },
  {
    href: "buffs.html",
    title: "Buffs",
    description: "Buffs",
    resultLabel: "New Game Plus",
  },
  {
    href: "debuffs.html",
    title: "Debuffs",
    description: "Debuffs",
    resultLabel: "New Game Plus",
  },
  {
    href: "magic.html",
    title: "Magic",
    description: "Magic",
    resultLabel: "New Game Plus",
  },
  {
    href: "charisma-actions.html",
    title: "Charisma Actions",
    description: "Charisma Actions",
    resultLabel: "New Game Plus",
  },
  {
    href: "monster-guide.html",
    title: "Monster Guide",
    description: "New Game Plus",
    resultLabel: "New Game Plus",
  },
  {
    href: "evolution-trees.html",
    title: "Evolution Trees",
    description: "New Game Plus",
    resultLabel: "New Game Plus",
  },
  {
    href: "mana-stones.html",
    title: "Mana Stones",
    description: "Mana Stones",
    resultLabel: "New Game Plus",
  },
  {
    href: "map.html",
    title: "Map",
    description: "Map",
    resultLabel: "New Game Plus",
  },
  {
    href: "adventurers-guild.html",
    title: "Adventurer's Guild",
    description: "Adventurer's Guild",
    resultLabel: "New Game Plus",
  },
  {
    href: "alchemy.html",
    title: "Alchemy",
    description: "Alchemy",
    resultLabel: "New Game Plus",
  },
  {
    href: "bot-info.html",
    title: "Bot Info",
    description: "Information about bot commands and utility systems.",
    resultLabel: "New Game Plus",
  },
];

const searchCache = {};
const searchPageContentCache = {};
let searchIndexPromise = null;
let supplementalSearchManifestPromise = null;
const SEARCH_CACHE_VERSION = "2026-04-01-5";

const SEARCH_FIELD_ALIASES = {
  title: "title",
  name: "title",
  page: "title",
  content: "content",
  text: "content",
};

const SEARCH_DATA_SOURCES = {
  monsterGuideData: "monster-guide-data.js",
  evolutionTreeData: "evolution-trees-data.js",
};

const normalizeSearchValue = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const createSearchEntryId = (...parts) =>
  parts
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getSearchEntryCacheKey = (entry) => entry.id || entry.href;

const formatSearchLineName = (name) => String(name || "").replace(/\s+Line$/, "").trim();

const getEntryResultLabel = (entry) => {
  if (!entry || !entry.href) {
    return "New Game Plus";
  }

  if (entry.href.indexOf("#") === -1) {
    return "New Game Plus";
  }

  return entry.resultLabel || entry.description || "New Game Plus";
};

const measureScrollbarWidth = () => {
  const probe = document.createElement("div");

  probe.style.position = "absolute";
  probe.style.top = "-9999px";
  probe.style.width = "120px";
  probe.style.height = "120px";
  probe.style.overflow = "scroll";
  probe.style.visibility = "hidden";

  document.body.appendChild(probe);

  const width = probe.offsetWidth - probe.clientWidth;

  probe.remove();

  return Math.max(0, width);
};

const syncScrollbarReserve = () => {
  if (!root) {
    return;
  }

  root.style.setProperty("--scrollbar-reserve", `${measureScrollbarWidth()}px`);
};

const closeSidebar = () => {
  if (!sidebar || !menuButton || !backdrop) {
    return;
  }

  sidebar.classList.remove("is-open");
  backdrop.classList.remove("is-visible");
  menuButton.setAttribute("aria-expanded", "false");
};

const openSidebar = () => {
  if (!sidebar || !menuButton || !backdrop) {
    return;
  }

  sidebar.classList.add("is-open");
  backdrop.classList.add("is-visible");
  menuButton.setAttribute("aria-expanded", "true");
};

const getCurrentPageHref = () => {
  const pathname = window.location.pathname.split("/").pop();
  return pathname || "index.html";
};

const getSearchFiltersFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const scope = String(params.get("scope") || "title,content");
  const parts = scope
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  return {
    title: parts.includes("title") || !parts.length,
    content: parts.includes("content") || !parts.length,
  };
};

const buildSearchUrl = (query, filters) => {
  const params = new URLSearchParams();
  const cleanedQuery = String(query || "").trim();
  const scopes = [];

  if (cleanedQuery) {
    params.set("q", cleanedQuery);
  }

  if (filters && filters.title) {
    scopes.push("title");
  }

  if (filters && filters.content) {
    scopes.push("content");
  }

  if (scopes.length) {
    params.set("scope", scopes.join(","));
  }

  const queryString = params.toString();
  return queryString ? `${SEARCH_PAGE_HREF}?${queryString}` : SEARCH_PAGE_HREF;
};

const highlightSearchTokens = (text, query) => {
  const source = String(text || "");
  const pieces = [];
  const tokens = [];
  const regex = /"([^"]+)"|(\S+)/g;
  let match;

  while ((match = regex.exec(query || ""))) {
    const token = normalizeSearchValue(match[1] || match[2]);

    if (!token || token === "and" || token === "or" || token === "not") {
      continue;
    }

    if (token[0] === "-") {
      continue;
    }

    const fieldMatch = token.match(/^([a-z]+):(.*)$/);

    if (fieldMatch && SEARCH_FIELD_ALIASES[fieldMatch[1]]) {
      tokens.push(normalizeSearchValue(fieldMatch[2]));
      continue;
    }

    tokens.push(token);
  }

  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean))).sort((a, b) => b.length - a.length);

  if (!uniqueTokens.length) {
    return source;
  }

  let working = source;

  uniqueTokens.forEach((token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    working = working.replace(new RegExp(`(${escaped})`, "ig"), "<mark>$1</mark>");
  });

  return working;
};

const extractSearchTextFromDocument = (doc) => {
  const scope = doc.querySelector("main.content") || doc.body;

  if (!scope) {
    return "";
  }

  const clone = scope.cloneNode(true);

  clone
    .querySelectorAll("script, style, noscript, .topbar, .starter-links, .quick-links, [data-sidebar-root], .backdrop")
    .forEach((node) => node.remove());

  return normalizeSearchValue(clone.textContent || "");
};

const readSearchCache = (cacheKey) => {
  const storageKey = `site-search-cache:${SEARCH_CACHE_VERSION}:${cacheKey}`;

  try {
    const cached = window.sessionStorage.getItem(storageKey);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    return null;
  }
};

const writeSearchCache = (cacheKey, payload) => {
  const storageKey = `site-search-cache:${SEARCH_CACHE_VERSION}:${cacheKey}`;

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (error) {
    return;
  }
};

const loadSearchDataset = async (globalKey) => {
  if (window[globalKey]) {
    return window[globalKey];
  }

  const source = SEARCH_DATA_SOURCES[globalKey];

  if (!source) {
    return [];
  }

  try {
    const response = await fetch(source, { credentials: "same-origin" });

    if (!response.ok) {
      throw new Error(`Failed to load ${source}`);
    }

    const code = await response.text();
    const sandboxWindow = {};
    return new Function("window", `${code}; return window.${globalKey};`)(sandboxWindow) || [];
  } catch (error) {
    return [];
  }
};

const buildMonsterGuideSearchEntries = (lines) => {
  if (!Array.isArray(lines)) {
    return [];
  }

  return lines.flatMap((line) =>
    (line.monsters || []).map((monster) => ({
      id: createSearchEntryId("monster-guide", line.slug, monster.name),
      href: `monster-guide.html?monster=${encodeURIComponent(monster.name)}#${line.slug}`,
      title: monster.name,
      sourceLabel: "Monster Guide",
      description: `Monster Guide - ${formatSearchLineName(line.name)}`,
      resultLabel: `Monster Guide - ${formatSearchLineName(line.name)}`,
      contentText: [
        monster.name,
        line.name,
        monster.origin,
        monster.commonality,
        monster.tagsText,
        monster.description,
        monster.traits,
      ]
        .filter(Boolean)
        .join(" "),
    })),
  );
};

const buildEvolutionTreeSearchEntries = (lines) => {
  if (!Array.isArray(lines)) {
    return [];
  }

  return lines.flatMap((line) => {
    const monsterMap = new Map();

    (line.paths || []).forEach((path) => {
      path.forEach((monsterName, stepIndex) => {
        const existing =
          monsterMap.get(monsterName) || {
            stages: new Set(),
            paths: [],
          };

        existing.stages.add(
          ["Origin", "First Stage", "Second Stage", "Third Stage"][stepIndex] || "Evolution Stage",
        );
        existing.paths.push(path.join(" -> "));
        monsterMap.set(monsterName, existing);
      });
    });

    return Array.from(monsterMap.entries()).map(([monsterName, details]) => ({
      id: createSearchEntryId("evolution-trees", line.slug, monsterName),
      href: `evolution-trees.html?monster=${encodeURIComponent(monsterName)}#${line.slug}`,
      title: monsterName,
      sourceLabel: "Evolution Trees",
      description: `Evolution Trees - ${formatSearchLineName(line.name)}`,
      resultLabel: `Evolution Trees - ${formatSearchLineName(line.name)}`,
      contentText: [
        monsterName,
        line.name,
        Array.from(details.stages).join(" "),
        details.paths.join(" "),
      ]
        .filter(Boolean)
        .join(" "),
    }));
  });
};

const ensureSupplementalSearchManifest = async () => {
  if (!supplementalSearchManifestPromise) {
    supplementalSearchManifestPromise = Promise.all([
      loadSearchDataset("monsterGuideData"),
      loadSearchDataset("evolutionTreeData"),
    ]).then(([monsterGuideData, evolutionTreeData]) => [
      ...buildMonsterGuideSearchEntries(monsterGuideData),
      ...buildEvolutionTreeSearchEntries(evolutionTreeData),
    ]);
  }

  return supplementalSearchManifestPromise;
};

const loadSearchEntry = async (entry) => {
  const cacheKey = getSearchEntryCacheKey(entry);

  if (searchCache[cacheKey]) {
    return searchCache[cacheKey];
  }

  const cached = readSearchCache(cacheKey);

  if (cached) {
    searchCache[cacheKey] = cached;
    return cached;
  }

  const currentHref = getCurrentPageHref();
  let title = entry.title;
  let description = entry.description || "";
  let sourceLabel = entry.sourceLabel || "Page";
  let resultLabel = entry.resultLabel || "New Game Plus";
  let content = normalizeSearchValue(entry.contentText || "");

  if (content || entry.titleText || entry.descriptionText) {
    const payload = {
      id: cacheKey,
      href: entry.href,
      title: title,
      sourceLabel: sourceLabel,
      resultLabel: resultLabel,
      description: description,
      titleText: normalizeSearchValue(entry.titleText || title),
      descriptionText: normalizeSearchValue(entry.descriptionText || description || ""),
      contentText: content,
    };

    searchCache[cacheKey] = payload;
    writeSearchCache(cacheKey, payload);
    return payload;
  }

  if (entry.href === currentHref) {
    const currentTitleNode = document.querySelector("h1");
    const currentDescriptionNode = document.querySelector('meta[name="description"]');
    title = currentTitleNode ? currentTitleNode.textContent.trim() || entry.title : entry.title;
    description = currentDescriptionNode
      ? currentDescriptionNode.getAttribute("content") || description
      : description;
    content = extractSearchTextFromDocument(document);
  } else {
    try {
      let html = searchPageContentCache[entry.href];

      if (!html) {
        const response = await fetch(entry.href, { credentials: "same-origin" });

        if (!response.ok) {
          throw new Error(`Failed to load ${entry.href}`);
        }

        html = await response.text();
        searchPageContentCache[entry.href] = html;
      }

      const doc = new DOMParser().parseFromString(html, "text/html");
      const pageTitle = doc.querySelector("h1");
      const pageDescription = doc.querySelector('meta[name="description"]');

      title = pageTitle ? pageTitle.textContent.trim() || entry.title : entry.title;
      description = pageDescription ? pageDescription.getAttribute("content") || description : description;
      content = extractSearchTextFromDocument(doc);
    } catch (error) {
      content = normalizeSearchValue(description || "");
    }
  }

  const payload = {
    id: cacheKey,
    href: entry.href,
    title: title,
    sourceLabel: sourceLabel,
    resultLabel: resultLabel,
    description: description,
    titleText: normalizeSearchValue(title),
    descriptionText: normalizeSearchValue(description || ""),
    contentText: content,
  };

  searchCache[cacheKey] = payload;
  writeSearchCache(cacheKey, payload);
  return payload;
};

const ensureSearchIndex = async () => {
  if (!searchIndexPromise) {
    searchIndexPromise = ensureSupplementalSearchManifest().then((supplementalEntries) =>
      Promise.all(SEARCH_PAGE_MANIFEST.concat(supplementalEntries).map(loadSearchEntry)),
    );
  }

  return searchIndexPromise;
};

const parseSearchQuery = (query) => {
  const source = String(query || "").trim();
  const regex = /"([^"]+)"|(\S+)/g;
  const rawTokens = [];
  let match;

  while ((match = regex.exec(source))) {
    rawTokens.push(match[1] || match[2]);
  }

  const groups = [[]];
  let negateNext = false;

  rawTokens.forEach((rawToken) => {
    const upper = rawToken.toUpperCase();

    if (upper === "OR") {
      if (groups[groups.length - 1].length) {
        groups.push([]);
      }
      negateNext = false;
      return;
    }

    if (upper === "AND") {
      return;
    }

    if (upper === "NOT") {
      negateNext = true;
      return;
    }

    let token = rawToken;
    let field = null;
    let negate = negateNext;

    negateNext = false;

    if (token.charAt(0) === "-" && token.length > 1) {
      negate = true;
      token = token.slice(1);
    }

    const fieldMatch = token.match(/^([a-z]+):(.*)$/i);

    if (fieldMatch && SEARCH_FIELD_ALIASES[String(fieldMatch[1] || "").toLowerCase()]) {
      field = SEARCH_FIELD_ALIASES[String(fieldMatch[1] || "").toLowerCase()];
      token = fieldMatch[2];
    }

    token = normalizeSearchValue(token);

    if (!token) {
      return;
    }

    groups[groups.length - 1].push({
      field: field,
      negate: negate,
      value: token,
    });
  });

  return groups.filter((group) => group.length);
};

const getSearchFieldsForToken = (entry, token, filters) => {
  if (token.field === "title") {
    return [entry.titleText];
  }

  if (token.field === "content") {
    return [entry.contentText];
  }

  const fields = [];

  if (filters.title) {
    fields.push(entry.titleText);
    fields.push(entry.descriptionText);
  }

  if (filters.content) {
    fields.push(entry.contentText);
  }

  return fields;
};

const matchesSearchToken = (entry, token, filters) =>
  getSearchFieldsForToken(entry, token, filters).some((field) => field.indexOf(token.value) !== -1);

const evaluateSearchGroups = (entry, groups, filters) => {
  if (!groups.length) {
    return true;
  }

  return groups.some((group) =>
    group.every((token) => {
      const matched = matchesSearchToken(entry, token, filters);
      return token.negate ? !matched : matched;
    }),
  );
};

const scoreSearchEntry = (entry, groups, filters) => {
  let score = 0;

  groups.forEach((group) => {
    group.forEach((token) => {
      if (token.negate) {
        return;
      }

      if (token.field === "title" || filters.title) {
        if (entry.titleText.indexOf(token.value) !== -1) {
          score += entry.titleText === token.value ? 120 : 60;
        }

        if (!token.field && entry.descriptionText.indexOf(token.value) !== -1) {
          score += 25;
        }
      }

      if (token.field === "content" || filters.content) {
        if (entry.contentText.indexOf(token.value) !== -1) {
          score += 10;
        }
      }
    });
  });

  return score;
};

const getSnippetForEntry = (entry, groups, filters) => {
  const positives = [];

  groups.forEach((group) => {
    group.forEach((token) => {
      if (!token.negate) {
        positives.push(token.value);
      }
    });
  });

  const firstToken = positives.find(Boolean);

  if (!firstToken) {
    return entry.description || "";
  }

  if ((filters.title || !filters.content) && entry.descriptionText.indexOf(firstToken) !== -1) {
    return entry.description || "";
  }

  const source = entry.contentText;
  const index = source.indexOf(firstToken);

  if (index === -1) {
    return entry.description || "";
  }

  const start = Math.max(0, index - 80);
  const end = Math.min(source.length, index + 140);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < source.length ? "..." : "";

  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
};

const searchPages = async (query, filters) => {
  const cleanedQuery = String(query || "").trim();

  if (!cleanedQuery) {
    return [];
  }

  const entries = await ensureSearchIndex();
  const groups = parseSearchQuery(cleanedQuery);

  return entries
    .filter((entry) => evaluateSearchGroups(entry, groups, filters))
    .map((entry) => ({
      entry,
      score: scoreSearchEntry(entry, groups, filters),
      snippet: getSnippetForEntry(entry, groups, filters),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.entry.title.localeCompare(b.entry.title);
    });
};

const createSearchUtility = () => {
  const topbar = document.querySelector(".topbar");

  if (!topbar || topbar.querySelector("[data-site-search-root]")) {
    return null;
  }

  const utility = document.createElement("div");

  utility.className = "topbar__utility";
  utility.setAttribute("data-site-search-root", "");
  utility.innerHTML =
    '<form class="site-search" data-site-search-form action="' +
    SEARCH_PAGE_HREF +
    '">' +
    '<div class="site-search__field">' +
    '<input class="site-search__input" type="search" name="q" data-site-search-input placeholder="Search pages..." autocomplete="off" spellcheck="false" />' +
    "</div>" +
    '<div class="site-search__dropdown" data-site-search-dropdown hidden></div>' +
    "</form>";

  topbar.appendChild(utility);
  return utility;
};

const setupSearchUtility = () => {
  const utility = createSearchUtility();

  if (!utility) {
    return;
  }

  const form = utility.querySelector("[data-site-search-form]");
  const input = utility.querySelector("[data-site-search-input]");
  const dropdown = utility.querySelector("[data-site-search-dropdown]");
  const initialQuery = new URLSearchParams(window.location.search).get("q");

  if (input && currentPage === "search" && initialQuery) {
    input.value = initialQuery;
  }

  if (!form || !input || !dropdown) {
    return;
  }

  let dropdownRequestId = 0;

  const hideDropdown = () => {
    dropdown.hidden = true;
    dropdown.innerHTML = "";
    utility.classList.remove("is-open");
  };

  const renderDropdown = async () => {
    const query = input.value.trim();
    const requestId = (dropdownRequestId += 1);

    if (query.length < 2) {
      hideDropdown();
      return;
    }

    dropdown.hidden = false;
    utility.classList.add("is-open");
    dropdown.innerHTML = '<div class="site-search__state">Searching...</div>';

    const results = await searchPages(query, { title: true, content: true });

    if (requestId !== dropdownRequestId) {
      return;
    }

    if (!results.length) {
      dropdown.innerHTML =
        '<div class="site-search__state">No pages found.</div>' +
        '<a class="site-search__view-all" href="' +
        buildSearchUrl(query, { title: true, content: true }) +
        '">Open full search</a>';
      return;
    }

    dropdown.innerHTML = results
      .slice(0, 6)
      .map(
        ({ entry, snippet }) =>
          '<a class="site-search__result" href="' +
          entry.href +
          '">' +
          '<span class="site-search__result-title">' +
          highlightSearchTokens(entry.title, query) +
          "</span>" +
          '<span class="site-search__result-meta">' +
          getEntryResultLabel(entry) +
          "</span>" +
          '<span class="site-search__result-copy">' +
          highlightSearchTokens(snippet || entry.description || "", query) +
          "</span>" +
          "</a>",
      )
      .join("") +
      '<a class="site-search__view-all" href="' +
      buildSearchUrl(query, { title: true, content: true }) +
      '">View all results</a>';
  };

  input.addEventListener("focus", () => {
    ensureSearchIndex().catch(() => {});
    renderDropdown();
  });

  input.addEventListener("input", renderDropdown);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    window.location.href = buildSearchUrl(input.value, { title: true, content: true });
  });

  document.addEventListener("click", (event) => {
    if (!utility.contains(event.target)) {
      hideDropdown();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideDropdown();
    }
  });
};

const setupSearchResultsPage = async () => {
  if (currentPage !== "search") {
    return;
  }

  const form = document.querySelector("[data-search-results-form]");
  const input = document.querySelector("[data-search-results-query]");
  const count = document.querySelector("[data-search-results-count]");
  const list = document.querySelector("[data-search-results-list]");
  const empty = document.querySelector("[data-search-results-empty]");
  const titleFilter = document.querySelector("[data-search-filter-title]");
  const contentFilter = document.querySelector("[data-search-filter-content]");
  const queryLabel = document.querySelector("[data-search-query-label]");

  if (!form || !input || !count || !list || !empty || !titleFilter || !contentFilter || !queryLabel) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const query = params.get("q") || "";
  const initialFilters = getSearchFiltersFromUrl();

  input.value = query;
  titleFilter.checked = initialFilters.title;
  contentFilter.checked = initialFilters.content;

  const renderResults = async () => {
    const activeQuery = input.value.trim();
    const filters = {
      title: titleFilter.checked,
      content: contentFilter.checked,
    };

    if (!filters.title && !filters.content) {
      filters.title = true;
      titleFilter.checked = true;
    }

    queryLabel.textContent = activeQuery ? `Results for "${activeQuery}"` : "Search Results";

    if (!activeQuery) {
      count.textContent = "0 Results";
      list.innerHTML = "";
      empty.hidden = false;
      empty.textContent = "Enter a query above to search across the guide pages.";
      return;
    }

    empty.hidden = true;
    list.innerHTML = '<article class="card search-result-card"><p>Searching...</p></article>';

    const results = await searchPages(activeQuery, filters);

    count.textContent = `${results.length} Result${results.length === 1 ? "" : "s"}`;

    if (!results.length) {
      list.innerHTML = "";
      empty.hidden = false;
      empty.textContent = "No pages matched that search with the current filters.";
      return;
    }

    list.innerHTML = results
      .map(
        ({ entry, snippet }) =>
          '<a class="card search-result-card" href="' +
          entry.href +
          '">' +
          '<p class="card__label">' +
          getEntryResultLabel(entry) +
          "</p>" +
          "<h2>" +
          highlightSearchTokens(entry.title, activeQuery) +
          "</h2>" +
          '<p class="formatter-rule">' +
          "</p>" +
          '<p class="search-result-card__copy">' +
          highlightSearchTokens(snippet || entry.description || "", activeQuery) +
          "</p>" +
          "</a>",
      )
      .join("");
  };

  const syncUrlAndRender = () => {
    const filters = {
      title: titleFilter.checked,
      content: contentFilter.checked,
    };
    const nextUrl = buildSearchUrl(input.value, filters);
    window.history.replaceState({}, "", nextUrl);
    renderResults();
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    syncUrlAndRender();
  });

  titleFilter.addEventListener("change", syncUrlAndRender);
  contentFilter.addEventListener("change", syncUrlAndRender);
  renderResults();
};

syncScrollbarReserve();

if (textFormatter.apply) {
  textFormatter.apply(document.body);
}

document.querySelectorAll("[data-nav-page]").forEach((link) => {
  if (link.dataset.navPage === currentPage) {
    link.classList.add("is-active");
  }
});

setupSearchUtility();
setupSearchResultsPage();

if (menuButton) {
  menuButton.addEventListener("click", () => {
    const isExpanded = menuButton.getAttribute("aria-expanded") === "true";

    if (isExpanded) {
      closeSidebar();
      return;
    }

    openSidebar();
  });
}

if (backdrop) {
  backdrop.addEventListener("click", closeSidebar);
}

if (sidebar) {
  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 960) {
        closeSidebar();
      }
    });
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSidebar();
  }
});

window.addEventListener("resize", () => {
  syncScrollbarReserve();

  if (window.innerWidth > 960) {
    closeSidebar();
  }
});
