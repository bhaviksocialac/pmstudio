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
  const city = pick(comps, "locality") || pick(comps, "administrative_area_level_3") || pick(comps, "administrative_area_level_2") || pick(comps, "postal_town");
  let state = pick(comps, "administrative_area_level_1");
  let country = pick(comps, "country");
  const pincode = pick(comps, "postal_code");

  // Fallback: infer state + country from known Indian cities when Google omits the components
  const inferred = inferIndianStateFromCity(city);
  if (!state && inferred.state) state = inferred.state;
  if (!country && (inferred.state || /\bIndia\b/i.test(place.formatted_address ?? place.formattedAddress ?? ""))) {
    country = "India";
  }

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

const INDIA_CITY_STATE: Record<string, string> = {
  mumbai: "Maharashtra", pune: "Maharashtra", nashik: "Maharashtra", nagpur: "Maharashtra", aurangabad: "Maharashtra", thane: "Maharashtra", "navi mumbai": "Maharashtra",
  delhi: "Delhi", "new delhi": "Delhi", noida: "Uttar Pradesh", gurgaon: "Haryana", gurugram: "Haryana", faridabad: "Haryana", ghaziabad: "Uttar Pradesh",
  bangalore: "Karnataka", bengaluru: "Karnataka", mysore: "Karnataka", mysuru: "Karnataka", hubli: "Karnataka", mangalore: "Karnataka",
  chennai: "Tamil Nadu", coimbatore: "Tamil Nadu", madurai: "Tamil Nadu", tiruchirappalli: "Tamil Nadu", salem: "Tamil Nadu",
  hyderabad: "Telangana", secunderabad: "Telangana", warangal: "Telangana",
  ahmedabad: "Gujarat", surat: "Gujarat", vadodara: "Gujarat", rajkot: "Gujarat", gandhinagar: "Gujarat",
  kolkata: "West Bengal", howrah: "West Bengal", siliguri: "West Bengal", durgapur: "West Bengal",
  jaipur: "Rajasthan", jodhpur: "Rajasthan", udaipur: "Rajasthan", kota: "Rajasthan", ajmer: "Rajasthan",
  lucknow: "Uttar Pradesh", kanpur: "Uttar Pradesh", agra: "Uttar Pradesh", varanasi: "Uttar Pradesh", allahabad: "Uttar Pradesh", prayagraj: "Uttar Pradesh",
  bhopal: "Madhya Pradesh", indore: "Madhya Pradesh", jabalpur: "Madhya Pradesh", gwalior: "Madhya Pradesh",
  chandigarh: "Chandigarh", panchkula: "Haryana", mohali: "Punjab", ludhiana: "Punjab", amritsar: "Punjab", jalandhar: "Punjab",
  kochi: "Kerala", cochin: "Kerala", thiruvananthapuram: "Kerala", trivandrum: "Kerala", kozhikode: "Kerala", calicut: "Kerala",
  patna: "Bihar", gaya: "Bihar",
  bhubaneswar: "Odisha", cuttack: "Odisha",
  guwahati: "Assam", shillong: "Meghalaya", dehradun: "Uttarakhand", shimla: "Himachal Pradesh", srinagar: "Jammu and Kashmir", jammu: "Jammu and Kashmir",
  ranchi: "Jharkhand", jamshedpur: "Jharkhand", raipur: "Chhattisgarh", panaji: "Goa", goa: "Goa",
  visakhapatnam: "Andhra Pradesh", vijayawada: "Andhra Pradesh", guntur: "Andhra Pradesh",
};

function inferIndianStateFromCity(city: string): { state: string } {
  const key = city.trim().toLowerCase();
  if (!key) return { state: "" };
  return { state: INDIA_CITY_STATE[key] ?? "" };
}
