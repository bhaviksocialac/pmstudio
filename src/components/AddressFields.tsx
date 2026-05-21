/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { loadGoogleMaps, parsePlace } from "@/lib/google-maps";

export type AddressValue = {
  flat_number: string;
  street: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
};

export const emptyAddress: AddressValue = {
  flat_number: "",
  street: "",
  city: "",
  state: "",
  country: "",
  pincode: "",
  latitude: null,
  longitude: null,
};

const inputCls =
  "w-full h-10 px-3 rounded-[10px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30";

interface Suggestion {
  placeId: string;
  text: string;
}

export function AddressFields({
  value,
  onChange,
  compact,
}: {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  compact?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    loadGoogleMaps().catch(() => {/* silent */});
  }, []);

  const fetchSuggestions = async (input: string) => {
    if (!input || input.length < 3) { setSuggestions([]); return; }
    try {
      setLoading(true);
      const g = await loadGoogleMaps();
      const placesLib = await g.maps.importLibrary("places") as google.maps.PlacesLibrary;
      const { AutocompleteSuggestion, AutocompleteSessionToken } = placesLib;
      if (!sessionRef.current) sessionRef.current = new AutocompleteSessionToken();
      const { suggestions: sugg } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionRef.current,
      });
      const mapped: Suggestion[] = sugg
        .map((s) => {
          const p = s.placePrediction;
          if (!p) return null;
          return { placeId: p.placeId, text: p.text?.toString() ?? "" };
        })
        .filter((x): x is Suggestion => !!x);
      setSuggestions(mapped);
      setOpen(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStreetChange = (street: string) => {
    onChange({ ...value, street });
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchSuggestions(street), 280);
  };

  const selectSuggestion = async (s: Suggestion) => {
    setOpen(false);
    setSuggestions([]);
    try {
      const g = await loadGoogleMaps();
      const placesLib = await g.maps.importLibrary("places") as google.maps.PlacesLibrary;
      const place = new placesLib.Place({ id: s.placeId });
      await place.fetchFields({
        fields: ["addressComponents", "formattedAddress", "location"],
      });
      const parsed = parsePlace({
        addressComponents: place.addressComponents as unknown as { types: string[]; longText?: string }[],
        formattedAddress: place.formattedAddress ?? undefined,
        location: place.location ? { lat: place.location.lat(), lng: place.location.lng() } : undefined,
      });
      onChange({
        ...value,
        street: parsed.street || s.text,
        city: parsed.city || value.city,
        state: parsed.state || value.state,
        country: parsed.country || value.country,
        pincode: parsed.pincode || value.pincode,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      });
      sessionRef.current = null; // end session after selection
    } catch {
      onChange({ ...value, street: s.text });
    }
  };

  const gridCls = compact ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-3";

  return (
    <div className="space-y-3">
      <div className={gridCls}>
        <FieldLabel label="Flat / Unit no.">
          <input
            className={inputCls}
            value={value.flat_number}
            onChange={(e) => onChange({ ...value, flat_number: e.target.value })}
            placeholder="A-302"
          />
        </FieldLabel>
        <FieldLabel label="Pincode">
          <input
            className={inputCls}
            value={value.pincode}
            onChange={(e) => onChange({ ...value, pincode: e.target.value })}
            placeholder="400050"
          />
        </FieldLabel>
      </div>

      <FieldLabel label="Street address">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className={`${inputCls} pl-9`}
            value={value.street}
            onChange={(e) => handleStreetChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="Start typing your address…"
            autoComplete="off"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
          {open && suggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 rounded-[10px] bg-card border border-border shadow-lg max-h-64 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.placeId}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b border-border last:border-0"
                >
                  {s.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </FieldLabel>

      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="City">
          <input className={inputCls} value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })} placeholder="Mumbai" />
        </FieldLabel>
        <FieldLabel label="State">
          <input className={inputCls} value={value.state} onChange={(e) => onChange({ ...value, state: e.target.value })} placeholder="Maharashtra" />
        </FieldLabel>
      </div>
      <FieldLabel label="Country">
        <input className={inputCls} value={value.country} onChange={(e) => onChange({ ...value, country: e.target.value })} placeholder="India" />
      </FieldLabel>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function addressToString(a: AddressValue): string {
  return [a.flat_number, a.street, a.city, a.state, a.pincode, a.country].filter(Boolean).join(", ");
}
