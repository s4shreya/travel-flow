import { Globe2, Plane, type LucideIcon } from "lucide-react";

import type { TripKind } from "@/features/travel-requests/formModel";
import { paths } from "@/lib/routes";

export interface ClaimType {
  kind: TripKind;
  /** URL segment, e.g. "/claims/domestic-travel". */
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

/** Single source of truth for the claim categories under "New request". */
export const CLAIM_TYPES: ClaimType[] = [
  {
    kind: "domestic",
    slug: "domestic-travel",
    title: "Domestic travel",
    description:
      "Trip within India with an advance if you need one, and settlement against your bills.",
    icon: Plane,
  },
  {
    kind: "international",
    slug: "international-travel",
    title: "International travel",
    description:
      "Trip outside India with an advance if you need one, and settlement against your bills.",
    icon: Globe2,
  },
];

export function claimTypeBySlug(slug: string | undefined): ClaimType | undefined {
  return CLAIM_TYPES.find((type) => type.slug === slug);
}

/** "Domestic travel" / "International travel" for a trip kind. */
export function claimTitle(kind: TripKind): string {
  return CLAIM_TYPES.find((type) => type.kind === kind)?.title ?? "Travel";
}

export function claimPath(type: ClaimType): string {
  return paths.newClaim(type.slug);
}
