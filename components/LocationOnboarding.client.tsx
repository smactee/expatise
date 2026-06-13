'use client';

// Location-selection cascade — the app's home flow. A full-screen <Globe> stays
// mounted behind a bottom-sheet stepper (the sheet never covers the globe, so
// fly-ins stay visible). Two steps: HOME (where you're from) and CURRENT (where
// you live now), each country → province → city. Globe ⇄ form stay in sync:
// picking/typing a country OR tapping the globe fills the active step's country;
// province/city picks fly the globe to their coords. For the CURRENT step in
// South Korea, the city dropdown is replaced by a geolocation → Kakao precise-pin
// flow (the only Kakao consumer), with graceful fallbacks.
//
// Consumes existing pieces (Globe, KakaoMap, lib/kakao/limitedCall). Persistence
// is intentionally deferred — onComplete just emits the typed result.

import { useEffect, useMemo, useRef, useState } from 'react';

import { City, Country, State, type ICity, type ICountry, type IState } from 'country-state-city';

import Globe, { type CountrySelection, type GlobeHandle, type ProvinceSelection } from '@/components/Globe.client';
import KakaoMap from '@/components/KakaoMap.client';
import { reverseGeocode, searchPlaces } from '@/lib/kakao/limitedCall';

import styles from './LocationOnboarding.module.css';

type Coords = { lat: number; lng: number };
type Level = { name: string; iso?: string; lat: number | null; lng: number | null };
type StepSel = { country: Level | null; province: Level | null; city: Level | null };
type StepKey = 'home' | 'current';

export type OnboardingLocation = {
  country: string;
  province: string | null;
  city: string | null;
  coords: Coords;
};
export type OnboardingResult = { home: OnboardingLocation; current: OnboardingLocation };
export type LocationOnboardingProps = {
  onComplete?: (result: OnboardingResult) => void;
  className?: string;
};

const PROVINCE_ALTITUDE = 0.35;
const CITY_ALTITUDE = 0.12;
const COUNTRY_FALLBACK_ALTITUDE = 0.9; // microstates with no polygon

const num = (v: string | number | null | undefined): number | null => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

// Only these countries have vendored admin-1 province polygons (province glow).
const isProvinceCountry = (iso?: string | null): boolean => iso === 'KR' || iso === 'CN';

