export function dbg(scope: string, ...args: any[]) {
  const env = (import.meta as any)?.env || {};
  const verbose = String(env.VITE_DEBUG_VERBOSE || '').toLowerCase() === 'true';
  if (!verbose) return;
  const rawScopes = env.VITE_DEBUG_SCOPES as string | undefined;
  const scopes = (rawScopes || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (scopes.length > 0 && !scopes.includes(scope)) return;
  // Prefix scope to make scanning easy
  console.log(`[${scope}]`, ...args);
}

