"use client";

import { useEffect, useRef, useState } from "react";
import type { GlobeHandle, GlobeLabel, GlobeOptions, GlobeScene } from "./engine";

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function whenIdle(callback: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback, { timeout: 1200 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(callback, 300);
  return () => clearTimeout(id);
}

/**
 * The landing globe. three.js is fetched only after first paint, so the
 * headline and the sign-in button never wait for WebGL. Without WebGL the
 * static poster stays — the hero is complete either way.
 *
 * Labels are DOM (crisp text, real fonts, RTL-safe); their positions are
 * written imperatively each frame, so React never re-renders per frame.
 */
export function Globe({
  scenes,
  layout,
  labels,
  dragHint,
  className = "",
}: {
  scenes: GlobeScene[];
  layout: GlobeOptions["layout"];
  /** Translated names keyed by scene id (destinations) and city id (origins) */
  labels: Record<string, string>;
  dragHint: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GlobeHandle | null>(null);
  const layoutRef = useRef(layout);
  const [ready, setReady] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [labelIds, setLabelIds] = useState<string[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !webglAvailable()) return;
    let destroyed = false;
    let observer: IntersectionObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let currentKey = "";
    const sizes = new Map<string, { w: number; h: number }>();

    const onLabels = (items: GlobeLabel[]) => {
      const key = items.map((item) => item.id).join("|");
      if (key !== currentKey) {
        currentKey = key;
        setLabelIds(items.map((item) => item.id));
      }
      const layer = labelLayerRef.current;
      if (!layer) return;
      // Destination first, then origins in route order; a label that would
      // overlap one already placed steps aside (sizes cached — no layout per frame)
      const placed: { left: number; right: number; top: number; bottom: number }[] = [];
      const ordered = [items[items.length - 1], ...items.slice(0, -1)];
      for (const item of ordered) {
        if (!item) continue;
        const node = layer.querySelector<HTMLElement>(`[data-label="${item.id}"]`);
        if (!node) continue;
        let size = sizes.get(item.id);
        if (!size) {
          const inner = node.firstElementChild as HTMLElement | null;
          if (inner && inner.offsetWidth > 0) {
            size = { w: inner.offsetWidth, h: inner.offsetHeight };
            sizes.set(item.id, size);
          }
        }
        let opacity = item.opacity;
        if (size && opacity > 0.05) {
          const gap = item.kind === "destination" ? 14 : 8;
          const box = {
            left: item.x - size.w / 2 - 4,
            right: item.x + size.w / 2 + 4,
            top: item.y - size.h - gap - 2,
            bottom: item.y - gap + 2,
          };
          const hit = placed.some(
            (other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top
          );
          if (hit) opacity = 0;
          else placed.push(box);
        }
        node.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
        node.style.opacity = opacity.toFixed(3);
      }
    };

    const cancelIdle = whenIdle(async () => {
      const { createGlobe } = await import("./engine");
      if (destroyed) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const hiRes = window.innerWidth >= 1024;
      try {
        const handle = await createGlobe({
          canvas,
          scenes,
          layout: layoutRef.current,
          reducedMotion,
          hiRes,
          onLabels,
          onInteract: () => !destroyed && setInteracted(true),
          onReady: () => !destroyed && setReady(true),
        });
        if (destroyed) {
          handle.destroy();
          return;
        }
        handleRef.current = handle;
        observer = new IntersectionObserver(
          ([entry]) => handle.setActive(entry.isIntersecting && !document.hidden),
          { threshold: 0.02 }
        );
        observer.observe(wrap);
        resizeObserver = new ResizeObserver(() => handle.resize());
        resizeObserver.observe(wrap);
      } catch (error) {
        // Textures or context failed — the poster stays, nothing breaks
        if (process.env.NODE_ENV !== "production") console.error("[globe]", error);
      }
    });

    const onVisibility = () => handleRef.current?.setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      destroyed = true;
      cancelIdle();
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
      resizeObserver?.disconnect();
      handleRef.current?.destroy();
      handleRef.current = null;
    };
    // scenes are static config; layout changes go through setLayout below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    layoutRef.current = layout;
    handleRef.current?.setLayout(layout);
  }, [layout]);

  return (
    <div ref={wrapRef} className={className}>
      {/* Poster: a lit planet drawn in CSS — shown until WebGL is ready */}
      <div
        aria-hidden
        className={`globe-poster absolute inset-0 transition-opacity duration-1000 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
        data-layout={layout}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className={`absolute inset-0 h-full w-full cursor-grab touch-pan-y transition-opacity duration-1000 active:cursor-grabbing ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />
      <div ref={labelLayerRef} aria-hidden className="pointer-events-none absolute inset-0">
        {labelIds.map((id, index) => (
          <span
            key={id}
            data-label={id}
            className="absolute left-0 top-0 opacity-0"
            style={{ willChange: "transform, opacity" }}
          >
            <span className={index === labelIds.length - 1 ? "globe-label" : "globe-label-origin"}>
              {labels[id]}
            </span>
          </span>
        ))}
      </div>
      {ready && (
        <p
          className={`pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-cream-50/55 transition-opacity duration-700 ${
            interacted ? "opacity-0" : "opacity-100"
          }`}
        >
          {dragHint}
        </p>
      )}
    </div>
  );
}
