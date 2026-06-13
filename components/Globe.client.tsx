'use client';

// Interactive 3D globe ported from prototypes/globe/index.html (source of truth).
// Preserves: realistic Phong material + textures, the transparent-but-hit-testable
// country polygon layer, per-country largest-ring + antimeridian fly-in framing,
// glow-on-select, the tap-vs-drag guard, double-tap-empty-space zoom, the zoom-out
// button, and the country-selected payload. The prototype's window CustomEvent is
// replaced by an `onCountrySelect` prop + an imperative handle (flyTo /
// selectCountryByIso). The location-cascade bottom sheet is intentionally NOT
// ported — it belongs to a parent that consumes this component.
//
// STATIC-EXPORT SAFETY: globe.gl and three are browser/WebGL only and are imported
// DYNAMICALLY inside the mount effect (never as top-level VALUE imports), so the
// build-time prerender never evaluates them. The top-level `import type`s below are
// erased at compile time and emit no runtime code.

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import type { GlobeInstance } from 'globe.gl';

import styles from './Globe.module.css';

export type CountrySelection = { name: string; iso: string; lat: number; lng: number };
export type ProvinceSelection = { name: string; code: string; lat: number; lng: number };

// Countries with vendored admin-1 province polygons (province-glow drill-in).
const PROVINCE_COUNTRIES = new Set(['KR', 'CN']);

export type GlobeHandle = {
  /** Fly the camera to a coordinate (e.g. a province/city). altitude optional → keeps current. */
  flyTo: (pov: { lat: number; lng: number; altitude?: number }, ms?: number) => void;
  /**
   * Programmatically select + frame a country by ISO alpha-2. Resolves the ~8
   * Natural-Earth features with no valid ISO_A2 (France, Norway, Kosovo…) via
   * ISO_A2_EH / ADM0_A3 internally. Returns true if a polygon matched + framed,
   * false otherwise (caller should flyTo the country's lat/lng as a fallback).
   */
  selectCountryByIso: (iso: string) => boolean;
  /**
   * Drill into a country's admin-1 boundaries. For 'KR'/'CN' only: lazy-loads +
   * caches the province GeoJSON and swaps the polygon layer to provinces (faint
   * outline at rest, hit-testable). Returns false (no-op) for any other ISO.
   */
  showProvinces: (countryIso: string) => Promise<boolean>;
  /**
   * Glow + frame a province by ISO 3166-2 code (e.g. 'KR-11', 'CN-BJ'), with a
   * normalized-name fallback. Returns true if a province polygon matched.
   */
  selectProvince: (code: string, name?: string) => boolean;
  /** Restore the country polygon layer (call when leaving a KR/CN drill-in). */
  showCountries: () => void;
};

export type GlobeProps = {
  onCountrySelect?: (country: CountrySelection) => void;
  /** Fires when a province polygon is tapped in drill-in mode. */
  onProvinceSelect?: (province: ProvinceSelection) => void;
  className?: string;
};

/* ----------------------------- Tunables (from the prototype) ----------------------------- */
// Day map gated on GPU maxTextureSize (see effect). Still aliasing the 4K blue-marble:
// a genuine public-domain 8192×4096 day map could not be reliably fetched in-script.
// TODO(8K): drop a real 8192×4096 day map at public/globe/earth-day-8k.jpg, then change
// DAY_TEXTURE_8K_URL below to '/globe/earth-day-8k.jpg'. Source options:
//   • NASA Blue Marble (public domain): downscale the 21600×10800 master to 8192×4096.
//   • Solar System Scope "8k_earth_daymap" (CC-BY 4.0 — attribution, not strictly PD).
// The zoom clamp below auto-detects the loaded width and switches to the 8K floor once
// the real file is in place — no further code change needed.
const DAY_TEXTURE_4K_URL = '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg';
const DAY_TEXTURE_8K_URL = DAY_TEXTURE_4K_URL; // ← flip to '/globe/earth-day-8k.jpg' once vendored
const BUMP_TEXTURE_URL = '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png';
const WATER_TEXTURE_URL = '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-water.png';
const COUNTRIES_GEOJSON_URL = '/globe/countries-50m.geojson'; // vendored Natural Earth 50m admin-0
const NAME_PROP = 'ADMIN';
const ISO_PROP = 'ISO_A2';
const ISO_EH_PROP = 'ISO_A2_EH'; // valid alpha-2 for most ISO_A2='-99' features (FR, NO, XK…)

