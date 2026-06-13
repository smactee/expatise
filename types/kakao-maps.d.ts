// Minimal ambient types for the Kakao Maps JavaScript SDK (window.kakao).
// Covers only the surface KakaoMap.client.tsx uses — intentionally small, no `any`.
// Picked up globally via tsconfig include ("**/*.ts"); no import needed.

interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

interface KakaoMapInstance {
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
  relayout(): void;
}

interface KakaoMarkerInstance {
  setMap(map: KakaoMapInstance | null): void;
  getPosition(): KakaoLatLng;
}

interface KakaoInfoWindowInstance {
  open(map: KakaoMapInstance, marker: KakaoMarkerInstance): void;
  close(): void;
}

interface KakaoMapsNamespace {
  // With autoload=false the SDK is inert until load() runs its callback.
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance;
  Marker: new (options: { position: KakaoLatLng; title?: string; map?: KakaoMapInstance }) => KakaoMarkerInstance;
  InfoWindow: new (options: { content: string | HTMLElement; removable?: boolean }) => KakaoInfoWindowInstance;
  event: {
    addListener(
      target: KakaoMarkerInstance | KakaoMapInstance,
      type: string,
      handler: (event?: KakaoMapMouseEvent) => void,
    ): void;
  };
  // Loaded via `&libraries=services` — geocoding + keyword place search.
  services: KakaoServicesNamespace;
}

// Payload of a map 'click' event (used to let the user re-pin a location).
interface KakaoMapMouseEvent {
  latLng: KakaoLatLng;
}

// Kakao returns coordinates as strings (x = lng, y = lat).
interface KakaoAddressSearchResult {
  address_name: string;
  x: string;
  y: string;
}
interface KakaoKeywordSearchResult {
  id: string;
  place_name: string;
  address_name: string;
  x: string;
  y: string;
}
// coord2Address (reverse geocode) result. Korean addresses populate `address`;
// `road_address` is the newer road-name address and can be null.
interface KakaoCoord2AddressResult {
  address: { address_name: string } | null;
  road_address: { address_name: string } | null;
}
type KakaoServicesStatus = 'OK' | 'ZERO_RESULT' | 'ERROR';
interface KakaoGeocoder {
  addressSearch(
    query: string,
    callback: (result: KakaoAddressSearchResult[], status: KakaoServicesStatus) => void,
  ): void;
  // Note Kakao's argument order: longitude (x) first, then latitude (y).
  coord2Address(
    lng: number,
    lat: number,
    callback: (result: KakaoCoord2AddressResult[], status: KakaoServicesStatus) => void,
  ): void;
}
interface KakaoPlaces {
  keywordSearch(
    keyword: string,
    callback: (data: KakaoKeywordSearchResult[], status: KakaoServicesStatus, pagination: unknown) => void,
  ): void;
}
interface KakaoServicesNamespace {
  Geocoder: new () => KakaoGeocoder;
  Places: new (map?: KakaoMapInstance) => KakaoPlaces;
  Status: { OK: KakaoServicesStatus; ZERO_RESULT: KakaoServicesStatus; ERROR: KakaoServicesStatus };
}

interface KakaoStatic {
  maps: KakaoMapsNamespace;
}

interface Window {
  kakao?: KakaoStatic;
}
