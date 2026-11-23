/**
 * Public base URL used to build absolute canonical / Open Graph URLs.
 * Build-time only; this is not a secret and is never fetched from the browser.
 */
export function getSiteUrl(): string {
  const astroEnv = import.meta.env as Record<string, string | undefined> | undefined;
  const url = astroEnv?.SITE_URL || process.env.SITE_URL || 'http://localhost:4321';
  return url.replace(/\/+$/, '');
}
