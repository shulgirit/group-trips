/** fetch that gives up instead of hanging (a stuck Google call must not freeze a trip plan). */
export function timedFetch(input: string, init: RequestInit = {}, ms = 15_000): Promise<Response> {
  return fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(ms) });
}
