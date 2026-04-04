#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
import json
import os
import queue
import random
import re
import threading
import time

ROOT = Path(__file__).resolve().parent
MAP_DATA_FILE = ROOT / "map-data.json"
HOST = os.environ.get("MAP_SERVER_HOST", "0.0.0.0")
PORT = 4173
GRID_COLUMNS = 30
GRID_ROWS = 30
CATEGORY_ORDER = ["Basic", "Locations", "Water", "Cold", "Tropics"]
OVERLAY_SLOTS = ["roads", "rivers", "coasts"]
CATEGORY_GROUPS = {
    "Basic": [
        {"id": "tiles", "label": "Tiles", "folders": ["Tiles"]},
    ],
    "Locations": [
        {"id": "tiles", "label": "Tiles", "folders": ["Tiles"]},
        {"id": "roads", "label": "Roads", "folders": ["Roads"]},
    ],
    "Water": [
        {"id": "tiles", "label": "Tiles", "folders": ["Tiles"]},
        {"id": "rivers", "label": "Rivers", "folders": ["Rivers", "River Mouths"]},
        {"id": "coasts", "label": "Coasts", "folders": ["Coasts"]},
    ],
    "Cold": [
        {"id": "tiles", "label": "Tiles", "folders": ["Tiles"]},
    ],
    "Tropics": [
        {"id": "tiles", "label": "Tiles", "folders": ["Tiles"]},
    ],
}
ASSET_ROOT_CANDIDATES = ["Map", "Maps", "map", "maps"]
MAP_ASSET_ROOT = next((ROOT / name for name in ASSET_ROOT_CANDIDATES if (ROOT / name).exists()), ROOT / "Map")
MAP_ASSET_PREFIX = MAP_ASSET_ROOT.name
LEGACY_TILE_NAMES = {
    "base": "Basic/Tiles/hexBase00.png",
    "desert-dunes": "Basic/Tiles/hexDesertDunes00.png",
    "dirt": "Basic/Tiles/hexDirt00.png",
    "forest-broadleaf": "Basic/Tiles/hexForestBroadleaf00.png",
    "highlands": "Basic/Tiles/hexHighlands00.png",
    "hills": "Basic/Tiles/hexHills00.png",
    "marsh": "Basic/Tiles/hexMarsh00.png",
    "mountain": "Basic/Tiles/hexMountain00.png",
    "ocean": "Basic/Tiles/hexOcean00.png",
    "plains": "Basic/Tiles/hexPlains00.png",
    "scrublands": "Basic/Tiles/hexScrublands00.png",
    "woodlands": "Basic/Tiles/hexWoodlands00.png",
}


def with_asset_root(relative_path):
    return f"{MAP_ASSET_PREFIX}/{str(relative_path).lstrip('/')}"


LEGACY_TILE_MAP = {key: with_asset_root(value) for key, value in LEGACY_TILE_NAMES.items()}
STATE_LOCK = threading.Lock()
SUBSCRIBERS_LOCK = threading.Lock()
EVENT_SUBSCRIBERS = set()
MAP_STATE = None
MAP_REVISION = 0


def prettify_tile_name(stem):
    label = stem
    if label.startswith("hex"):
        label = label[3:]
    label = label.replace("_", " ").replace("-", " ")
    label = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", label)
    label = re.sub(r"\s+", " ", label).strip()
    match = re.match(r"^(.*?)(\d+)(?:\s+(.*))?$", label)
    if match:
        base = match.group(1).strip()
        number = str(int(match.group(2)) + 1)
        suffix = (match.group(3) or "").strip()
        parts = [base, number]
        if suffix:
            parts.append(suffix.title() if suffix.islower() else suffix)
        label = " ".join(part for part in parts if part)
    return label or stem