const AUTO_ROTATE_SPEED = 0.175;
const SHOW_ATMOSPHERE = false;
const BUMP_SCALE = 8;
const SHININESS = 12;

const REST_CAP_COLOR = 'rgba(0, 0, 0, 0)';
const REST_STROKE_COLOR = 'rgba(0, 0, 0, 0)';
const SELECTED_CAP_COLOR = 'rgba(109, 179, 255, 0.25)';
const SELECTED_STROKE_COLOR = 'rgba(150, 200, 255, 0.95)';
// Province drill-in: non-selected provinces get a faint (but visible + tappable)
// outline so the subdivisions read as a layer; cap stays transparent.
const PROVINCE_REST_STROKE_COLOR = 'rgba(150, 200, 255, 0.22)';
const PROVINCE_ISO_PROP = 'iso_3166_2';
const PROVINCE_NAME_PROP = 'name_en';
const provinceGeojsonUrl = (iso: string) => `/globe/provinces-${iso.toLowerCase()}.geojson`;
const GLOW_ALTITUDE = 0.01;
const POLYGON_TRANSITION_MS = 350;

const TAP_MOVE_THRESHOLD_PX = 10;
const TAP_TIME_THRESHOLD_MS = 300;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST_PX = 40;
const DOUBLE_TAP_ZOOM_FACTOR = 2;
const TRIPLE_TAP_ZOOM_OUT_FACTOR = 2; // empty-space triple-tap zooms out, symmetric to the double-tap zoom-in

const FRAME_PADDING = 0.75;
const MIN_ALTITUDE = 0.2;
const MAX_ALTITUDE = 2.5;
// Fly-in / camera-animation duration: 2.5× the original 1000ms for a slower, more
// cinematic glide. Single source of truth for every pointOfView() call (country
// framing, province framing, flyTo); the zoom in/out derive from it (/2).
const FLY_DURATION_MS = 2500;
// Closest manual-zoom floor (pointOfView altitude units), per loaded day-map width.
// This CLAMP is the guarantee against visible pixel breaks: 4K can't be zoomed as
// close as 8K. NOTE: unlimited crisp zoom would need tiled/LOD textures — we
// intentionally don't, because Kakao owns ground-level detail and province glow is
// vector. The clamp prevents pixelation; the 8K day map only raises the ceiling.
const MIN_ZOOM_ALTITUDE_4K = 0.12;
const MIN_ZOOM_ALTITUDE_8K = 0.05;
const MAX_ZOOM_ALTITUDE = 5.0;

