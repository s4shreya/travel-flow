import { useEffect, useState } from "react";

import type { ComboboxOption } from "@/components/ui/Combobox";

let indianCities: Promise<ComboboxOption[]> | null = null;

// The dataset expanded every "ua" to "Urban Agglomeration" (e.g. "Kathua") and has one state typo
function cleanName(name: string): string {
  return name
    .replace(/Urban Agglomeration/g, "ua")
    .replace("Praddesh", "Pradesh")
    .trim();
}

/** Indian cities from `indian-cities-json` (largest first), loaded once in its own chunk. */
export function loadIndianCities(): Promise<ComboboxOption[]> {
  indianCities ??= import("indian-cities-json")
    .then(({ cities }) => {
      // drop duplicate rows, keep the dataset's population order
      const unique = new Map<string, ComboboxOption>();
      for (const city of cities) {
        const value = cleanName(city.name);
        const hint = cleanName(city.state);
        unique.set(`${value}|${hint}`, { value, hint });
      }
      return [...unique.values()];
    })
    .catch((error: unknown) => {
      // allow a retry on the next call
      indianCities = null;
      throw error;
    });
  return indianCities;
}

/** City options for a destination picker; empty until loaded (or when disabled). */
export function useIndianCities(enabled = true): ComboboxOption[] {
  const [cities, setCities] = useState<ComboboxOption[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadIndianCities()
      .then((list) => {
        if (!cancelled) setCities(list);
      })
      // typing a destination still works without suggestions
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return cities;
}