def build_tile_catalog():
    categories = []

    for category in CATEGORY_ORDER:
        groups = []
        default_tiles = []

        for group_index, group in enumerate(CATEGORY_GROUPS.get(category, [])):
            group_tiles = []

            for folder_name in group["folders"]:
                tiles_dir = MAP_ASSET_ROOT / category / folder_name

                if not tiles_dir.exists():
                    continue

                for file_path in sorted(tiles_dir.glob("*.png")):
                    asset_path = with_asset_root(f"{category}/{folder_name}/{file_path.name}")
                    group_tiles.append(
                        {
                            "key": asset_path,
                            "image": asset_path,
                            "name": prettify_tile_name(file_path.stem),
                            "category": category,
                        }
                    )

            groups.append(
                {
                    "id": group["id"],
                    "label": group["label"],
                    "tiles": group_tiles,
                }
            )

            if group_index == 0:
                default_tiles = list(group_tiles)

        categories.append({"name": category, "tiles": default_tiles, "groups": groups})

    return {"categories": categories}


def build_catalog_index():
    catalog = build_tile_catalog()
    allowed_keys = set()
    basic_keys = []

    for category in catalog["categories"]:
        for tile in category["tiles"]:
            allowed_keys.add(tile["key"])
            if category["name"] == "Basic":
                basic_keys.append(tile["key"])
        for group in category.get("groups", []):
            for tile in group.get("tiles", []):
                allowed_keys.add(tile["key"])
                if category["name"] == "Basic":
                    basic_keys.append(tile["key"])

    default_key = basic_keys[0] if basic_keys else next(iter(allowed_keys), "")
    default_pool = basic_keys if basic_keys else ([default_key] if default_key else [])

    return catalog, allowed_keys, default_pool, default_key


def resolve_terrain_key(raw_key, allowed_keys, default_key):
    if isinstance(raw_key, str):
        if raw_key in allowed_keys:
            return raw_key

        if raw_key in LEGACY_TILE_MAP and LEGACY_TILE_MAP[raw_key] in allowed_keys:
            return LEGACY_TILE_MAP[raw_key]

        normalized_key = re.sub(r"^(Map|Maps|map|maps)/", f"{MAP_ASSET_PREFIX}/", raw_key, count=1)
        if normalized_key in allowed_keys:
            return normalized_key

    return default_key


def resolve_optional_terrain_key(raw_key, allowed_keys):
    if isinstance(raw_key, str) and raw_key:
        normalized_key = re.sub(r"^(Map|Maps|map|maps)/", f"{MAP_ASSET_PREFIX}/", raw_key, count=1)
        if normalized_key in allowed_keys:
            return normalized_key
    return None


def create_empty_overlays():
    return {slot: None for slot in OVERLAY_SLOTS}


def normalize_tile_state(raw_tile, allowed_keys, default_key):
    if isinstance(raw_tile, str):
        return {
            "baseKey": resolve_terrain_key(raw_tile, allowed_keys, default_key),
            "baseFlipped": False,
            "overlays": create_empty_overlays(),
        }

    if isinstance(raw_tile, dict):
        overlays_source = raw_tile.get("overlays")
        if not isinstance(overlays_source, dict):
            overlays_source = raw_tile

        overlays = create_empty_overlays()
        for slot in OVERLAY_SLOTS:
            overlays[slot] = resolve_optional_terrain_key(overlays_source.get(slot), allowed_keys)

        return {
            "baseKey": resolve_terrain_key(
                raw_tile.get("baseKey") or raw_tile.get("base") or raw_tile.get("terrainKey"),
                allowed_keys,
                default_key,
            ),
            "baseFlipped": bool(
                raw_tile["baseFlipped"]
                if "baseFlipped" in raw_tile
                else raw_tile.get("mirrored", raw_tile.get("flipX", False))
            ),
            "overlays": overlays,
        }

    return {
        "baseKey": default_key,
        "baseFlipped": False,
        "overlays": create_empty_overlays(),
    }


def create_default_map_data(default_pool):
    rng = random.Random(90210)

    if not default_pool:
        default_pool = [""]

    return {
        "columns": GRID_COLUMNS,
        "rows": GRID_ROWS,
        "tiles": [
            [
                {
                    "baseKey": rng.choice(default_pool),
                    "baseFlipped": False,
                    "overlays": create_empty_overlays(),
                }
                for _ in range(GRID_COLUMNS)
            ]
            for _ in range(GRID_ROWS)
        ],
    }