type GeoFeature = {
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
  properties: Record<string, string | number | null>;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// The countries GeoJSON (~2.9MB) is fetched + parsed once per page load and
// memoized at module scope, so a Globe unmount→remount (leaving onboarding and
// returning, or React StrictMode's dev double-mount) reuses the parse instead of
// re-downloading and re-parsing. Each caller gets FRESH top-level feature objects
// (shallow copies) so globe.gl's per-datum bookkeeping (__threeObj, …) lands on
// the copies and never collides across instances; the heavy geometry/coordinate
// arrays are shared by reference (read-only to globe.gl), where the real cost is.
let countriesGeojsonPromise: Promise<{ features: GeoFeature[] }> | null = null;
function loadCountryFeatures(): Promise<GeoFeature[]> {
  if (!countriesGeojsonPromise) {
    countriesGeojsonPromise = fetch(COUNTRIES_GEOJSON_URL)
      .then((r) => r.json())
      .catch((err) => {
        countriesGeojsonPromise = null; // allow a retry on the next mount
        throw err;
      });
  }
  return countriesGeojsonPromise.then((geo) => geo.features.map((f) => ({ ...f })));
}

const Globe = forwardRef<GlobeHandle, GlobeProps>(function Globe({ onCountrySelect, onProvinceSelect, className }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Latest callbacks without re-running the heavy mount effect on identity change.
  const onSelectRef = useRef<GlobeProps['onCountrySelect']>(onCountrySelect);
  onSelectRef.current = onCountrySelect;
  const onProvinceSelectRef = useRef<GlobeProps['onProvinceSelect']>(onProvinceSelect);
  onProvinceSelectRef.current = onProvinceSelect;

  // Imperative funcs are assigned once the async setup completes; calls before
  // then are safe no-ops.
  const apiRef = useRef<{
    flyTo: GlobeHandle['flyTo'];
    selectCountryByIso: GlobeHandle['selectCountryByIso'];
    showProvinces: GlobeHandle['showProvinces'];
    selectProvince: GlobeHandle['selectProvince'];
    showCountries: GlobeHandle['showCountries'];
    zoomOut: () => void;
  } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (pov, ms) => apiRef.current?.flyTo(pov, ms),
      selectCountryByIso: (iso) => apiRef.current?.selectCountryByIso(iso) ?? false,
      showProvinces: (iso) => apiRef.current?.showProvinces(iso) ?? Promise.resolve(false),
      selectProvince: (code, name) => apiRef.current?.selectProvince(code, name) ?? false,
      showCountries: () => apiRef.current?.showCountries(),
    }),
    [],
  );

  useEffect(() => {
    let disposed = false;
    let cleanup: () => void = () => {};

    (async () => {
      // DYNAMIC value imports — never top-level. Both resolve to the SINGLE
      // deduped `three` (three-globe's peer), so the material we build and the
      // renderer that uploads it share one three instance (mismatched instances
      // render the globe black — the prototype's hard-won lesson).
      const [{ default: GlobeGL }, THREE] = await Promise.all([import('globe.gl'), import('three')]);
      if (disposed || !containerRef.current) return;

      const container = containerRef.current;
      const world: GlobeInstance = new GlobeGL(container, { animateIn: false });
      world.showAtmosphere(SHOW_ATMOSPHERE);

      const renderer = world.renderer();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap for 4K screens
      const caps = renderer.capabilities;
      const maxAniso = caps.getMaxAnisotropy();
      // Only request the 8K day map if the GPU can actually sample it; else 4K.
      const dayUrl = caps.maxTextureSize >= 8192 ? DAY_TEXTURE_8K_URL : DAY_TEXTURE_4K_URL;

      // --- Textures (loaded manually so we control quality) ---
      const texLoader = new THREE.TextureLoader();
      const loadTexture = (url: string) =>
        new Promise<import('three').Texture>((resolve, reject) => texLoader.load(url, resolve, undefined, reject));
      const [dayMap, bumpMap, waterMap] = await Promise.all([
        loadTexture(dayUrl),
        loadTexture(BUMP_TEXTURE_URL),
        loadTexture(WATER_TEXTURE_URL),
      ]);
      if (disposed) {
        [dayMap, bumpMap, waterMap].forEach((t) => t.dispose());
        return;
      }
      dayMap.colorSpace = THREE.SRGBColorSpace;
      dayMap.anisotropy = maxAniso;
      bumpMap.anisotropy = maxAniso;
      waterMap.anisotropy = maxAniso;

      // Crisp-zoom floor keyed on the ACTUAL loaded day-map width (not just the GPU
      // gate): while DAY_TEXTURE_8K_URL still aliases the 4K file we keep the safer 4K
      // floor; once a real 8K asset is dropped in, this auto-switches to the 8K floor.
      const dayWidth = (dayMap.image as { width?: number }).width ?? 0;
      const is8k = dayWidth >= 8192;
      const minZoomAltitude = is8k ? MIN_ZOOM_ALTITUDE_8K : MIN_ZOOM_ALTITUDE_4K;

      // --- Material (built from OUR three so material + textures match) ---
      const globeMaterial = new THREE.MeshPhongMaterial({
        map: dayMap,
        bumpMap,
        bumpScale: BUMP_SCALE,
        specularMap: waterMap, // water mask → only oceans get a sheen
        specular: new THREE.Color(0x2d3b4f),
        shininess: SHININESS,
      });
      world.globeMaterial(globeMaterial); // setter pattern

      // --- Rotation + zoom limits ---
      const controls = world.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
      const R = world.getGlobeRadius();
      // Clamp the closest manual (pinch) zoom to the crisp floor → no pixel breaks.
      controls.minDistance = R * (1 + minZoomAltitude);
      controls.maxDistance = R * 6;

      // --- Size to the PARENT (component fills its container, not the window) ---
      const applySize = () => {
        world.width(container.clientWidth).height(container.clientHeight);
      };
      applySize();
      const resizeObserver = new ResizeObserver(applySize);
      resizeObserver.observe(container);

      /* ================= COUNTRY INTERACTION LAYER ================= */
      const isValidIso = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v !== '-99';
      // SELECTION identity: ISO_A2 is "-99" for ~8 features (France, Norway, Kosovo…),
      // so fall back to the always-unique ADM0_A3 to avoid collisions in glow tracking.
      const countryId = (feat: GeoFeature): string => {
        const iso = feat.properties[ISO_PROP];
        return isValidIso(iso) ? iso : String(feat.properties.ADM0_A3 ?? '');
      };
      // REPORTED iso: normalized to ISO alpha-2 so taps map back to country-state-city.
      // ISO_A2 → ISO_A2_EH (FR, NO, XK, AU…) → '' (genuinely non-ISO: Somaliland, N. Cyprus).
      const alpha2 = (feat: GeoFeature): string => {
        const iso = feat.properties[ISO_PROP];
        if (isValidIso(iso)) return iso;
        const eh = feat.properties[ISO_EH_PROP];
        return isValidIso(eh) ? eh : '';
      };
      let selectedId: string | null = null;
      // Layer mode: 'countries' shows admin-0 (rest fully transparent); 'provinces'
      // shows a KR/CN admin-1 set (rest a FAINT outline so subdivisions are visible).
      let mode: 'countries' | 'provinces' = 'countries';
      const provinceCache = new Map<string, GeoFeature[]>();

      const provinceId = (feat: GeoFeature): string => String(feat.properties[PROVINCE_ISO_PROP] ?? '');
      // Identity used for glow tracking + the cap/stroke/altitude accessors.
      const featureId = (feat: GeoFeature): string => (mode === 'provinces' ? provinceId(feat) : countryId(feat));
      const restStroke = () => (mode === 'provinces' ? PROVINCE_REST_STROKE_COLOR : REST_STROKE_COLOR);

      const capColorFn = (feat: object) => (featureId(feat as GeoFeature) === selectedId ? SELECTED_CAP_COLOR : REST_CAP_COLOR);
      const strokeColorFn = (feat: object) => (featureId(feat as GeoFeature) === selectedId ? SELECTED_STROKE_COLOR : restStroke());
      const sideColorFn = (feat: object) => (featureId(feat as GeoFeature) === selectedId ? SELECTED_CAP_COLOR : REST_CAP_COLOR);
      const altitudeFn = (feat: object) => (featureId(feat as GeoFeature) === selectedId ? GLOW_ALTITUDE : 0);
      const refreshPolygonStyles = () => {
        world
          .polygonCapColor(capColorFn)
          .polygonStrokeColor(strokeColorFn)
          .polygonSideColor(sideColorFn)
          .polygonAltitude(altitudeFn);
      };

      // --- Per-country fly-in framing (largest ring + antimeridian) ---
      const ringArea = (ring: number[][]) => {
        let s = 0;
        for (let i = 0, n = ring.length; i < n; i++) {
          const [x1, y1] = ring[i];
          const [x2, y2] = ring[(i + 1) % n];
          s += x1 * y2 - x2 * y1;
        }
        return Math.abs(s) / 2;
      };
      const largestRing = (feat: GeoFeature): number[][] => {
        const g = feat.geometry;
        const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][];
        let best: number[][] = [];
        let bestArea = -1;
        for (const poly of polys) {
          const ring = poly[0];
          const a = ringArea(ring);
          if (a > bestArea) {
            bestArea = a;
            best = ring;
          }
        }
        return best;
      };
      const altitudeForAngularDiameter = (angDeg: number) => {
        const camera = world.camera() as import('three').PerspectiveCamera;
        const fovV = (camera.fov * Math.PI) / 180;
        const alpha = ((angDeg * Math.PI) / 180) / 2;
        const beta = (FRAME_PADDING * fovV) / 2;
        const DoverR = Math.cos(alpha) + Math.sin(alpha) / Math.tan(beta);
        // Never frame a tiny country/province closer than the crisp floor: prefer a
        // slightly-less screen-fill over a pixelated fill.
        return clamp(DoverR - 1, Math.max(MIN_ALTITUDE, minZoomAltitude), MAX_ALTITUDE);
      };
      const computeFraming = (feat: GeoFeature) => {
        const ring = largestRing(feat);
        let lngs = ring.map((p) => p[0]);
        const lats = ring.map((p) => p[1]);
        let minLng = Math.min(...lngs);
        let maxLng = Math.max(...lngs);
        if (maxLng - minLng > 180) {
          lngs = lngs.map((l) => (l < 0 ? l + 360 : l));
          minLng = Math.min(...lngs);
          maxLng = Math.max(...lngs);
        }
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        let centerLng = (minLng + maxLng) / 2;
        if (centerLng > 180) centerLng -= 360;
        const centerLat = (minLat + maxLat) / 2;
        const latSpan = maxLat - minLat;
        const lngSpan = (maxLng - minLng) * Math.cos((centerLat * Math.PI) / 180);
        const angDeg = Math.max(latSpan, lngSpan);
        return { lat: centerLat, lng: centerLng, altitude: altitudeForAngularDiameter(angDeg) };
      };

      const selectCountry = (feat: GeoFeature) => {
        selectedId = countryId(feat);
        controls.autoRotate = false; // stop spin so the framing stays put
        refreshPolygonStyles();
        const { lat, lng, altitude } = computeFraming(feat);
        world.pointOfView({ lat, lng, altitude }, FLY_DURATION_MS);
        onSelectRef.current?.({
          name: String(feat.properties[NAME_PROP] ?? ''),
          iso: alpha2(feat),
          lat,
          lng,
        });
      };

      // Glow + frame a province polygon (same treatment as a country) and report it.
      const applyProvinceSelection = (feat: GeoFeature) => {
        selectedId = provinceId(feat);
        controls.autoRotate = false;
        refreshPolygonStyles();
        const { lat, lng, altitude } = computeFraming(feat);
        world.pointOfView({ lat, lng, altitude }, FLY_DURATION_MS);
        onProvinceSelectRef.current?.({
          name: String(feat.properties[PROVINCE_NAME_PROP] ?? feat.properties.name ?? ''),
          code: provinceId(feat),
          lat,
          lng,
        });
      };

      const normalizeName = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9가-힣]+/g, '')
          .replace(/(province|do|si|sar|autonomous|region|zhuang|huizu|hui|municipality)/g, '');

      // --- Tap vs drag guard (a rotate gesture must never select) ---
      let pointerStart: { x: number; y: number; t: number } | null = null;
      let wasDrag = false;
      const dom = renderer.domElement;
      const onPointerDown = (e: PointerEvent) => {
        pointerStart = { x: e.clientX, y: e.clientY, t: performance.now() };
        wasDrag = false;
      };
      const onPointerUp = (e: PointerEvent) => {
        if (!pointerStart) return;
        const dist = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
        const elapsed = performance.now() - pointerStart.t;
        wasDrag = dist > TAP_MOVE_THRESHOLD_PX || elapsed > TAP_TIME_THRESHOLD_MS;
        pointerStart = null;
      };
      dom.addEventListener('pointerdown', onPointerDown);
      dom.addEventListener('pointerup', onPointerUp);

      // --- Zoom helpers ---
      const zoomInToward = (coords: { lat: number; lng: number }) => {
        const pov = world.pointOfView();
        const altitude = clamp(pov.altitude / DOUBLE_TAP_ZOOM_FACTOR, minZoomAltitude, MAX_ZOOM_ALTITUDE);
        world.pointOfView({ lat: coords.lat, lng: coords.lng, altitude }, FLY_DURATION_MS / 2);
      };
      // Empty-space triple-tap: zoom OUT toward the tapped point (symmetric to zoomInToward).
      const zoomOutToward = (coords: { lat: number; lng: number }) => {
        const pov = world.pointOfView();
        const altitude = clamp(pov.altitude * TRIPLE_TAP_ZOOM_OUT_FACTOR, minZoomAltitude, MAX_ZOOM_ALTITUDE);
        world.pointOfView({ lat: coords.lat, lng: coords.lng, altitude }, FLY_DURATION_MS / 2);
      };
      const zoomOut = () => {
        const pov = world.pointOfView();
        const altitude = clamp(pov.altitude * DOUBLE_TAP_ZOOM_FACTOR, minZoomAltitude, MAX_ZOOM_ALTITUDE);
        world.pointOfView({ altitude }, FLY_DURATION_MS / 2);
      };

      // --- Click routing ---
      // A polygon (country/province) tap is ALWAYS instant: it selects immediately and
      // never waits on tap-count disambiguation. The single/double/triple logic below
      // is EMPTY-SPACE only, where a single tap does nothing — so waiting is free.
      let lastPolyTapTime = -1e9;
      const onPolyClick = (poly: object) => {
        if (wasDrag) return;
        lastPolyTapTime = performance.now();
        // In drill-in mode the polygons ARE provinces → select the province.
        if (mode === 'provinces') applyProvinceSelection(poly as GeoFeature);
        else selectCountry(poly as GeoFeature);
      };
      // Empty-space tap counting: taps that land near each other within DOUBLE_TAP_MS
      // accumulate; after a quiet window we decide — 2 = zoom in, 3+ = zoom out. The one
      // accepted cost: double-tap zoom-in now resolves ~DOUBLE_TAP_MS after the 2nd tap.
      let emptyTapCount = 0;
      let emptyTapPos = { x: 0, y: 0 };
      let emptyTapCoords = { lat: 0, lng: 0 };
      let emptyTapTimer: ReturnType<typeof setTimeout> | null = null;
      const onGlobeClick = (coords: { lat: number; lng: number }, ev: MouseEvent) => {
        if (wasDrag) return;
        const x = ev.clientX;
        const y = ev.clientY;
        const now = performance.now();
        setTimeout(() => {
          if (now - lastPolyTapTime < 80) return; // this tap hit a country → instant select already ran
          const near = emptyTapCount > 0 && Math.hypot(x - emptyTapPos.x, y - emptyTapPos.y) < DOUBLE_TAP_DIST_PX;
          emptyTapCount = near ? emptyTapCount + 1 : 1;
          emptyTapPos = { x, y };
          emptyTapCoords = coords;
          if (emptyTapTimer) clearTimeout(emptyTapTimer);
          emptyTapTimer = setTimeout(() => {
            if (emptyTapCount === 2) zoomInToward(emptyTapCoords);
            else if (emptyTapCount >= 3) zoomOutToward(emptyTapCoords);
            // emptyTapCount === 1 → a lone empty-space tap does nothing
            emptyTapCount = 0;
            emptyTapTimer = null;
          }, DOUBLE_TAP_MS);
        }, 0);
      };

      // --- Load borders + wire the polygon layer ---
      // Module-memoized parse; fresh top-level feature objects per mount (see
      // loadCountryFeatures) so globe.gl bookkeeping never collides across mounts.
      const features: GeoFeature[] = await loadCountryFeatures();
      if (disposed) {
        [dayMap, bumpMap, waterMap].forEach((t) => t.dispose());
        globeMaterial.dispose();
        resizeObserver.disconnect();
        return;
      }
      world
        .polygonsData(features)
        .polygonsTransitionDuration(POLYGON_TRANSITION_MS)
        .onPolygonClick(onPolyClick)
        .onGlobeClick(onGlobeClick);
      refreshPolygonStyles();

      // --- Imperative handle implementation ---
      apiRef.current = {
        flyTo: (pov, ms = FLY_DURATION_MS) => {
          controls.autoRotate = false;
          world.pointOfView(pov, ms);
        },
        selectCountryByIso: (iso) => {
          const target = String(iso).toUpperCase();
          // Match on normalized alpha-2 first (resolves FR/NO/XK via ISO_A2_EH),
          // then the raw ISO_A2, then the unique selection id (ADM0_A3 fallback).
          const feat =
            features.find((f) => alpha2(f).toUpperCase() === target) ??
            features.find((f) => String(f.properties[ISO_PROP] ?? '').toUpperCase() === target) ??
            features.find((f) => countryId(f).toUpperCase() === target);
          if (!feat) return false; // microstate / no polygon → caller flyTo's instead
          selectCountry(feat);
          return true;
        },
        showProvinces: async (countryIso) => {
          const iso = String(countryIso).toUpperCase();
          if (!PROVINCE_COUNTRIES.has(iso)) return false; // only KR/CN have province data
          let provs = provinceCache.get(iso);
          if (!provs) {
            try {
              const res = await fetch(provinceGeojsonUrl(iso));
              const json = await res.json();
              provs = json.features as GeoFeature[];
              provinceCache.set(iso, provs);
            } catch (err) {
              console.error('[Globe] showProvinces failed to load', iso, err);
              return false;
            }
          }
          if (disposed) return false;
          mode = 'provinces';
          selectedId = null; // clear the country glow; provinces start unselected
          world.polygonsData(provs).onPolygonClick(onPolyClick);
          refreshPolygonStyles();
          return true;
        },
        selectProvince: (code, name) => {
          if (mode !== 'provinces') return false;
          const provs = world.polygonsData() as GeoFeature[];
          const target = String(code).toUpperCase();
          const wantName = name ? normalizeName(name) : null;
          const feat =
            provs.find((f) => provinceId(f).toUpperCase() === target) ??
            (wantName
              ? provs.find((f) => {
                  const en = normalizeName(String(f.properties[PROVINCE_NAME_PROP] ?? ''));
                  const nm = normalizeName(String(f.properties.name ?? ''));
                  return en === wantName || nm === wantName || en.includes(wantName) || wantName.includes(en);
                })
              : undefined);
          if (!feat) return false;
          applyProvinceSelection(feat);
          return true;
        },
        showCountries: () => {
          mode = 'countries';
          selectedId = null;
          world.polygonsData(features).onPolygonClick(onPolyClick);
          refreshPolygonStyles();
        },
        zoomOut,
      };

      // --- DISPOSE ON UNMOUNT (mobile-memory discipline) ---
      cleanup = () => {
        resizeObserver.disconnect();
        dom.removeEventListener('pointerdown', onPointerDown);
        dom.removeEventListener('pointerup', onPointerUp);
        if (emptyTapTimer) clearTimeout(emptyTapTimer); // drop a pending tap-decision callback
        world.pauseAnimation(); // stop the internal rAF render loop
        // Free every geometry/material/texture in the scene.
        world.scene().traverse((obj) => {
          const mesh = obj as import('three').Mesh;
          mesh.geometry?.dispose?.();
          const mat = mesh.material;
          const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
          for (const m of mats) {
            const withMaps = m as unknown as Record<string, { dispose?: () => void } | undefined>;
            withMaps.map?.dispose?.();
            withMaps.bumpMap?.dispose?.();
            withMaps.specularMap?.dispose?.();
            m.dispose?.();
          }
        });
        dayMap.dispose();
        bumpMap.dispose();
        waterMap.dispose();
        globeMaterial.dispose();
        // Release the WebGL context, then drop globe.gl's internals + the canvas.
        renderer.dispose();
        renderer.forceContextLoss();
        (world as unknown as { _destructor?: () => void })._destructor?.();
        if (container.firstChild) container.replaceChildren();
        apiRef.current = null;
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div ref={containerRef} className={styles.viz} />
      <button
        type="button"
        className={styles.zoomOut}
        aria-label="Zoom out"
        onClick={() => apiRef.current?.zoomOut()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="8" y1="11" x2="14" y2="11" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
      </button>
    </div>
  );
});

export default Globe;
