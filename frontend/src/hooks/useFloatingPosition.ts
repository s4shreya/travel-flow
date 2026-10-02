import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from "react";

export interface FloatingPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
}

// Space between the trigger and the popup, and from the viewport edge
const GAP = 6;
const EDGE = 8;
const MIN_HEIGHT = 120;

interface FloatingOptions {
  preferredHeight: number;
  width?: number;
}

/**
 * Fixed-position coordinates for a popup rendered in a portal, so it is never
 * clipped by a scrolling parent (modals, tables). Follows the trigger on scroll / resize.
 */
export function useFloatingPosition(
  triggerRef: RefObject<HTMLElement | null>,
  open: boolean,
  { preferredHeight, width }: FloatingOptions,
): FloatingPosition | null {
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  const update = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const openUp = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
    const popupWidth = width ?? rect.width;
    setPosition({
      top: openUp ? rect.top - GAP : rect.bottom + GAP,
      // keep a fixed-width popup inside the viewport
      left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - popupWidth - EDGE)),
      width: popupWidth,
      maxHeight: Math.max(Math.min(preferredHeight, openUp ? spaceAbove : spaceBelow), MIN_HEIGHT),
      openUp,
    });
  }, [triggerRef, preferredHeight, width]);

  // Measure before paint so the popup opens in place
  useLayoutEffect(() => {
    if (open) update();
  }, [open, update]);

  // Follow the trigger while open (capture scroll from nested overflow containers)
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return open ? position : null;
}

/** Inline style that places the popup above or below its trigger. */
export function floatingStyle(position: FloatingPosition) {
  return {
    left: position.left,
    width: position.width,
    maxHeight: position.maxHeight,
    ...(position.openUp
      ? { bottom: window.innerHeight - position.top }
      : { top: position.top }),
  };
}