def normalize_map_data(payload, allowed_keys, default_key):
    source_rows = payload.get("tiles") if isinstance(payload, dict) else None
    if not isinstance(source_rows, list):
        source_rows = []

    tiles = []
    for row in range(GRID_ROWS):
        source_row = source_rows[row] if row < len(source_rows) and isinstance(source_rows[row], list) else []
        normalized_row = []
        for column in range(GRID_COLUMNS):
            raw_tile = source_row[column] if column < len(source_row) else None
            normalized_row.append(normalize_tile_state(raw_tile, allowed_keys, default_key))
        tiles.append(normalized_row)

    return {
        "columns": GRID_COLUMNS,
        "rows": GRID_ROWS,
        "tiles": tiles,
    }


def load_or_create_map_data(allowed_keys, default_pool, default_key):
    if MAP_DATA_FILE.exists():
        try:
            payload = json.loads(MAP_DATA_FILE.read_text(encoding="utf-8"))
            return normalize_map_data(payload, allowed_keys, default_key)
        except Exception:
            pass

    data = create_default_map_data(default_pool)
    MAP_DATA_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data


def save_map_data(data):
    MAP_DATA_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def clone_tile_state(tile_state):
    return {
        "baseKey": tile_state["baseKey"],
        "baseFlipped": bool(tile_state.get("baseFlipped")),
        "overlays": dict(tile_state["overlays"]),
    }


def clone_map_data(data):
    return {
        "columns": data["columns"],
        "rows": data["rows"],
        "tiles": [
            [clone_tile_state(tile_state) for tile_state in row]
            for row in data["tiles"]
        ],
    }


def ensure_map_state():
    global MAP_STATE
    global MAP_REVISION

    with STATE_LOCK:
        if MAP_STATE is None:
            _, allowed_keys, default_pool, default_key = build_catalog_index()
            MAP_STATE = load_or_create_map_data(allowed_keys, default_pool, default_key)
            MAP_REVISION = max(1, int(time.time() * 1000))


def get_map_snapshot():
    ensure_map_state()
    with STATE_LOCK:
        snapshot = clone_map_data(MAP_STATE)
        snapshot["revision"] = MAP_REVISION
        return snapshot


def register_subscriber():
    subscriber = queue.Queue()
    with SUBSCRIBERS_LOCK:
        EVENT_SUBSCRIBERS.add(subscriber)
    return subscriber


def unregister_subscriber(subscriber):
    with SUBSCRIBERS_LOCK:
        EVENT_SUBSCRIBERS.discard(subscriber)


def broadcast_event(event_name, payload):
    with SUBSCRIBERS_LOCK:
        subscribers = list(EVENT_SUBSCRIBERS)

    for subscriber in subscribers:
        try:
            subscriber.put_nowait((event_name, payload))
        except Exception:
            unregister_subscriber(subscriber)


def update_single_tile(column, row, tile_state):
    global MAP_REVISION
    ensure_map_state()
    with STATE_LOCK:
        MAP_STATE["tiles"][row][column] = clone_tile_state(tile_state)
        MAP_REVISION += 1
        revision = MAP_REVISION
        save_map_data(MAP_STATE)
    return revision


def update_multiple_tiles(updates):
    global MAP_REVISION
    ensure_map_state()
    with STATE_LOCK:
        for update in updates:
            MAP_STATE["tiles"][update["row"]][update["column"]] = clone_tile_state(update["tile"])
        MAP_REVISION += 1
        revision = MAP_REVISION
        save_map_data(MAP_STATE)
    return revision


def reset_full_map(base_key):
    global MAP_REVISION
    ensure_map_state()
    with STATE_LOCK:
        for row in range(GRID_ROWS):
            for column in range(GRID_COLUMNS):
                MAP_STATE["tiles"][row][column] = {
                    "baseKey": base_key,
                    "baseFlipped": False,
                    "overlays": create_empty_overlays(),
                }
        MAP_REVISION += 1
        revision = MAP_REVISION
        save_map_data(MAP_STATE)
    return revision


class MapEditorHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        parsed = urlparse(path)
        relative = parsed.path.lstrip("/") or "index.html"
        return str((ROOT / relative).resolve())

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_sse(self, event_name, payload):
        data = json.dumps(payload, separators=(",", ":"))
        body = f"event: {event_name}\ndata: {data}\n\n".encode("utf-8")
        self.wfile.write(body)
        self.wfile.flush()

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/map-data":
            self._send_json(get_map_snapshot())
            return

        if parsed.path == "/api/map-tile-catalog":
            catalog, _, _, _ = build_catalog_index()
            self._send_json(catalog)
            return

        if parsed.path == "/api/map-events":
            subscriber = register_subscriber()
            try:
                snapshot = get_map_snapshot()
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Connection", "keep-alive")
                self.send_header("X-Accel-Buffering", "no")
                self.end_headers()
                self._send_sse("ready", {"revision": snapshot["revision"]})

                while True:
                    try:
                        event_name, payload = subscriber.get(timeout=15)
                        self._send_sse(event_name, payload)
                    except queue.Empty:
                        self.wfile.write(b": keepalive\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                unregister_subscriber(subscriber)
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/map-batch":
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
                updates = payload.get("updates")
            except Exception:
                self._send_json({"ok": False, "error": "Invalid JSON payload."}, status=400)
                return

            if not isinstance(updates, list) or not updates:
                self._send_json({"ok": False, "error": "Updates must be a non-empty list."}, status=400)
                return

            _, allowed_keys, _, default_key = build_catalog_index()
            applied = []

            for update in updates:
                try:
                    column = int(update.get("column"))
                    row = int(update.get("row"))
                except Exception:
                    self._send_json({"ok": False, "error": "Invalid batch update entry."}, status=400)
                    return

                if not (0 <= column < GRID_COLUMNS and 0 <= row < GRID_ROWS):
                    self._send_json({"ok": False, "error": "Tile coordinate out of bounds."}, status=400)
                    return

                tile_state = normalize_tile_state(update.get("tile") or update.get("terrainKey"), allowed_keys, default_key)
                applied.append({"column": column, "row": row, "tile": tile_state})

            revision = update_multiple_tiles(applied)
            broadcast_event("tile-update", {"revision": revision, "updates": applied})
            self._send_json({"ok": True, "saved": applied, "count": len(applied), "revision": revision})
            return

        if parsed.path == "/api/map-reset":
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
                terrain_key = str(payload.get("terrainKey"))
            except Exception:
                self._send_json({"ok": False, "error": "Invalid JSON payload."}, status=400)
                return

            _, allowed_keys, _, default_key = build_catalog_index()
            resolved_key = resolve_terrain_key(terrain_key, allowed_keys, default_key)

            if resolved_key not in allowed_keys:
                self._send_json({"ok": False, "error": "Unknown terrain key."}, status=400)
                return

            revision = reset_full_map(resolved_key)
            broadcast_event("map-reset", {"revision": revision, "baseKey": resolved_key})
            self._send_json({"ok": True, "saved": {"terrainKey": resolved_key, "count": GRID_COLUMNS * GRID_ROWS}, "revision": revision})
            return

        if parsed.path != "/api/map-tile":
            self.send_error(404, "Unknown endpoint")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            column = int(payload.get("column"))
            row = int(payload.get("row"))
        except Exception:
            self._send_json({"ok": False, "error": "Invalid JSON payload."}, status=400)
            return

        if not (0 <= column < GRID_COLUMNS and 0 <= row < GRID_ROWS):
            self._send_json({"ok": False, "error": "Tile coordinate out of bounds."}, status=400)
            return

        _, allowed_keys, _, default_key = build_catalog_index()
        tile_state = normalize_tile_state(payload.get("tile") or payload.get("terrainKey"), allowed_keys, default_key)
        revision = update_single_tile(column, row, tile_state)
        saved = {"column": column, "row": row, "tile": tile_state}
        broadcast_event("tile-update", {"revision": revision, "updates": [saved]})
        self._send_json({"ok": True, "saved": saved, "revision": revision})


if __name__ == "__main__":
    ensure_map_state()
    server = ThreadingHTTPServer((HOST, PORT), MapEditorHandler)
    server.daemon_threads = True
    print(f"Serving map editor at http://{HOST}:{PORT}/")
    server.serve_forever()
