import type { StrapiCollectionResponse, StrapiResult, StrapiError } from './types';

/**
 * Returns the configured Strapi CMS base URL.
 *
 * `import.meta.env` is provided by Astro/Vite at build time; `process.env` is
 * the fallback for plain Node contexts (for example, the test runner).
 * Optional chaining is required so this module can be imported outside Astro,
 * where `import.meta.env` is undefined.
 *
 * Defaults to http://localhost:1337 if STRAPI_URL is unset.
 */
export function getStrapiUrl(): string {
  const astroEnv = import.meta.env as Record<string, string | undefined> | undefined;
  const url = astroEnv?.STRAPI_URL || process.env.STRAPI_URL || 'http://localhost:1337';
  return url.replace(/\/+$/, '');
}

/**
 * Server-side Strapi fetch client.
 * Strictly used during Astro build / static site generation.
 */
export async function fetchStrapiCollection<T>(
  endpoint: string,
  queryString: string = ''
): Promise<StrapiResult<T[]>> {
  const baseUrl = getStrapiUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Fallback to HTTP status text
      }

      return {
        success: false,
        error: {
          kind: 'http_error',
          status: response.status,
          message: `Strapi API error at ${endpoint}: ${errorMessage}`,
          endpoint,
        },
      };
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (parseError) {
      return {
        success: false,
        error: {
          kind: 'malformed_response',
          status: response.status,
          message: `Malformed JSON received from Strapi at ${endpoint}.`,
          endpoint,
        },
      };
    }

    const payload = json as StrapiCollectionResponse<T>;
    if (!payload || !Array.isArray(payload.data)) {
      return {
        success: false,
        error: {
          kind: 'malformed_response',
          status: response.status,
          message: `Unexpected payload envelope from Strapi at ${endpoint}: expected data array.`,
          endpoint,
        },
      };
    }

    return {
      success: true,
      data: payload.data,
      meta: payload.meta,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: {
        kind: 'connection_failed',
        message: `Unable to connect to Strapi at ${baseUrl}. Ensure the Charizard backend is running. (${message})`,
        endpoint,
      },
    };
  }
}
