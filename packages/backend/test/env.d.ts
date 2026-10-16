// Vite's import.meta.glob (provided by vitest at runtime)
interface ImportMeta {
  glob(patterns: string | string[]): Record<string, () => Promise<unknown>>;
}
