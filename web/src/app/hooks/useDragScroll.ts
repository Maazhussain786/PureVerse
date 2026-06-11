"use client";

import { useEffect, type RefObject } from "react";

/**
 * Adds mouse drag-to-scroll (swipe) behavior to any horizontally scrollable
 * element. Touch devices already swipe natively, so only mouse pointers are
 * handled here. A click that immediately follows a real drag is swallowed so
 * cards don't navigate when the user was just swiping.
 *
 * Usage: pass the same ref you attach to the scroll container, and add the
 * `drag-scroll` class (cursor + image-drag/select guards live in globals.css).
 */
export default function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let moved = false;
    let startX = 0;
    let startScroll = 0;

    // Block native image/link ghost-drag so the swipe never gets hijacked.
    const onDragStart = (e: Event) => e.preventDefault();

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      isDown = true;
      moved = false;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.style.scrollBehavior = "auto"; // no smooth-easing while hand-dragging
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) {
        moved = true;
        el.classList.add("dragging");
      }
      if (moved) el.scrollLeft = startScroll - dx;
    };

    const onPointerUp = () => {
      if (!isDown) return;
      isDown = false;
      el.style.scrollBehavior = "";
      el.classList.remove("dragging");
      if (moved) {
        // Swallow the click generated at drag-release so the card under the
        // cursor doesn't navigate. Self-removes after one tick if no click fires.
        const swallowClick = (ev: MouseEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        el.addEventListener("click", swallowClick, { capture: true, once: true });
        setTimeout(
          () => el.removeEventListener("click", swallowClick, { capture: true }),
          50
        );
      }
    };

    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      el.removeEventListener("dragstart", onDragStart);
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [ref]);
}
