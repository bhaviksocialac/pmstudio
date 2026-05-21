/// <reference types="google.maps" />
// Loads the Google Maps JS API with the Places library (New).
// Uses the Lovable-managed browser key.

let loaderPromise: Promise<typeof google> | null = null;

declare global {
  interface Window {
    google?: typeof google;
    __lovableInitMap?: () => void;
  }
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loaderPromise) return loaderPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  if (!key) return Promise.reject(new Error("Google Maps key missing"));

  loaderPromise = new Promise((resolve, reject) => {
    window.__lovableInitMap = () => resolve(window.google!);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=places&callback=__lovableInitMap${channel ? `&channel=${channel}` : ""}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });

  return loaderPromise;
}

export type ParsedAddress = {
  street: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
};

type PlaceComponent = { types: string[]; long_name?: string; longText?: string; short_name?: string; shortText?: string };

function pick(comps: PlaceComponent[], type: string): string {
  const c = comps.find((x) => x.types?.includes(type));
  return (c?.long_name ?? c?.longText ?? "") as string;
}

export function parsePlace(place: {
  address_components?: PlaceComponent[];
  addressComponents?: PlaceComponent[];
  formatted_address?: string;
  formattedAddress?: string;
  geometry?: { location?: { lat: () => number; lng: () => number } };
  location?: { latitude?: number; lat?: number; longitude?: number; lng?: number };
}): ParsedAddress {
  const comps = (place.address_components ?? place.addressComponents ?? []) as PlaceComponent[];
  const route = pick(comps, "route");
  const streetNumber = pick(comps, "street_number");
  const sublocality = pick(comps, "sublocality") || pick(comps, "sublocality_level_1") || pick(comps, "neighborhood");
  const streetParts = [streetNumber, route, sublocality].filter(Boolean);
  const street = streetParts.join(", ") || place.formatted_address || place.formattedAddress || "";
  const city = pick(comps, "locality") || pick(comps, "administrative_area_level_2") || pick(comps, "postal_town");
  const state = pick(comps, "administrative_area_level_1");
  const country = pick(comps, "country");
  const pincode = pick(comps, "postal_code");

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (place.geometry?.location) {
    latitude = place.geometry.location.lat();
    longitude = place.geometry.location.lng();
  } else if (place.location) {
    latitude = (place.location.latitude ?? place.location.lat) as number ?? null;
    longitude = (place.location.longitude ?? place.location.lng) as number ?? null;
  }

  return { street, city, state, country, pincode, latitude, longitude };
}
