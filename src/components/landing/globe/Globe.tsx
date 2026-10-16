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
 */
export function Globe({
  scenes,
  layout,
  labels,
  className = "",
}: {
  scenes: GlobeScene[];
  layout: GlobeOptions["layout"];
  /** Destination names keyed by scene id (already translated) */
  labels: Record<string, string>;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GlobeHandle | null>(null);
  const layoutRef = useRef(layout);
  const [ready, setReady] = useState(false);
  const [labelId, setLabelId] = useState(scenes[0]?.id ?? "");

  layoutRef.current = layout;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !webglAvailable()) return;
    let destroyed = false;
    let observer: IntersectionObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const onLabel = (label: GlobeLabel) => {
      const node = labelRef.current;
      if (!node) return;
      node.style.transform = `translate3d(${label.x}px, ${label.y}px, 0)`;
      node.style.opacity = String(label.visible ? label.arrived : 0);
      if (node.dataset.id !== label.id) {
        node.dataset.id = label.id;
        setLabelId(label.id);
      }
    };

    const cancelIdle = whenIdle(async () => {
      const { createGlobe } = await import("./engine");
      if (destroyed) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const hiRes = window.innerWidth >= 1024 && (window.devicePixelRatio || 1) >= 1;
      try {
        const handle = await createGlobe({
          canvas,
          scenes,
          layout: layoutRef.current,
          reducedMotion,
          hiRes,
          onLabel,
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
    handleRef.current?.setLayout(layout);
  }, [layout]);

  return (
    <div ref={wrapRef} className={className} aria-hidden>
      {/* Poster: a lit limb of a planet, drawn in CSS — shown until WebGL is ready */}
      <div
        className={`globe-poster absolute inset-0 transition-opacity duration-1000 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
        data-layout={layout}
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full touch-pan-y transition-opacity duration-1000 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={labelRef}
        className="pointer-events-none absolute left-0 top-0 opacity-0 transition-opacity duration-500"
      >
        <span className="globe-label">{labels[labelId]}</span>
      </div>
    </div>
  );
}
