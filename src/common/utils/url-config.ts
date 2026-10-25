export function parseUrlList(value?: string): string[] {
  if (!value?.trim()) return [];

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      let url: URL;
      try {
        url = new URL(entry);
      } catch {
        throw new Error(
          `Invalid URL in comma-separated list at position ${index + 1}`,
        );
      }

      if (
        !['http:', 'https:'].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        throw new Error(
          `Invalid URL in comma-separated list at position ${index + 1}`,
        );
      }

      const pathname = url.pathname.replace(/\/+$/, '');
      return `${url.origin}${pathname}`;
    });
}

export function parseCorsOrigins(
  corsOrigin: string | undefined,
  frontendUrls: Array<string | undefined>,
): string[] {
  const configuredOrigins = corsOrigin?.trim()
    ? corsOrigin
    : frontendUrls.filter(Boolean).join(',');

  return parseUrlList(configuredOrigins).map((url) => new URL(url).origin);
}
