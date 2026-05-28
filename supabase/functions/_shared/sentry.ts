/**
 * SDK-free Sentry integration for Edge Functions.
 * Single fetch to Sentry store API — no Deno SDK dependency.
 * Fire-and-forget: failures never block user-facing responses.
 *
 * Requires SENTRY_DSN env var (set via supabase secrets).
 */

interface SentryEventParams {
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'info';
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/**
 * Send an event to Sentry via HTTP store API.
 * DSN format: https://{publicKey}@{host}/{projectId}
 * Always wrapped in try/catch — never throws to caller.
 */
export async function sentryCapture(params: SentryEventParams): Promise<void> {
  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) return; // No DSN → silently skip

  try {
    const match = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
    if (!match) {
      console.error('[sentry] Invalid DSN format');
      return;
    }

    const [, publicKey, host, projectId] = match;
    const endpoint = `https://${host}/api/${projectId}/store/`;

    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      platform: 'other',
      level: params.level || 'error',
      logger: 'edge-function',
      message: { formatted: params.message },
      tags: {
        environment: Deno.env.get('SUPABASE_ENV') || 'production',
        ...params.tags,
      },
      extra: params.extra || {},
    };

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': [
          'Sentry sentry_version=7',
          `sentry_key=${publicKey}`,
          'sentry_client=chosy-edge/1.0',
        ].join(', '),
      },
      body: JSON.stringify(event),
    });
  } catch (e) {
    console.error('[sentry] capture failed:', e);
  }
}
