"use client";

/**
 * Thin bridge to Capacitor native plugins. The store apps load this same
 * web app in a native shell; plugins are reached through the injected
 * window.Capacitor global, so the web bundle never imports native code.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
function capacitor(): any | null {
  if (typeof window === "undefined") return null;
  const cap = (window as any).Capacitor;
  return cap?.isNativePlatform?.() ? cap : null;
}

export function isNative(): boolean {
  return capacitor() !== null;
}

export function nativePlatform(): "ios" | "android" | "web" {
  return (capacitor()?.getPlatform?.() as "ios" | "android") ?? "web";
}

export function nativePlugin<T = any>(name: string): T | null {
  const cap = capacitor();
  if (!cap) return null;
  return (
    cap.Plugins?.[name] ??
    (typeof cap.registerPlugin === "function" ? cap.registerPlugin(name) : null)
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