export default function LocationOnboarding({ onComplete, className }: LocationOnboardingProps) {
  const globeRef = useRef<GlobeHandle>(null);

  const [step, setStep] = useState<StepKey>('home');
  const [home, setHome] = useState<StepSel>({ country: null, province: null, city: null });
  const [current, setCurrent] = useState<StepSel>({ country: null, province: null, city: null });

  const sel = step === 'home' ? home : current;
  const setSel = step === 'home' ? setHome : setCurrent;

  // Typeahead text for the active step's three fields (reset when the step flips).
  const [countryQ, setCountryQ] = useState('');
  const [provinceQ, setProvinceQ] = useState('');
  const [cityQ, setCityQ] = useState('');
  const [warn, setWarn] = useState(false);
  const [done, setDone] = useState(false);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const provinces = useMemo<IState[]>(
    () => (sel.country?.iso ? State.getStatesOfCountry(sel.country.iso) : []),
    [sel.country?.iso],
  );
  const cities = useMemo<ICity[]>(
    () => (sel.country?.iso && sel.province?.iso ? City.getCitiesOfState(sel.country.iso, sel.province.iso) : []),
    [sel.country?.iso, sel.province?.iso],
  );

  const stateLabel = sel.country?.iso === 'US' ? 'State' : 'Province';
  const isKoreaCurrent = step === 'current' && current.country?.iso === 'KR';

  // Keep the typeahead inputs in sync with whichever step is active.
  useEffect(() => {
    setCountryQ(sel.country?.name ?? '');
    setProvinceQ(sel.province?.name ?? '');
    setCityQ(sel.city?.name ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Re-sync the globe to the active step's country (+ province glow) on step switch.
  useEffect(() => {
    const c = sel.country;
    const globe = globeRef.current;
    if (!globe) return;
    globe.showCountries(); // leave any province drill-in from the other step
    if (!c?.iso) return;
    const matched = globe.selectCountryByIso(c.iso);
    if (!matched && c.lat != null && c.lng != null) {
      globe.flyTo({ lat: c.lat, lng: c.lng, altitude: COUNTRY_FALLBACK_ALTITUDE });
    }
    if (isProvinceCountry(c.iso)) {
      void globe.showProvinces(c.iso).then((ok) => {
        const p = sel.province;
        if (ok && p?.iso) globe.selectProvince(`${c.iso}-${p.iso}`, p.name); // restore province glow
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* ---------- level setters (drive the globe) ---------- */
  function chooseCountry(c: ICountry, { fly }: { fly: boolean }) {
    setSel({
      country: { name: c.name, iso: c.isoCode, lat: num(c.latitude), lng: num(c.longitude) },
      province: null,
      city: null,
    });
    setProvinceQ('');
    setCityQ('');
    const iso = c.isoCode;
    const globe = globeRef.current;
    if (fly) {
      globe?.showCountries(); // restore the country layer (leave any prior province drill-in)
      const matched = globe?.selectCountryByIso(iso);
      // selectCountryByIso glows + frames on a polygon match; microstates with no
      // polygon return false → fall back to a plain flyTo at the country's coords.
      if (!matched) {
        const lat = num(c.latitude);
        const lng = num(c.longitude);
        if (lat != null && lng != null) globe?.flyTo({ lat, lng, altitude: COUNTRY_FALLBACK_ALTITUDE });
      }
    }
    // KR/CN: drill into provinces after the country glow/fly-in. A non-fly tap is
    // already in country mode with the country glowing, so we only drill (no
    // showCountries, which would clear that glow). Other countries keep the plain
    // country layer — never province polygons.
    if (isProvinceCountry(iso)) void globe?.showProvinces(iso);
  }

  function chooseProvince(s: IState) {
    const lat = num(s.latitude) ?? sel.country?.lat ?? null;
    const lng = num(s.longitude) ?? sel.country?.lng ?? null;
    setSel((prev) => ({ ...prev, province: { name: s.name, iso: s.isoCode, lat, lng }, city: null }));
    setCityQ('');
    const iso = sel.country?.iso;
    if (isProvinceCountry(iso)) {
      // Glow + frame the province polygon. Falls back to a coordinate flyTo if the
      // ISO 3166-2 code + name don't match any vendored polygon.
      const matched = globeRef.current?.selectProvince(`${iso}-${s.isoCode}`, s.name);
      if (!matched && lat != null && lng != null) {
        globeRef.current?.flyTo({ lat, lng, altitude: PROVINCE_ALTITUDE });
      }
    } else if (lat != null && lng != null) {
      globeRef.current?.flyTo({ lat, lng, altitude: PROVINCE_ALTITUDE });
    }
  }

  function chooseCity(ci: ICity) {
    const lat = num(ci.latitude) ?? sel.province?.lat ?? sel.country?.lat ?? null;
    const lng = num(ci.longitude) ?? sel.province?.lng ?? sel.country?.lng ?? null;
    setSel((prev) => ({ ...prev, city: { name: ci.name, lat, lng } }));
    if (lat != null && lng != null) globeRef.current?.flyTo({ lat, lng, altitude: CITY_ALTITUDE });
  }

  // Korea precise pin → store as the "city" level with the detected address label.
  function setPreciseLocation(coords: Coords, label: string) {
    setCurrent((prev) => ({ ...prev, city: { name: label || 'Pinned location', lat: coords.lat, lng: coords.lng } }));
    globeRef.current?.flyTo({ lat: coords.lat, lng: coords.lng, altitude: CITY_ALTITUDE });
  }

  /* ---------- globe tap → fill the active step's country ---------- */
  function onGlobeTap(c: CountrySelection) {
    // c.iso is normalized to alpha-2 by Globe, so it maps back to country-state-city.
    const csc = c.iso ? Country.getCountryByCode(c.iso) : undefined;
    if (!csc) return; // polygon with no dataset match → leave the form alone
    // The tap already flew + glowed the country; fill without re-flying.
    chooseCountry(csc, { fly: false });
    setCountryQ(csc.name);
  }

  /* ---------- globe province tap (KR/CN drill-in) → fill active province ---------- */
  function onProvinceTap(p: ProvinceSelection) {
    const iso = sel.country?.iso;
    if (!isProvinceCountry(iso)) return;
    // 'KR-11' / 'CN-BJ' → CSC isoCode suffix ('11' / 'BJ').
    const suffix = p.code.includes('-') ? p.code.split('-')[1] : p.code;
    const st = provinces.find((x) => x.isoCode === suffix);
    if (!st) return; // e.g. the NE-only CN-X01~ feature with no CSC match
    // The tap already framed it; fill the field without re-framing.
    setSel((prev) => ({
      ...prev,
      province: { name: st.name, iso: st.isoCode, lat: num(st.latitude) ?? prev.country?.lat ?? null, lng: num(st.longitude) ?? prev.country?.lng ?? null },
      city: null,
    }));
    setProvinceQ(st.name);
    setCityQ('');
  }

  /* ---------- typeahead change handlers (commit on exact match) ---------- */
  function onCountryInput(v: string) {
    setCountryQ(v);
    const c = countries.find((x) => x.name === v.trim());
    if (c) chooseCountry(c, { fly: true });
  }
  function onProvinceInput(v: string) {
    setProvinceQ(v);
    const s = provinces.find((x) => x.name === v.trim());
    if (s) chooseProvince(s);
  }
  function onCityInput(v: string) {
    setCityQ(v);
    const ci = cities.find((x) => x.name === v.trim());
    if (ci) chooseCity(ci);
  }

  /* ---------- stepper ---------- */
  function pack(s: StepSel): OnboardingLocation | null {
    if (!s.country) return null;
    const cLat = s.country.lat;
    const cLng = s.country.lng;
    const pLat = s.province?.lat ?? cLat;
    const pLng = s.province?.lng ?? cLng;
    const ciLat = s.city?.lat ?? pLat;
    const ciLng = s.city?.lng ?? pLng;
    return {
      country: s.country.name,
      province: s.province?.name ?? null,
      city: s.city?.name ?? null,
      coords: { lat: ciLat ?? 0, lng: ciLng ?? 0 },
    };
  }

  function flashWarn() {
    setWarn(true);
    setTimeout(() => setWarn(false), 1200);
  }

  function onNext() {
    if (step === 'home') {
      if (!home.country) return flashWarn();
      setStep('current');
      return;
    }
    if (!current.country) return flashWarn();
    const packed = { home: pack(home), current: pack(current) };
    if (!packed.home || !packed.current) return flashWarn();
    const result: OnboardingResult = { home: packed.home, current: packed.current };
    // eslint-disable-next-line no-console
    console.log('[LocationOnboarding] onComplete', result);
    onComplete?.(result);
    setDone(true);
  }

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      {/* Globe stays mounted across the entire flow (disposes only on unmount). */}
      <div className={styles.globeLayer}>
        <Globe ref={globeRef} onCountrySelect={onGlobeTap} onProvinceSelect={onProvinceTap} />
      </div>

      <section className={styles.sheet} aria-label="Location selection">
        <div className={styles.grabber} />
        <header className={styles.header}>
          <h2 className={styles.title}>{step === 'home' ? 'Where are you from?' : 'Where do you live now?'}</h2>
          <div className={styles.dots}>
            <span className={[styles.dot, step === 'home' ? styles.dotActive : ''].join(' ')} />
            <span className={[styles.dot, step === 'current' ? styles.dotActive : ''].join(' ')} />
          </div>
        </header>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="lo-country">
            Country
          </label>
          <input
            id="lo-country"
            className={[styles.input, warn && !sel.country ? styles.warn : ''].join(' ')}
            list="lo-country-list"
            placeholder="Search country…"
            autoComplete="off"
            value={countryQ}
            onChange={(e) => onCountryInput(e.target.value)}
          />
          <datalist id="lo-country-list">
            {countries.map((c) => (
              <option key={c.isoCode} value={c.name} />
            ))}
          </datalist>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="lo-province">
            {stateLabel}
          </label>
          <input
            id="lo-province"
            className={styles.input}
            list="lo-province-list"
            placeholder={
              !sel.country ? 'Choose a country first' : provinces.length ? `Search ${stateLabel.toLowerCase()}…` : 'No subdivisions in dataset'
            }
            autoComplete="off"
            disabled={!sel.country || provinces.length === 0}
            value={provinceQ}
            onChange={(e) => onProvinceInput(e.target.value)}
          />
          <datalist id="lo-province-list">
            {provinces.map((s) => (
              <option key={s.isoCode} value={s.name} />
            ))}
          </datalist>
        </div>

        {/* City: dropdown for every case EXCEPT current-residence South Korea,
            which uses the geolocation → Kakao precise-pin flow. */}
        {isKoreaCurrent ? (
          <KoreaPinStep onConfirm={setPreciseLocation} confirmedLabel={current.city?.name ?? null} />
        ) : (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="lo-city">
              City
            </label>
            <input
              id="lo-city"
              className={styles.input}
              list="lo-city-list"
              placeholder={
                !sel.province ? 'Choose a province first' : cities.length ? 'Search city…' : 'No cities in dataset'
              }
              autoComplete="off"
              disabled={!sel.province || cities.length === 0}
              value={cityQ}
              onChange={(e) => onCityInput(e.target.value)}
            />
            <datalist id="lo-city-list">
              {cities.map((ci, i) => (
                <option key={`${ci.name}-${i}`} value={ci.name} />
              ))}
            </datalist>
          </div>
        )}

        <footer className={styles.footer}>
          {step === 'current' && (
            <button type="button" className={styles.ghost} onClick={() => setStep('home')}>
              Back
            </button>
          )}
          <button type="button" className={styles.primary} onClick={onNext} disabled={done}>
            {done ? 'Saved ✓' : step === 'current' ? 'Done' : 'Next'}
          </button>
        </footer>
      </section>
    </div>
  );
}

/* ====================================================================== *
 *  Korea precise-pin step (the only Kakao consumer)
 *  geolocation → reverse-geocode → adjustable KakaoMap pin → confirm.
 *  Never dead-ends: permission denied or {limited:true} → address search,
 *  and the parent's province/city dropdowns remain a manual fallback.
 * ====================================================================== */
type PinPhase = 'intro' | 'locating' | 'map' | 'denied';

function KoreaPinStep({
  onConfirm,
  confirmedLabel,
}: {
  onConfirm: (coords: Coords, label: string) => void;
  confirmedLabel: string | null;
}) {
  const [phase, setPhase] = useState<PinPhase>('intro');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [label, setLabel] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [limitedNotice, setLimitedNotice] = useState(false);

  async function getDeviceCoords(): Promise<Coords | null> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const perm = await Geolocation.requestPermissions();
        if (perm.location === 'denied') return null;
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
        return { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch (err) {
      console.warn('[KoreaPinStep] native geolocation failed', err);
    }
    // Web fallback: browser Geolocation API.
    return new Promise<Coords | null>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    });
  }

  async function useMyLocation() {
    setPhase('locating');
    const c = await getDeviceCoords();
    if (!c) {
      setPhase('denied'); // permission denied → manual fallback below
      return;
    }
    setCoords(c);
    setPhase('map');
    void refreshLabel(c);
  }

  async function refreshLabel(c: Coords) {
    const res = await reverseGeocode(c.lat, c.lng);
    if (res.limited) {
      setLimitedNotice(true); // address lookup capped → keep the map, allow search
      setLabel('');
    } else {
      setLimitedNotice(false);
      setLabel(res.data.label);
    }
  }

  function onMapPick(c: Coords) {
    setCoords(c);
    void refreshLabel(c);
  }

  async function runSearch() {
    const q = searchQ.trim();
    if (!q) return;
    const res = await searchPlaces(q);
    if (res.limited) {
      setLimitedNotice(true);
      return;
    }
    const top = res.data[0];
    if (top) {
      const c = { lat: top.lat, lng: top.lng };
      setCoords(c);
      setLabel(top.label);
      setLimitedNotice(false);
      if (phase !== 'map') setPhase('map');
    }
  }

  return (
    <div className={styles.field}>
      <label className={styles.label}>Precise location (South Korea)</label>

      {phase === 'intro' && (
        <button type="button" className={styles.secondary} onClick={useMyLocation}>
          📍 Use my current location
        </button>
      )}
      {phase === 'locating' && <p className={styles.hint}>Locating you…</p>}

      {phase === 'denied' && (
        <p className={styles.hint}>Location permission is off — search your address instead.</p>
      )}

      {(phase === 'map' || phase === 'denied') && (
        <>
          <div className={styles.searchRow}>
            <input
              className={styles.input}
              placeholder="Search address or place…"
              value={searchQ}
              autoComplete="off"
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void runSearch();
                }
              }}
            />
            <button type="button" className={styles.secondary} onClick={() => void runSearch()}>
              Search
            </button>
          </div>

          {coords && (
            <>
              <KakaoMap
                className={styles.kakaoMap}
                center={coords}
                level={3}
                markers={[{ lat: coords.lat, lng: coords.lng, title: label || 'Your location' }]}
                ariaLabel="Precise location map"
                onPick={onMapPick}
              />
              <p className={styles.hint}>
                {limitedNotice
                  ? 'Address lookup unavailable right now — tap the map to set your spot.'
                  : label || 'Tap the map to adjust your exact spot.'}
              </p>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => coords && onConfirm(coords, label)}
              >
                {confirmedLabel ? `Confirmed: ${confirmedLabel}` : 'Confirm this location'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
