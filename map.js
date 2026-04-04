(function () {
  const mapRoot = document.querySelector("[data-hex-map]");
  const mapViewport = document.querySelector("[data-hex-map-viewport]");
  const mapScaleRoot = document.querySelector("[data-hex-map-scale]");
  const hoverStatus = document.querySelector("[data-map-hover-status]");
  const selectionTitle = document.querySelector("[data-map-selection-title]");
  const selectionMeta = document.querySelector("[data-map-selection-meta]");
  const selectionCopy = document.querySelector("[data-map-selection-copy]");
  const saveStatus = document.querySelector("[data-map-save-status]");
  const zoomInButton = document.querySelector("[data-map-zoom-in]");
  const zoomOutButton = document.querySelector("[data-map-zoom-out]");
  const zoomResetButton = document.querySelector("[data-map-zoom-reset]");
  const resetAllButton = document.querySelector("[data-map-reset-all]");
  const pickerRoot = document.querySelector("[data-map-picker]");
  const pickerTitle = document.querySelector("[data-map-picker-title]");
  const pickerCopy = document.querySelector("[data-map-picker-copy]");
  const pickerTabs = document.querySelector("[data-map-picker-tabs]");
  const pickerSubtabs = document.querySelector("[data-map-picker-subtabs]");
  const pickerGrid = document.querySelector("[data-map-picker-grid]");
  const pickerDismissButtons = document.querySelectorAll("[data-map-picker-dismiss]");

  if (
    !mapRoot ||
    !mapViewport ||
    !mapScaleRoot ||
    !hoverStatus ||
    !selectionTitle ||
    !selectionMeta ||
    !selectionCopy ||
    !saveStatus ||
    !zoomInButton ||
    !zoomOutButton ||
    !zoomResetButton ||
    !pickerRoot ||
    !pickerTitle ||
    !pickerCopy ||
    !pickerTabs ||
    !pickerSubtabs ||
    !pickerGrid ||
    !pickerDismissButtons.length
  ) {
    return;
  }

  const TILE_ART_WIDTH = 256;
  const TILE_ART_HEIGHT = 384;
  const TILE_FOOTPRINT = 256;
  const TILE_OVERHANG = TILE_ART_HEIGHT - TILE_FOOTPRINT;
  const GRID_COLUMNS = 30;
  const GRID_ROWS = 30;
  const MAP_PADDING_X = 24;
  const MAP_PADDING_TOP = 0;
  const MAP_PADDING_BOTTOM = 24;
  const DEFAULT_EDIT_SCALE = 1;
  const MAX_SCALE = 0.7;
  const MIN_SCALE = 0.035;
  const MAP_DATA_PATH = "map-data.json";
  const MAP_DATA_ENDPOINT = "/api/map-data";
  const MAP_TILE_SAVE_ENDPOINT = "/api/map-tile";
  const MAP_TILE_CATALOG_ENDPOINT = "/api/map-tile-catalog";
  const MAP_EVENTS_ENDPOINT = "/api/map-events";
  const MAP_TILE_CATALOG_PATH = "map-tile-catalog.json";
  const LOCAL_BACKUP_KEY = "ngp-map-local-backup";
  const PICKER_VIEW_STORAGE_KEY = "ngp-map-picker-view";
  const ASSET_ROOT_CANDIDATES = ["Map", "Maps", "map", "maps"];
  // Editor toggles:
  // Set EDIT_MODE_ENABLED to false if tile clicks should only inspect tile info.
  // Set SHOW_RESET_BUTTON to true to show the full-board "Reset To Base 1" button.
  const EDIT_MODE_ENABLED = true;
  const SHOW_RESET_BUTTON = false;
  let assetRootPrefix = "Map";

  const CATEGORY_ORDER = ["Basic", "Locations", "Water", "Cold", "Tropics"];
  const OVERLAY_GROUP_TO_SLOT = {
    roads: "roads",
    rivers: "rivers",
    coasts: "coasts",
  };
  const OVERLAY_SLOT_ORDER = ["coasts", "rivers", "roads"];
  const PAN_DRAG_THRESHOLD = 4;
  const LEGACY_TILE_NAMES = {
    base: "Basic/Tiles/hexBase00.png",
    "desert-dunes": "Basic/Tiles/hexDesertDunes00.png",
    dirt: "Basic/Tiles/hexDirt00.png",
    "forest-broadleaf": "Basic/Tiles/hexForestBroadleaf00.png",
    highlands: "Basic/Tiles/hexHighlands00.png",
    hills: "Basic/Tiles/hexHills00.png",
    marsh: "Basic/Tiles/hexMarsh00.png",
    mountain: "Basic/Tiles/hexMountain00.png",
    ocean: "Basic/Tiles/hexOcean00.png",
    plains: "Basic/Tiles/hexPlains00.png",
    scrublands: "Basic/Tiles/hexScrublands00.png",
    woodlands: "Basic/Tiles/hexWoodlands00.png",
  };
  // Pointy-top / pointy-bottom hexes with vertical side faces.
  const COLUMN_STEP = 256;
  const ROW_STEP = 192;
  const ODD_ROW_OFFSET = 128;

  const terrainByKey = new Map();
  const terrainsByCategory = new Map();
  const pickerGroupsByCategory = new Map();
  const tileLookup = new Map();
  let selectedTile = null;
  let selectedTiles = [];
  let mapScale = DEFAULT_EDIT_SCALE;
  let fitScale = DEFAULT_EDIT_SCALE;
  let activePickerCategory = "Basic";
  let activePickerSubgroup = null;
  let viewportHeight = 0;
  let panX = 0;
  let panY = 0;
  let suppressNextClick = false;
  let selectionDrag = null;
  let mapRevision = 0;
  let mapLoadedFromApi = false;
  let mapEvents = null;

  function loadStoredPickerView() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(PICKER_VIEW_STORAGE_KEY) || "{}");
      return {
        category: typeof stored.category === "string" ? stored.category : "Basic",
        subgroup: typeof stored.subgroup === "string" ? stored.subgroup : "tiles",
      };
    } catch (error) {
      return {
        category: "Basic",
        subgroup: "tiles",
      };
    }
  }

  function storePickerView() {
    try {
      window.localStorage.setItem(
        PICKER_VIEW_STORAGE_KEY,
        JSON.stringify({
          category: activePickerCategory,
          subgroup: activePickerSubgroup,
        })
      );
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function withAssetRoot(relativePath) {
    return `${assetRootPrefix}/${String(relativePath || "").replace(/^\/+/, "")}`;
  }

  function buildLegacyTileMap() {
    const mapping = {};

    Object.entries(LEGACY_TILE_NAMES).forEach(function ([key, value]) {
      mapping[key] = withAssetRoot(value);
    });

    return mapping;
  }

  function normalizeAssetPath(rawPath) {
    if (typeof rawPath !== "string" || !rawPath) {
      return rawPath;
    }

    return rawPath.replace(/^(?:Map|Maps|map|maps)\//, `${assetRootPrefix}/`);
  }

  function prettifyTileName(input) {
    const fileName = String(input || "").split("/").pop() || "";
    const stem = fileName.replace(/\.[^.]+$/, "");
    let label = stem.startsWith("hex") ? stem.slice(3) : stem;
    label = label.replace(/_/g, " ").replace(/-/g, " ");
    label = label.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    label = label.replace(/\s+/g, " ").trim();
    return label || fileName || "Unnamed Tile";
  }

  function createFallbackTileCatalog() {
    return {
      categories: [
        {
          name: "Basic",
          groups: [
            {
              id: "tiles",
              label: "Tiles",
              tiles: [
                { key: withAssetRoot("Basic/Tiles/hexBase00.png"), image: withAssetRoot("Basic/Tiles/hexBase00.png"), name: "Base" },
                { key: withAssetRoot("Basic/Tiles/hexPlains00.png"), image: withAssetRoot("Basic/Tiles/hexPlains00.png"), name: "Plains" },
                { key: withAssetRoot("Basic/Tiles/hexForestBroadleaf00.png"), image: withAssetRoot("Basic/Tiles/hexForestBroadleaf00.png"), name: "Broadleaf Forest" },
                { key: withAssetRoot("Basic/Tiles/hexMountain00.png"), image: withAssetRoot("Basic/Tiles/hexMountain00.png"), name: "Mountain" },
              ],
            },
          ],
          tiles: [
            { key: withAssetRoot("Basic/Tiles/hexBase00.png"), image: withAssetRoot("Basic/Tiles/hexBase00.png"), name: "Base" },
            { key: withAssetRoot("Basic/Tiles/hexPlains00.png"), image: withAssetRoot("Basic/Tiles/hexPlains00.png"), name: "Plains" },
            { key: withAssetRoot("Basic/Tiles/hexForestBroadleaf00.png"), image: withAssetRoot("Basic/Tiles/hexForestBroadleaf00.png"), name: "Broadleaf Forest" },
            { key: withAssetRoot("Basic/Tiles/hexMountain00.png"), image: withAssetRoot("Basic/Tiles/hexMountain00.png"), name: "Mountain" },
          ],
        },
        {
          name: "Locations",
          groups: [
            {
              id: "tiles",
              label: "Tiles",
              tiles: [
                { key: withAssetRoot("Locations/Tiles/hexPlainsVillage00.png"), image: withAssetRoot("Locations/Tiles/hexPlainsVillage00.png"), name: "Plains Village" },
              ],
            },
            {
              id: "roads",
              label: "Roads",
              tiles: [],
            },
          ],
          tiles: [
            { key: withAssetRoot("Locations/Tiles/hexPlainsVillage00.png"), image: withAssetRoot("Locations/Tiles/hexPlainsVillage00.png"), name: "Plains Village" },
          ],
        },
        {
          name: "Water",
          groups: [
            {
              id: "tiles",
              label: "Tiles",
              tiles: [
                { key: withAssetRoot("Water/Tiles/hexOceanCalm00.png"), image: withAssetRoot("Water/Tiles/hexOceanCalm00.png"), name: "Ocean Calm" },
              ],
            },
            {
              id: "rivers",
              label: "Rivers",
              tiles: [],
            },
            {
              id: "coasts",
              label: "Coasts",
              tiles: [],
            },
          ],
          tiles: [
            { key: withAssetRoot("Water/Tiles/hexOceanCalm00.png"), image: withAssetRoot("Water/Tiles/hexOceanCalm00.png"), name: "Ocean Calm" },
          ],
        },
        {
          name: "Cold",
          groups: [
            {
              id: "tiles",
              label: "Tiles",
              tiles: [
                { key: withAssetRoot("Cold/Tiles/hexPlainsCold00.png"), image: withAssetRoot("Cold/Tiles/hexPlainsCold00.png"), name: "Cold Plains" },
              ],
            },
          ],
          tiles: [
            { key: withAssetRoot("Cold/Tiles/hexPlainsCold00.png"), image: withAssetRoot("Cold/Tiles/hexPlainsCold00.png"), name: "Cold Plains" },
          ],
        },
        {
          name: "Tropics",
          groups: [
            {
              id: "tiles",
              label: "Tiles",
              tiles: [
                { key: withAssetRoot("Tropics/Tiles/hexTropicalPlains00.png"), image: withAssetRoot("Tropics/Tiles/hexTropicalPlains00.png"), name: "Tropical Plains" },
              ],
            },
          ],
          tiles: [
            { key: withAssetRoot("Tropics/Tiles/hexTropicalPlains00.png"), image: withAssetRoot("Tropics/Tiles/hexTropicalPlains00.png"), name: "Tropical Plains" },
          ],
        },
      ],
    };
  }

  async function detectAssetRoot() {
    function canLoadImage(path) {
      return new Promise(function (resolve) {
        const image = new Image();

        image.onload = function () {
          resolve(true);
        };

        image.onerror = function () {
          resolve(false);
        };

        image.src = `${path}?v=${Date.now()}`;
      });
    }

    for (const candidate of ASSET_ROOT_CANDIDATES) {
      const works = await canLoadImage(`${candidate}/Basic/Tiles/hexBase00.png`);

      if (works) {
        assetRootPrefix = candidate;
        return;
      }
    }
  }

  function ingestTileCatalog(rawCatalog) {
    terrainByKey.clear();
    terrainsByCategory.clear();
    pickerGroupsByCategory.clear();

    CATEGORY_ORDER.forEach(function (category) {
      terrainsByCategory.set(category, []);
      pickerGroupsByCategory.set(category, []);
    });

    const categories = rawCatalog && Array.isArray(rawCatalog.categories) ? rawCatalog.categories : [];

    categories.forEach(function (categoryBlock) {
      const categoryName = String(categoryBlock && categoryBlock.name ? categoryBlock.name : "");
      if (!terrainsByCategory.has(categoryName)) {
        return;
      }

      const normalizedGroups = [];
      const groups = Array.isArray(categoryBlock.groups) ? categoryBlock.groups : [];

      groups.forEach(function (group) {
        const groupId = String(group && group.id ? group.id : "");
        const groupLabel = String(group && group.label ? group.label : prettifyTileName(groupId));
        const groupTiles = [];
        const tiles = Array.isArray(group && group.tiles) ? group.tiles : [];

        tiles.forEach(function (tile) {
          const key = String(tile && tile.key ? tile.key : "");
          if (!key) {
            return;
          }

          const normalizedKey = normalizeAssetPath(key);
          const descriptor =
            terrainByKey.get(normalizedKey) ||
            {
              key: normalizedKey,
              name: String(tile && tile.name ? tile.name : prettifyTileName(key)),
              image: normalizeAssetPath(String(tile && tile.image ? tile.image : key)),
              category: categoryName,
              blurb: `${categoryName} terrain tile.`,
            };

          if (!terrainByKey.has(normalizedKey)) {
            terrainByKey.set(descriptor.key, descriptor);
          }

          groupTiles.push(descriptor);
        });

        if (groupId) {
          normalizedGroups.push({
            id: groupId,
            label: groupLabel,
            tiles: groupTiles,
          });
        }
      });

      pickerGroupsByCategory.set(categoryName, normalizedGroups);

      const tiles = Array.isArray(categoryBlock.tiles) ? categoryBlock.tiles : [];
      tiles.forEach(function (tile) {
        const key = String(tile && tile.key ? tile.key : "");
        if (!key) {
          return;
        }

        const normalizedKey = normalizeAssetPath(key);
        const descriptor =
          terrainByKey.get(normalizedKey) ||
          {
            key: normalizedKey,
            name: String(tile && tile.name ? tile.name : prettifyTileName(key)),
            image: normalizeAssetPath(String(tile && tile.image ? tile.image : key)),
            category: categoryName,
            blurb: `${categoryName} terrain tile.`,
          };

        if (!terrainByKey.has(normalizedKey)) {
          terrainByKey.set(descriptor.key, descriptor);
        }
        terrainsByCategory.get(categoryName).push(descriptor);
      });
    });

    if (!terrainByKey.size) {
      ingestTileCatalog(createFallbackTileCatalog());
    }
  }

  async function loadTileCatalog() {
    function catalogScore(catalog) {
      const categories = catalog && Array.isArray(catalog.categories) ? catalog.categories : [];
      return categories.reduce(function (total, category) {
        const directTiles = Array.isArray(category.tiles) ? category.tiles.length : 0;
        const groupedTiles = Array.isArray(category.groups)
          ? category.groups.reduce(function (sum, group) {
              return sum + (Array.isArray(group.tiles) ? group.tiles.length : 0);
            }, 0)
          : 0;
        const groupBonus = Array.isArray(category.groups) ? category.groups.length * 1000 : 0;
        return total + directTiles + groupedTiles + groupBonus;
      }, 0);
    }

    let apiCatalog = null;
    let staticCatalog = null;

    try {
      const response = await fetch(`${MAP_TILE_CATALOG_ENDPOINT}?v=${Date.now()}`, { cache: "no-store" });
      if (response.ok) {
        apiCatalog = await response.json();
      }
    } catch (error) {
      apiCatalog = null;
    }

    try {
      const response = await fetch(`${MAP_TILE_CATALOG_PATH}?v=${Date.now()}`, { cache: "no-store" });
      if (response.ok) {
        staticCatalog = await response.json();
      }
    } catch (error) {
      staticCatalog = null;
    }

    const bestCatalog =
      apiCatalog && staticCatalog
        ? catalogScore(staticCatalog) > catalogScore(apiCatalog)
          ? staticCatalog
          : apiCatalog
        : apiCatalog || staticCatalog || createFallbackTileCatalog();

    ingestTileCatalog(bestCatalog);
  }

  function getDefaultTerrainKey() {
    const basicTiles = terrainsByCategory.get("Basic") || [];
    if (basicTiles.length) {
      return basicTiles[0].key;
    }

    const firstTerrain = terrainByKey.values().next();
    return firstTerrain.done ? "" : firstTerrain.value.key;
  }

  function createEmptyOverlays() {
    return {
      roads: null,
      rivers: null,
      coasts: null,
    };
  }

  function shouldRandomMirrorBaseTile() {
    return Math.random() < 0.5;
  }

  function cloneOverlays(source) {
    const next = createEmptyOverlays();
    if (!source || typeof source !== "object") {
      return next;
    }

    OVERLAY_SLOT_ORDER.forEach(function (slot) {
      next[slot] = source[slot] || null;
    });

    return next;
  }

  function resolveOptionalTerrainKey(rawKey) {
    if (typeof rawKey !== "string" || !rawKey) {
      return null;
    }

    const normalizedPath = normalizeAssetPath(rawKey);

    if (terrainByKey.has(normalizedPath)) {
      return normalizedPath;
    }

    return null;
  }

  function normalizeTileState(rawTile) {
    if (typeof rawTile === "string") {
      return {
        baseKey: resolveTerrainKey(rawTile),
        baseFlipped: false,
        overlays: createEmptyOverlays(),
      };
    }

    if (rawTile && typeof rawTile === "object") {
      const overlaysSource =
        rawTile.overlays && typeof rawTile.overlays === "object" ? rawTile.overlays : rawTile;
      const overlays = createEmptyOverlays();

      OVERLAY_SLOT_ORDER.forEach(function (slot) {
        overlays[slot] = resolveOptionalTerrainKey(overlaysSource[slot]);
      });

      return {
        baseKey: resolveTerrainKey(rawTile.baseKey || rawTile.base || rawTile.terrainKey),
        baseFlipped: Boolean(
          rawTile.baseFlipped !== undefined
            ? rawTile.baseFlipped
            : rawTile.mirrored !== undefined
              ? rawTile.mirrored
              : rawTile.flipX
        ),
        overlays: overlays,
      };
    }

    return {
      baseKey: getDefaultTerrainKey(),
      baseFlipped: false,
      overlays: createEmptyOverlays(),
    };
  }

  function serializeTileState(tileData) {
    return {
      baseKey: tileData.baseKey,
      baseFlipped: Boolean(tileData.baseFlipped),
      overlays: cloneOverlays(tileData.overlays),
    };
  }

  function getDefaultTerrainPool() {
    const basicTiles = terrainsByCategory.get("Basic") || [];
    if (basicTiles.length) {
      return basicTiles.map(function (terrain) {
        return terrain.key;
      });
    }

    return Array.from(terrainByKey.keys());
  }

  function resolveTerrainKey(rawKey) {
    const legacyTileMap = buildLegacyTileMap();

    if (typeof rawKey === "string") {
      const normalizedPath = normalizeAssetPath(rawKey);

      if (terrainByKey.has(normalizedPath)) {
        return normalizedPath;
      }

      if (legacyTileMap[rawKey] && terrainByKey.has(legacyTileMap[rawKey])) {
        return legacyTileMap[rawKey];
      }
    }

    return getDefaultTerrainKey();
  }

  function createSeededRandom(seed) {
    let value = seed >>> 0;

    return function () {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createDefaultMapData() {
    const random = createSeededRandom(90210);
    const terrainPool = getDefaultTerrainPool();
    const rows = [];

    for (let row = 0; row < GRID_ROWS; row += 1) {
      const rowData = [];

      for (let column = 0; column < GRID_COLUMNS; column += 1) {
        rowData.push({
          baseKey: terrainPool[Math.floor(random() * terrainPool.length)] || getDefaultTerrainKey(),
          baseFlipped: false,
          overlays: createEmptyOverlays(),
        });
      }

      rows.push(rowData);
    }

    return {
      columns: GRID_COLUMNS,
      rows: GRID_ROWS,
      tiles: rows,
    };
  }

  function normalizeMapData(rawData) {
    const tiles = [];
    const sourceRows = rawData && Array.isArray(rawData.tiles) ? rawData.tiles : [];

    for (let row = 0; row < GRID_ROWS; row += 1) {
      const sourceRow = Array.isArray(sourceRows[row]) ? sourceRows[row] : [];
      const nextRow = [];

      for (let column = 0; column < GRID_COLUMNS; column += 1) {
        nextRow.push(normalizeTileState(sourceRow[column]));
      }

      tiles.push(nextRow);
    }

    return {
      columns: GRID_COLUMNS,
      rows: GRID_ROWS,
      tiles: tiles,
    };
  }

  async function loadMapData() {
    try {
      const response = await fetch(`${MAP_DATA_ENDPOINT}?v=${Date.now()}`, { cache: "no-store" });

      if (response.ok) {
        const payload = await response.json();
        const normalized = normalizeMapData(payload);
        normalized.revision = Number(payload && payload.revision ? payload.revision : 0);
        normalized.source = "api";
        return normalized;
      }
    } catch (error) {
      // Fall through to static file or generated default.
    }

    try {
      const response = await fetch(`${MAP_DATA_PATH}?v=${Date.now()}`, { cache: "no-store" });

      if (response.ok) {
        const normalized = normalizeMapData(await response.json());
        normalized.revision = 0;
        normalized.source = "static";
        return normalized;
      }
    } catch (error) {
      // Fall through to generated default.
    }

    const fallback = createDefaultMapData();
    fallback.revision = 0;
    fallback.source = "generated";
    return fallback;
  }

  function applyLocalBackup(mapData) {
    let backup = {};

    try {
      backup = JSON.parse(window.localStorage.getItem(LOCAL_BACKUP_KEY) || "{}");
    } catch (error) {
      backup = {};
    }

    if (!backup || typeof backup !== "object") {
      return mapData;
    }

    Object.entries(backup).forEach(function ([key, tileState]) {
      const match = /^(\d+):(\d+)$/.exec(key);

      if (!match) {
        return;
      }

      const column = Number(match[1]);
      const row = Number(match[2]);

      if (row < 0 || row >= GRID_ROWS || column < 0 || column >= GRID_COLUMNS) {
        return;
      }

      mapData.tiles[row][column] = normalizeTileState(tileState);
    });

    return mapData;
  }

  function toCoordinate(columnIndex, rowIndex) {
    let value = columnIndex;
    let label = "";

    do {
      label = String.fromCharCode(65 + (value % 26)) + label;
      value = Math.floor(value / 26) - 1;
    } while (value >= 0);

    return `${label}${rowIndex + 1}`;
  }

  function getTileKey(column, row) {
    return `${column}:${row}`;
  }

  function setSaveStatus(message, tone) {
    saveStatus.textContent = message;
    saveStatus.dataset.tone = tone || "neutral";
  }

  function clearLocalBackup() {
    try {
      window.localStorage.removeItem(LOCAL_BACKUP_KEY);
    } catch (storageError) {
      // Ignore backup clearing failure.
    }
  }

  function clearTileBackup(column, row) {
    try {
      const backup = JSON.parse(window.localStorage.getItem(LOCAL_BACKUP_KEY) || "{}");
      delete backup[getTileKey(column, row)];
      if (Object.keys(backup).length) {
        window.localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(backup));
      } else {
        window.localStorage.removeItem(LOCAL_BACKUP_KEY);
      }
    } catch (storageError) {
      // Ignore backup clearing failure.
    }
  }

  function storeTileBackup(column, row, tileState) {
    try {
      const backup = JSON.parse(window.localStorage.getItem(LOCAL_BACKUP_KEY) || "{}");
      backup[getTileKey(column, row)] = tileState;
      window.localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(backup));
    } catch (storageError) {
      // Ignore backup storage failure.
    }
  }

  function storeFullMapBackup(baseKey) {
    try {
      const backup = {};

      for (let row = 0; row < GRID_ROWS; row += 1) {
        for (let column = 0; column < GRID_COLUMNS; column += 1) {
          backup[getTileKey(column, row)] = {
            baseKey: baseKey,
            baseFlipped: false,
            overlays: createEmptyOverlays(),
          };
        }
      }

      window.localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(backup));
    } catch (storageError) {
      // Ignore backup storage failure.
    }
  }

  function describeTileOverlays(tileData) {
    const labels = [];

    OVERLAY_SLOT_ORDER.forEach(function (slot) {
      const terrain = tileData.overlayTerrains[slot];
      if (terrain) {
        labels.push(terrain.name);
      }
    });

    return labels;
  }

  function updateTileVisual(tileData) {
    tileData.baseKey = resolveTerrainKey(tileData.baseKey);
    tileData.baseTerrain = terrainByKey.get(tileData.baseKey) || terrainByKey.get(getDefaultTerrainKey());
    tileData.art.src = tileData.baseTerrain.image;
    tileData.art.style.transform = tileData.baseFlipped ? "scaleX(-1)" : "";

    OVERLAY_SLOT_ORDER.forEach(function (slot) {
      const resolvedKey = resolveOptionalTerrainKey(tileData.overlays[slot]);
      const overlayTerrain = resolvedKey ? terrainByKey.get(resolvedKey) || null : null;
      const overlayArt = tileData.overlayArts[slot];

      tileData.overlays[slot] = overlayTerrain ? resolvedKey : null;
      tileData.overlayTerrains[slot] = overlayTerrain;

      if (overlayArt) {
        if (overlayTerrain) {
          overlayArt.src = overlayTerrain.image;
          overlayArt.hidden = false;
        } else {
          overlayArt.hidden = true;
          overlayArt.removeAttribute("src");
        }
      }
    });

    const overlayLabels = describeTileOverlays(tileData);
    const overlayCopy = overlayLabels.length ? ` with overlays: ${overlayLabels.join(", ")}` : "";
    tileData.button.setAttribute("aria-label", `${tileData.baseTerrain.name} at ${tileData.coordinate}${overlayCopy}`);
  }

  function setSelection(tileData) {
    selectedTile = tileData;
    if (selectedTiles.length > 1) {
      const coordinates = selectedTiles.slice(0, 8).map(function (entry) {
        return entry.coordinate;
      });
      const suffix = selectedTiles.length > 8 ? ` +${selectedTiles.length - 8} more` : "";
      const sameTerrain = selectedTiles.every(function (entry) {
        return (
          entry.baseKey === selectedTiles[0].baseKey &&
          OVERLAY_SLOT_ORDER.every(function (slot) {
            return entry.overlays[slot] === selectedTiles[0].overlays[slot];
          })
        );
      });
      selectionTitle.textContent = `${selectedTiles.length} Tiles Selected`;
      selectionMeta.textContent = `${coordinates.join(", ")}${suffix}`;
      selectionCopy.textContent = sameTerrain
        ? `All selected tiles currently use ${selectedTiles[0].baseTerrain.name}${describeTileOverlays(selectedTiles[0]).length ? ` with ${describeTileOverlays(selectedTiles[0]).join(", ")}` : ""}.`
        : "The selected tiles currently contain mixed terrain types.";
      return;
    }

    const overlayLabels = describeTileOverlays(tileData);
    selectionTitle.textContent = `${tileData.baseTerrain.name} • ${tileData.coordinate}`;
    selectionMeta.textContent = `${tileData.baseTerrain.category} • Column ${tileData.column + 1}, Row ${tileData.row + 1} • ${tileData.baseTerrain.image}`;
    selectionCopy.textContent = overlayLabels.length
      ? `${tileData.baseTerrain.blurb} Overlays: ${overlayLabels.join(", ")}.`
      : tileData.baseTerrain.blurb;
  }

  async function saveTileChange(tileData) {
    const payload = {
      column: tileData.column,
      row: tileData.row,
      tile: serializeTileState(tileData),
    };

    setSaveStatus(`Saving ${tileData.coordinate}…`, "saving");

    try {
      const response = await fetch(MAP_TILE_SAVE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Save failed with status ${response.status}`);
      }

      const savedPayload = await response.json();
      mapRevision = Number(savedPayload && savedPayload.revision ? savedPayload.revision : mapRevision);
      clearTileBackup(tileData.column, tileData.row);

      setSaveStatus(`Saved ${tileData.coordinate} to ${MAP_DATA_PATH}.`, "success");
      return;
    } catch (error) {
      storeTileBackup(tileData.column, tileData.row, payload.tile);
      setSaveStatus("Live file save is unavailable. Your change was kept in this browser only.", "warning");
    }
  }

  async function saveTileChanges(tileDataList) {
    if (!tileDataList.length) {
      return;
    }

    if (tileDataList.length === 1) {
      await saveTileChange(tileDataList[0]);
      return;
    }

    setSaveStatus(`Saving ${tileDataList.length} tile changes…`, "saving");

    try {
      const response = await fetch("/api/map-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          updates: tileDataList.map(function (tileData) {
            return {
              column: tileData.column,
              row: tileData.row,
              tile: serializeTileState(tileData),
            };
          }),
        }),
      });

      if (!response.ok) {
        throw new Error(`Batch save failed with status ${response.status}`);
      }

      const savedPayload = await response.json();
      mapRevision = Number(savedPayload && savedPayload.revision ? savedPayload.revision : mapRevision);
      tileDataList.forEach(function (tileData) {
        clearTileBackup(tileData.column, tileData.row);
      });

      setSaveStatus(`Saved ${tileDataList.length} tile changes to ${MAP_DATA_PATH}.`, "success");
    } catch (error) {
      tileDataList.forEach(function (tileData) {
        storeTileBackup(tileData.column, tileData.row, serializeTileState(tileData));
      });
      setSaveStatus("Live file batch save is unavailable. Your changes were kept in this browser only.", "warning");
    }
  }

  async function resetMapToBase() {
    const baseTerrainKey = getDefaultTerrainKey();
    const baseTerrain = terrainByKey.get(baseTerrainKey);

    if (!baseTerrainKey || !baseTerrain) {
      setSaveStatus("Base terrain could not be found.", "warning");
      return;
    }

    if (!window.confirm("Reset every tile on the map to Base 1?")) {
      return;
    }

    closePicker();

    tileLookup.forEach(function (tileData) {
      tileData.baseKey = baseTerrainKey;
      tileData.baseFlipped = false;
      tileData.overlays = createEmptyOverlays();
      updateTileVisual(tileData);
    });

    if (selectedTile) {
      setSelection(selectedTile);
    }

    setSaveStatus("Resetting all tiles to Base 1…", "saving");

    try {
      const response = await fetch("/api/map-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ terrainKey: baseTerrainKey }),
      });

      if (!response.ok) {
        throw new Error(`Reset failed with status ${response.status}`);
      }

      const savedPayload = await response.json();
      mapRevision = Number(savedPayload && savedPayload.revision ? savedPayload.revision : mapRevision);
      clearLocalBackup();

      setSaveStatus(`Reset all ${GRID_COLUMNS * GRID_ROWS} tiles to ${baseTerrain.name}.`, "success");
    } catch (error) {
      storeFullMapBackup(baseTerrainKey);
      setSaveStatus("Live file reset is unavailable. The reset was kept in this browser only.", "warning");
    }
  }

  function applyTileStateToTile(tileData, nextState) {
    const normalized = normalizeTileState(nextState);
    tileData.baseKey = normalized.baseKey;
    tileData.baseFlipped = Boolean(normalized.baseFlipped);
    tileData.overlays = cloneOverlays(normalized.overlays);
    updateTileVisual(tileData);
  }

  function refreshSelectionState() {
    if (selectedTile) {
      setSelection(selectedTile);
    }
    if (!pickerRoot.hidden) {
      renderPickerTiles();
    }
  }

  function applyRemoteTileUpdates(updates) {
    let changed = false;

    updates.forEach(function (update) {
      const tileData = tileLookup.get(getTileKey(Number(update.column), Number(update.row)));
      if (!tileData) {
        return;
      }

      applyTileStateToTile(tileData, update.tile);
      clearTileBackup(tileData.column, tileData.row);
      changed = true;
    });

    if (changed) {
      refreshSelectionState();
    }
  }

  function applyRemoteMapReset(baseKey) {
    tileLookup.forEach(function (tileData) {
      applyTileStateToTile(tileData, {
        baseKey: baseKey,
        baseFlipped: false,
        overlays: createEmptyOverlays(),
      });
    });
    clearLocalBackup();
    refreshSelectionState();
  }

  async function syncMapFromServer() {
    try {
      const payload = await loadMapData();
      mapLoadedFromApi = payload.source === "api";
      if (mapLoadedFromApi) {
        clearLocalBackup();
      }
      mapRevision = Number(payload.revision || 0);

      for (let row = 0; row < GRID_ROWS; row += 1) {
        for (let column = 0; column < GRID_COLUMNS; column += 1) {
          const tileData = tileLookup.get(getTileKey(column, row));
          if (!tileData) {
            continue;
          }
          applyTileStateToTile(tileData, payload.tiles[row][column]);
        }
      }

      refreshSelectionState();
    } catch (error) {
      // Ignore sync failures and keep current view.
    }
  }

  function connectMapEvents() {
    if (!window.EventSource) {
      return;
    }

    if (mapEvents) {
      mapEvents.close();
    }

    mapEvents = new window.EventSource(`${MAP_EVENTS_ENDPOINT}?v=${Date.now()}`);

    mapEvents.addEventListener("ready", function (event) {
      try {
        const payload = JSON.parse(event.data || "{}");
        const revision = Number(payload && payload.revision ? payload.revision : 0);
        if (revision > mapRevision) {
          syncMapFromServer();
        }
      } catch (error) {
        // Ignore malformed ready events.
      }
    });

    mapEvents.addEventListener("tile-update", function (event) {
      try {
        const payload = JSON.parse(event.data || "{}");
        const revision = Number(payload && payload.revision ? payload.revision : 0);
        if (revision && revision <= mapRevision) {
          return;
        }
        mapRevision = revision || mapRevision;
        applyRemoteTileUpdates(Array.isArray(payload.updates) ? payload.updates : []);
      } catch (error) {
        // Ignore malformed update events.
      }
    });

    mapEvents.addEventListener("map-reset", function (event) {
      try {
        const payload = JSON.parse(event.data || "{}");
        const revision = Number(payload && payload.revision ? payload.revision : 0);
        if (revision && revision <= mapRevision) {
          return;
        }
        mapRevision = revision || mapRevision;
        applyRemoteMapReset(payload.baseKey);
      } catch (error) {
        // Ignore malformed reset events.
      }
    });
  }

  function renderPickerTabs() {
    pickerTabs.innerHTML = "";

    CATEGORY_ORDER.forEach(function (category) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-picker__tab";
      button.textContent = category;
      button.classList.toggle("is-active", category === activePickerCategory);
      button.addEventListener("click", function () {
        activePickerCategory = category;
        const groups = pickerGroupsByCategory.get(category) || [];
        activePickerSubgroup = groups.length ? groups[0].id : null;
        storePickerView();
        renderPickerTabs();
        renderPickerSubtabs();
        renderPickerTiles();
      });
      pickerTabs.appendChild(button);
    });
  }

  function renderPickerSubtabs() {
    const groups = pickerGroupsByCategory.get(activePickerCategory) || [];
    pickerSubtabs.innerHTML = "";

    if (groups.length <= 1) {
      pickerSubtabs.hidden = true;
      return;
    }

    if (!activePickerSubgroup || !groups.some(function (group) { return group.id === activePickerSubgroup; })) {
      activePickerSubgroup = groups[0].id;
      storePickerView();
    }

    pickerSubtabs.hidden = false;

    groups.forEach(function (group) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-picker__subtab";
      button.textContent = group.label;
      button.classList.toggle("is-active", group.id === activePickerSubgroup);
      button.addEventListener("click", function () {
        activePickerSubgroup = group.id;
        storePickerView();
        renderPickerSubtabs();
        renderPickerTiles();
      });
      pickerSubtabs.appendChild(button);
    });
  }

  function renderPickerTiles() {
    const groups = pickerGroupsByCategory.get(activePickerCategory) || [];
    const activeGroup =
      groups.find(function (group) {
        return group.id === activePickerSubgroup;
      }) || groups[0];
    const overlaySlot = OVERLAY_GROUP_TO_SLOT[activeGroup && activeGroup.id ? activeGroup.id : ""] || null;
    const tiles = activeGroup ? activeGroup.tiles.slice() : (terrainsByCategory.get(activePickerCategory) || []).slice();
    pickerGrid.innerHTML = "";

    if (overlaySlot) {
      tiles.unshift({
        key: "",
        image: "",
        name: `No ${activeGroup.label}`,
        isClear: true,
      });
    }

    if (!tiles.length) {
      const empty = document.createElement("p");
      empty.className = "map-picker__empty";
      empty.textContent = `No tiles were found in ${activePickerCategory}/Tiles.`;
      pickerGrid.appendChild(empty);
      return;
    }

    tiles.forEach(function (terrain) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-picker__tile";
      button.classList.toggle(
        "is-active",
        selectedTiles.length
          ? selectedTiles.every(function (tileData) {
              return overlaySlot
                ? (tileData.overlays[overlaySlot] || "") === terrain.key
                : tileData.baseKey === terrain.key;
            })
          : selectedTile && (overlaySlot ? (selectedTile.overlays[overlaySlot] || "") === terrain.key : selectedTile.baseKey === terrain.key)
      );
      button.setAttribute("aria-label", `Change selected tile to ${terrain.name}`);

      const swatch = document.createElement("span");
      swatch.className = "map-picker__swatch";
      if (terrain.image) {
        swatch.style.backgroundImage = `url("${terrain.image}")`;
      } else {
        swatch.classList.add("is-empty");
      }

      const label = document.createElement("span");
      label.className = "map-picker__label";
      label.textContent = terrain.name;

      button.appendChild(swatch);
      button.appendChild(label);
      pickerGrid.appendChild(button);

      button.addEventListener("click", function () {
        if (!selectedTiles.length) {
          closePicker();
          return;
        }

        const sameTerrain = selectedTiles.every(function (tileData) {
          return overlaySlot
            ? (tileData.overlays[overlaySlot] || "") === terrain.key
            : tileData.baseKey === terrain.key;
        });

        if (sameTerrain) {
          closePicker();
          return;
        }

        selectedTiles.forEach(function (tileData) {
          if (overlaySlot) {
            tileData.overlays[overlaySlot] = terrain.isClear ? null : terrain.key;
          } else {
            tileData.baseKey = terrain.key;
            tileData.baseFlipped = shouldRandomMirrorBaseTile();
          }
          updateTileVisual(tileData);
        });

        setSelection(selectedTiles[0]);
        renderPickerTiles();
        saveTileChanges(selectedTiles);
        closePicker();
      });
    });
  }

  function openPicker(tileData) {
    const storedView = loadStoredPickerView();
    activePickerCategory = terrainsByCategory.has(storedView.category) ? storedView.category : "Basic";
    const groups = pickerGroupsByCategory.get(activePickerCategory) || [];
    activePickerSubgroup =
      storedView.subgroup && groups.some(function (group) { return group.id === storedView.subgroup; })
        ? storedView.subgroup
        : (groups.length ? groups[0].id : null);
    storePickerView();

    if (selectedTiles.length > 1) {
      pickerTitle.textContent = `${selectedTiles.length} Tiles Selected`;
      pickerCopy.textContent = "Choose a replacement tile and it will be applied across the full current selection.";
    } else {
      pickerTitle.textContent = `${tileData.coordinate} • ${tileData.baseTerrain.name}`;
      pickerCopy.textContent = "Choose a replacement tile from the Basic category or switch tabs to another terrain set.";
    }
    renderPickerTabs();
    renderPickerSubtabs();
    renderPickerTiles();
    pickerRoot.hidden = false;
    document.body.classList.add("is-map-picker-open");
  }

  function closePicker() {
    pickerRoot.hidden = true;
    document.body.classList.remove("is-map-picker-open");
  }

  function calculateFitScale(mapWidth) {
    const availableWidth = Math.max(1, mapViewport.clientWidth - 4);
    return Math.min(1, availableWidth / mapWidth);
  }

  function updateViewportHeight(mapHeight) {
    viewportHeight = Math.max(1, Math.round(mapHeight * fitScale));
    mapViewport.style.height = `${viewportHeight}px`;
  }

  function clampPan(mapWidth, mapHeight) {
    const scaledWidth = Math.round(mapWidth * mapScale);
    const scaledHeight = Math.round(mapHeight * mapScale);
    const viewportWidth = Math.max(1, mapViewport.clientWidth);
    const currentViewportHeight = Math.max(1, viewportHeight || mapViewport.clientHeight || scaledHeight);

    if (scaledWidth <= viewportWidth) {
      panX = Math.round((viewportWidth - scaledWidth) / 2);
    } else {
      const minX = viewportWidth - scaledWidth;
      panX = Math.max(minX, Math.min(0, panX));
    }

    if (scaledHeight <= currentViewportHeight) {
      panY = Math.round((currentViewportHeight - scaledHeight) / 2);
    } else {
      const minY = currentViewportHeight - scaledHeight;
      panY = Math.max(minY, Math.min(0, panY));
    }

    mapViewport.classList.toggle("is-pannable", scaledWidth > viewportWidth || scaledHeight > currentViewportHeight);
  }

  function applyScale(mapWidth, mapHeight) {
    const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, mapScale));

    mapScale = nextScale;
    mapScaleRoot.style.width = `${Math.round(mapWidth * nextScale)}px`;
    mapScaleRoot.style.height = `${Math.round(mapHeight * nextScale)}px`;
    mapRoot.style.transform = `scale(${nextScale})`;
    clampPan(mapWidth, mapHeight);
    mapScaleRoot.style.transform = `translate(${Math.round(panX)}px, ${Math.round(panY)}px)`;
  }

  function clearSelectionVisuals() {
    selectedTiles.forEach(function (tileData) {
      tileData.tile.classList.remove("is-selected");
    });
  }

  function selectTiles(tileDataList) {
    clearSelectionVisuals();

    const uniqueTiles = [];
    const seen = new Set();

    tileDataList.forEach(function (tileData) {
      const key = getTileKey(tileData.column, tileData.row);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      uniqueTiles.push(tileData);
      tileData.tile.classList.add("is-selected");
    });

    selectedTiles = uniqueTiles;
    selectedTile = uniqueTiles[0] || null;

    if (selectedTile) {
      setSelection(selectedTile);
    }
  }

  function isTileInCurrentSelection(tileData) {
    return selectedTiles.some(function (entry) {
      return entry.column === tileData.column && entry.row === tileData.row;
    });
  }

  function buildMap(mapData) {
    const mapWidth = MAP_PADDING_X * 2 + COLUMN_STEP * (GRID_COLUMNS - 1) + TILE_ART_WIDTH + ODD_ROW_OFFSET;
    const mapHeight =
      MAP_PADDING_TOP +
      ROW_STEP * (GRID_ROWS - 1) +
      TILE_ART_HEIGHT +
      MAP_PADDING_BOTTOM;

    mapRoot.innerHTML = "";
    tileLookup.clear();
    mapRoot.style.width = `${mapWidth}px`;
    mapRoot.style.height = `${mapHeight}px`;
    mapRoot.style.transformOrigin = "top left";

    let initialTile = null;

    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      for (let row = 0; row < GRID_ROWS; row += 1) {
        const tileState = normalizeTileState(mapData.tiles[row][column]);
        const coordinate = toCoordinate(column, row);
        const baseX = MAP_PADDING_X + column * COLUMN_STEP + (row % 2 ? ODD_ROW_OFFSET : 0);
        const baseY = MAP_PADDING_TOP + TILE_OVERHANG + row * ROW_STEP;
        const tileTop = baseY - TILE_OVERHANG;
        const zIndex = 10 + row * 100 + column;
        const tileData = {
          column: column,
          row: row,
          coordinate: coordinate,
          baseKey: tileState.baseKey,
          baseFlipped: Boolean(tileState.baseFlipped),
          overlays: cloneOverlays(tileState.overlays),
          overlayTerrains: createEmptyOverlays(),
        };

        const tile = document.createElement("div");
        tile.className = "hex-map__tile";
        tile.style.left = `${baseX}px`;
        tile.style.top = `${tileTop}px`;
        tile.style.zIndex = String(zIndex);

        const art = document.createElement("img");
        art.className = "hex-map__art";
        art.alt = "";
        art.draggable = false;
        tileData.art = art;

        const overlayArts = {};
        OVERLAY_SLOT_ORDER.forEach(function (slot) {
          const overlay = document.createElement("img");
          overlay.className = `hex-map__overlay hex-map__overlay--${slot}`;
          overlay.alt = "";
          overlay.draggable = false;
          overlay.hidden = true;
          overlayArts[slot] = overlay;
        });
        tileData.overlayArts = overlayArts;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "hex-map__hitbox";
        button.setAttribute("aria-label", `${tileData.baseKey} at ${coordinate}`);
        button.dataset.tileKey = getTileKey(column, row);
        tileData.button = button;
        tileData.tile = tile;

        tile.appendChild(art);
        OVERLAY_SLOT_ORDER.forEach(function (slot) {
          tile.appendChild(overlayArts[slot]);
        });
        tile.appendChild(button);
        mapRoot.appendChild(tile);
        tileLookup.set(getTileKey(column, row), tileData);
        updateTileVisual(tileData);

        button.addEventListener("mouseenter", function () {
          hoverStatus.textContent = `${tileData.baseTerrain.name} • ${coordinate}`;
          tile.classList.add("is-hovered");
        });

        button.addEventListener("mouseleave", function () {
          hoverStatus.textContent = "Hover a tile";
          tile.classList.remove("is-hovered");
        });

        button.addEventListener("focus", function () {
          hoverStatus.textContent = `${tileData.baseTerrain.name} • ${coordinate}`;
          tile.classList.add("is-hovered");
        });

        button.addEventListener("blur", function () {
          hoverStatus.textContent = "Hover a tile";
          tile.classList.remove("is-hovered");
        });

        button.addEventListener("pointerdown", function (event) {
          if (event.pointerType !== "touch" && event.button === 0 && event.shiftKey) {
            selectionDrag = {
              mode: "mouse",
              pointerIds: new Set([event.pointerId]),
              tiles: [tileData],
              seen: new Set([button.dataset.tileKey]),
              moved: false,
            };

            selectTiles(selectionDrag.tiles);
            event.preventDefault();
            event.stopPropagation();
            try {
              mapViewport.setPointerCapture(event.pointerId);
            } catch (error) {
              // Ignore capture failures.
            }
            return;
          }

          if (event.pointerType !== "touch" && event.button === 0 && canPanMap()) {
            startPanDrag(
              event,
              "mouse-pending",
              [event.pointerId],
              { x: event.clientX, y: event.clientY },
              tileData
            );
            event.preventDefault();
            event.stopPropagation();
          }
        });

        button.addEventListener("click", function () {
          if (suppressNextClick) {
            suppressNextClick = false;
            return;
          }

          if (isTileInCurrentSelection(tileData)) {
            if (EDIT_MODE_ENABLED) {
              openPicker(tileData);
            }
            return;
          }

          selectTiles([tileData]);
          if (EDIT_MODE_ENABLED) {
            openPicker(tileData);
          }
        });

        if (!initialTile) {
          initialTile = tileData;
        }
      }
    }

    if (initialTile) {
      selectTiles([initialTile]);
    }

    fitScale = calculateFitScale(mapWidth);
    mapScale = fitScale;
    updateViewportHeight(mapHeight);
    applyScale(mapWidth, mapHeight);

    zoomOutButton.addEventListener("click", function () {
      mapScale = Math.max(MIN_SCALE, mapScale * 0.85);
      applyScale(mapWidth, mapHeight);
    });

    zoomInButton.addEventListener("click", function () {
      mapScale = Math.min(MAX_SCALE, mapScale * 1.15);
      applyScale(mapWidth, mapHeight);
    });

    zoomResetButton.addEventListener("click", function () {
      fitScale = calculateFitScale(mapWidth);
      mapScale = fitScale;
      updateViewportHeight(mapHeight);
      applyScale(mapWidth, mapHeight);
    });

    window.addEventListener("resize", function () {
      fitScale = calculateFitScale(mapWidth);
      mapScale = fitScale;
      updateViewportHeight(mapHeight);
      applyScale(mapWidth, mapHeight);
    });

    let dragState = null;
    const activeTouchPoints = new Map();

    function canPanMap() {
      const scaledWidth = Math.round(mapWidth * mapScale);
      const scaledHeight = Math.round(mapHeight * mapScale);
      const viewportWidth = Math.max(1, mapViewport.clientWidth);
      const currentViewportHeight = Math.max(1, viewportHeight || mapViewport.clientHeight || scaledHeight);
      return scaledWidth > viewportWidth || scaledHeight > currentViewportHeight;
    }

    function getTileDataAtPoint(clientX, clientY) {
      const hitElement = document.elementFromPoint(clientX, clientY);
      const hitbox = hitElement && hitElement.closest ? hitElement.closest(".hex-map__hitbox") : null;
      if (!hitbox || !hitbox.dataset.tileKey) {
        return null;
      }
      return tileLookup.get(hitbox.dataset.tileKey) || null;
    }

    function getTrackedTouchPoints(pointerIds) {
      const points = [];
      pointerIds.forEach(function (pointerId) {
        const point = activeTouchPoints.get(pointerId);
        if (point) {
          points.push(point);
        }
      });
      return points;
    }

    function getTouchMidpoint(pointerIds) {
      const points = getTrackedTouchPoints(pointerIds);
      if (!points.length) {
        return null;
      }

      const total = points.reduce(
        function (sum, point) {
          sum.x += point.x;
          sum.y += point.y;
          return sum;
        },
        { x: 0, y: 0 }
      );

      return {
        x: total.x / points.length,
        y: total.y / points.length,
      };
    }

    function addTileToSelectionDrag(tileData) {
      if (!selectionDrag || !tileData) {
        return;
      }

      const tileKey = getTileKey(tileData.column, tileData.row);
      if (selectionDrag.seen.has(tileKey)) {
        return;
      }

      selectionDrag.seen.add(tileKey);
      selectionDrag.tiles.push(tileData);
      selectionDrag.moved = true;
      selectTiles(selectionDrag.tiles);
    }

    function cancelDragState(pointerId) {
      if (!dragState) {
        return;
      }

      if (
        typeof pointerId === "number" &&
        dragState.mode.indexOf("mouse") === 0 &&
        !dragState.pointerIds.has(pointerId)
      ) {
        return;
      }

      mapViewport.classList.remove("is-dragging");
      if (typeof pointerId === "number" && dragState.mode.indexOf("mouse") === 0) {
        try {
          mapViewport.releasePointerCapture(pointerId);
        } catch (error) {
          // Ignore release failures.
        }
      }
      dragState = null;
    }

    function startTouchSelectionDrag(pointerId, tileData) {
      selectionDrag = {
        mode: "touch",
        pointerIds: new Set([pointerId]),
        tiles: tileData ? [tileData] : [],
        seen: tileData ? new Set([getTileKey(tileData.column, tileData.row)]) : new Set(),
        moved: false,
      };

      if (tileData) {
        selectTiles([tileData]);
      }
    }

    function startPanDrag(event, mode, pointerIds, startPoint, sourceTile) {
      dragState = {
        mode: mode,
        pointerIds: new Set(pointerIds),
        startX: startPoint.x,
        startY: startPoint.y,
        originPanX: panX,
        originPanY: panY,
        moved: false,
        sourceTile: sourceTile || null,
      };

      if (mode !== "mouse-pending") {
        mapViewport.classList.add("is-dragging");
      }

      if (mode.indexOf("mouse") === 0) {
        mapViewport.setPointerCapture(event.pointerId);
      }
    }

    mapViewport.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "touch") {
        activeTouchPoints.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });

        const touchTile = getTileDataAtPoint(event.clientX, event.clientY);

        if (activeTouchPoints.size === 1) {
          cancelDragState();
          if (touchTile) {
            startTouchSelectionDrag(event.pointerId, touchTile);
          }
          return;
        }

        if (activeTouchPoints.size >= 2) {
          if (canPanMap()) {
            selectionDrag = null;
            const midpoint = getTouchMidpoint(activeTouchPoints.keys());
            if (midpoint) {
              startPanDrag(event, "touch", activeTouchPoints.keys(), midpoint);
            }
          }
          return;
        }
      }

      const canPan = canPanMap();
      const hitbox = event.target && event.target.closest ? event.target.closest(".hex-map__hitbox") : null;

      if (!canPan || event.button !== 0 || event.shiftKey || hitbox) {
        return;
      }

      startPanDrag(
        event,
        "mouse",
        [event.pointerId],
        { x: event.clientX, y: event.clientY }
      );
    });

    mapViewport.addEventListener("pointermove", function (event) {
      if (event.pointerType === "touch" && activeTouchPoints.has(event.pointerId)) {
        activeTouchPoints.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
      }

      if (selectionDrag) {
        if (selectionDrag.mode === "mouse" && selectionDrag.pointerIds.has(event.pointerId)) {
          addTileToSelectionDrag(getTileDataAtPoint(event.clientX, event.clientY));
          return;
        }

        if (selectionDrag.mode === "touch" && selectionDrag.pointerIds.has(event.pointerId)) {
          activeTouchPoints.forEach(function (point) {
            addTileToSelectionDrag(getTileDataAtPoint(point.x, point.y));
          });
        }
        return;
      }

      if (!dragState) {
        return;
      }

      let currentPoint = null;

      if (dragState.mode === "touch") {
        if (!dragState.pointerIds.has(event.pointerId)) {
          return;
        }

        currentPoint = getTouchMidpoint(dragState.pointerIds);
        if (!currentPoint) {
          return;
        }
      } else {
        if (!dragState.pointerIds.has(event.pointerId)) {
          return;
        }
        currentPoint = { x: event.clientX, y: event.clientY };
      }

      const deltaX = currentPoint.x - dragState.startX;
      const deltaY = currentPoint.y - dragState.startY;

      if (dragState.mode === "mouse-pending") {
        if (Math.abs(deltaX) <= PAN_DRAG_THRESHOLD && Math.abs(deltaY) <= PAN_DRAG_THRESHOLD) {
          return;
        }

        dragState.mode = "mouse";
        dragState.moved = true;
        mapViewport.classList.add("is-dragging");
      } else if (Math.abs(deltaX) > PAN_DRAG_THRESHOLD || Math.abs(deltaY) > PAN_DRAG_THRESHOLD) {
        dragState.moved = true;
      }

      panX = dragState.originPanX + deltaX;
      panY = dragState.originPanY + deltaY;
      clampPan(mapWidth, mapHeight);
      mapScaleRoot.style.transform = `translate(${Math.round(panX)}px, ${Math.round(panY)}px)`;
    });

    function finishDrag(event) {
      if (!dragState) {
        return;
      }

      if (!dragState.pointerIds.has(event.pointerId)) {
        return;
      }

      if (dragState.mode === "touch") {
        dragState.pointerIds.delete(event.pointerId);
        if (dragState.pointerIds.size >= 2) {
          return;
        }
      }

      if (dragState.mode === "mouse-pending") {
        const sourceTile = dragState.sourceTile || null;
        cancelDragState(event.pointerId);
        suppressNextClick = true;

        if (sourceTile) {
          if (!isTileInCurrentSelection(sourceTile)) {
            selectTiles([sourceTile]);
          }

          if (EDIT_MODE_ENABLED) {
            openPicker(sourceTile);
          }
        }
        return;
      }

      if (dragState.moved) {
        suppressNextClick = true;
      }

      mapViewport.classList.remove("is-dragging");
      cancelDragState(event.pointerId);
    }

    function finishSelectionDrag(event) {
      if (!selectionDrag) {
        return;
      }

      if (selectionDrag.mode === "mouse") {
        if (!selectionDrag.pointerIds.has(event.pointerId)) {
          return;
        }

        const draggedTiles = selectionDrag.tiles.slice();
        selectionDrag = null;
        suppressNextClick = draggedTiles.length > 1;
        try {
          mapViewport.releasePointerCapture(event.pointerId);
        } catch (error) {
          // Ignore release failures.
        }

        if (draggedTiles.length) {
          selectTiles(draggedTiles);
        }
        return;
      }

      if (selectionDrag.mode === "touch") {
        activeTouchPoints.delete(event.pointerId);
        selectionDrag.pointerIds.delete(event.pointerId);

        if (selectionDrag.pointerIds.size < 1) {
          const draggedTiles = selectionDrag.tiles.slice();
          selectionDrag = null;
          suppressNextClick = draggedTiles.length > 1;

          if (draggedTiles.length) {
            selectTiles(draggedTiles);
          }
        }
      }
    }

    function forgetTouchPointer(event) {
      if (event.pointerType === "touch") {
        activeTouchPoints.delete(event.pointerId);
      }
    }

    mapViewport.addEventListener("pointerup", forgetTouchPointer);
    mapViewport.addEventListener("pointercancel", forgetTouchPointer);
    mapViewport.addEventListener("pointerup", finishDrag);
    mapViewport.addEventListener("pointercancel", finishDrag);
    mapViewport.addEventListener("pointerup", finishSelectionDrag);
    mapViewport.addEventListener("pointercancel", finishSelectionDrag);
    mapViewport.addEventListener("pointerleave", function (event) {
      if (event.pointerType === "touch") {
        activeTouchPoints.delete(event.pointerId);
      }
      if (selectionDrag) {
        finishSelectionDrag(event);
      }
      if (dragState) {
        finishDrag(event);
      }
    });
  }

  async function init() {
    await detectAssetRoot();
    await loadTileCatalog();
    const loadedMapData = await loadMapData();
    mapLoadedFromApi = loadedMapData.source === "api";
    mapRevision = Number(loadedMapData.revision || 0);
    const mapData = mapLoadedFromApi ? loadedMapData : applyLocalBackup(loadedMapData);

    if (mapLoadedFromApi) {
      clearLocalBackup();
    }

    renderPickerTabs();
    renderPickerSubtabs();
    renderPickerTiles();
    buildMap(mapData);
    setSaveStatus(`Loaded ${GRID_COLUMNS} x ${GRID_ROWS} map data and ${terrainByKey.size} tile options.`, "neutral");
    connectMapEvents();
  }

  pickerDismissButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      closePicker();
    });
  });

  if (resetAllButton) {
    resetAllButton.hidden = !SHOW_RESET_BUTTON;
    resetAllButton.addEventListener("click", function () {
      resetMapToBase();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !pickerRoot.hidden) {
      closePicker();
    }
  });

  window.addEventListener("beforeunload", function () {
    if (mapEvents) {
      mapEvents.close();
    }
  });

  init();
})();
