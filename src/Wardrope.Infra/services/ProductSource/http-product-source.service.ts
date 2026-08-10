import { lookup } from 'node:dns/promises';
import type { IncomingMessage } from 'node:http';
import { isIP } from 'node:net';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import {
  ProductSourceError,
  type DownloadedProductImage,
  type IProductSourceService,
  type ProductSourceSnapshot,
} from '../../../Wardrope.Core/services/ServicesInterface/ProductSource/product-source.service.interface';

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_ADDRESS_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 8_000;
const READER_FALLBACK_TIMEOUT_MS = 20_000;
const READER_FALLBACK_ORIGIN = 'https://r.jina.ai/';
const USER_AGENT = 'WardropeProductImporter/1.1';
const FALLBACK_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface BoundedResponse {
  finalUrl: URL;
  contentType: string;
  body: Buffer;
}

interface ProductMetadata {
  name: string | null;
  brand: string | null;
  colors: string[];
  materials: string[];
  categoryHint: string | null;
  imageUrls: string[];
  fragranceDetails?: ProductSourceSnapshot['fragranceDetails'];
}

interface PublicAddress {
  address: string;
  family: 4 | 6;
}

type TransportFailureKind = 'TIMEOUT' | 'TLS' | 'NETWORK';

function normalizedHostname(url: URL): string {
  return url.hostname
    .toLocaleLowerCase('en')
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b, c] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLocaleLowerCase('en');
  if (normalized === '::' || normalized === '::1') return false;

  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isPublicIpv4(mappedIpv4);

  if (/^(fc|fd)/.test(normalized)) return false;
  if (/^fe[89ab]/.test(normalized)) return false;
  if (/^fe[cdef]/.test(normalized)) return false;
  if (/^ff/.test(normalized)) return false;
  if (normalized.startsWith('2001:db8:')) return false;
  if (normalized.startsWith('2001:0000:') || normalized.startsWith('2001:0:'))
    return false;
  if (normalized.startsWith('2002:')) return false;
  if (normalized.startsWith('64:ff9b:')) return false;
  return true;
}

function isPublicIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

function normalizeAndValidateUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ProductSourceError(
      'URL_NOT_ALLOWED',
      'Product source URL is invalid.',
    );
  }

  if (url.protocol !== 'https:') {
    throw new ProductSourceError(
      'URL_NOT_ALLOWED',
      'Product source URL must use HTTPS.',
    );
  }
  if (url.username || url.password) {
    throw new ProductSourceError(
      'URL_NOT_ALLOWED',
      'Product source URL must not contain credentials.',
    );
  }
  if (url.port && url.port !== '443') {
    throw new ProductSourceError(
      'URL_NOT_ALLOWED',
      'Product source URL must use the standard HTTPS port.',
    );
  }

  const hostname = normalizedHostname(url);
  if (isIP(hostname)) {
    throw new ProductSourceError(
      'URL_NOT_ALLOWED',
      'Literal IP product source URLs are not allowed.',
    );
  }
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.amazonaws.com' ||
    hostname === 'metadata.google.internal'
  ) {
    throw new ProductSourceError(
      'URL_NOT_ALLOWED',
      'Product source host is not allowed.',
    );
  }

  url.hash = '';
  return url;
}

function safeErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? code : null;
}

function classifyTransportFailure(error: unknown): {
  kind: TransportFailureKind;
  code: string | null;
} {
  const code = safeErrorCode(error);
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT')
    return { kind: 'TIMEOUT', code };
  if (
    code &&
    (code.startsWith('ERR_TLS_') ||
      code.startsWith('CERT_') ||
      code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
      code === 'DEPTH_ZERO_SELF_SIGNED_CERT')
  ) {
    return { kind: 'TLS', code };
  }
  return { kind: 'NETWORK', code };
}

function logSourceFailure(
  kind:
    | 'DNS'
    | 'TIMEOUT'
    | 'TLS'
    | 'NETWORK'
    | 'REMOTE_BLOCKED'
    | 'REMOTE_HTTP_ERROR'
    | 'REDIRECT_LIMIT',
  url: URL,
  details: {
    statusCode?: number;
    family?: 4 | 6;
    attempt?: number;
    code?: string | null;
  } = {},
): void {
  const diagnostic = {
    event: 'product_source_request_failed',
    kind,
    hostname: normalizedHostname(url),
    ...(details.statusCode !== undefined
      ? { statusCode: details.statusCode }
      : {}),
    ...(details.family !== undefined ? { addressFamily: details.family } : {}),
    ...(details.attempt !== undefined ? { attempt: details.attempt } : {}),
    ...(details.code ? { code: details.code } : {}),
  };
  console.warn(JSON.stringify(diagnostic));
}

function validateAndOrderPublicAddresses(
  addresses: ReadonlyArray<{ address: string; family: number }>,
): PublicAddress[] {
  if (addresses.length === 0) {
    throw new ProductSourceError(
      'SOURCE_UNAVAILABLE',
      'Product source host could not be resolved.',
    );
  }
  if (addresses.some(({ address }) => !isPublicIp(address))) {
    throw new ProductSourceError(
      'URL_NOT_ALLOWED',
      'Product source host is not publicly routable.',
    );
  }

  const unique = new Map<string, PublicAddress>();
  for (const entry of addresses) {
    if (entry.family !== 4 && entry.family !== 6) continue;
    unique.set(`${entry.family}:${entry.address}`, {
      address: entry.address,
      family: entry.family,
    });
  }

  const ordered = [...unique.values()].sort(
    (left, right) => left.family - right.family,
  );
  if (ordered.length === 0) {
    throw new ProductSourceError(
      'SOURCE_UNAVAILABLE',
      'Product source host could not be resolved.',
    );
  }
  return ordered.slice(0, MAX_ADDRESS_ATTEMPTS);
}

export function validateAndOrderPublicAddressesForTest(
  addresses: ReadonlyArray<{ address: string; family: number }>,
): PublicAddress[] {
  return validateAndOrderPublicAddresses(addresses);
}

export function classifyTransportFailureForTest(error: unknown): {
  kind: TransportFailureKind;
  code: string | null;
} {
  return classifyTransportFailure(error);
}

async function resolvePinnedPublicAddresses(
  url: URL,
): Promise<PublicAddress[]> {
  const hostname = normalizedHostname(url);
  try {
    const addresses = await lookup(hostname, { all: true, order: 'verbatim' });
    return validateAndOrderPublicAddresses(addresses);
  } catch (error) {
    if (error instanceof ProductSourceError) throw error;
    logSourceFailure('DNS', url, { code: safeErrorCode(error) });
    throw new ProductSourceError(
      'SOURCE_UNAVAILABLE',
      'Product source host could not be resolved.',
    );
  }
}

function responseContentType(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  return (value ?? '').split(';', 1)[0]?.trim().toLocaleLowerCase('en') ?? '';
}

function readBoundedBody(
  response: IncomingMessage,
  maxBytes: number,
): Promise<Buffer> {
  const contentLengthRaw = response.headers['content-length'];
  const contentLength = Number(
    Array.isArray(contentLengthRaw) ? contentLengthRaw[0] : contentLengthRaw,
  );
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    response.destroy();
    throw new ProductSourceError(
      'SOURCE_TOO_LARGE',
      'Remote response exceeds the import size limit.',
    );
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      response.destroy();
      reject(error);
    };

    response.on('data', (chunk: Buffer | Uint8Array | string) => {
      if (settled) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += bytes.byteLength;
      if (total > maxBytes) {
        fail(
          new ProductSourceError(
            'SOURCE_TOO_LARGE',
            'Remote response exceeds the import size limit.',
          ),
        );
        return;
      }
      chunks.push(bytes);
    });
    response.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, total));
    });
    response.on('error', (error) => {
      fail(
        error instanceof Error ? error : new Error('Remote response failed.'),
      );
    });
  });
}

function createTimeoutError(): NodeJS.ErrnoException {
  const error = new Error(
    'Product source request timed out.',
  ) as NodeJS.ErrnoException;
  error.code = 'ETIMEDOUT';
  return error;
}

function requestPinnedAddress(
  url: URL,
  pinned: PublicAddress,
  maxBytes: number,
  redirectsRemaining: number,
  deadlineAt: number,
  attempt: number,
): Promise<BoundedResponse> {
  const remainingMs = Math.max(1, deadlineAt - Date.now());
  const options: RequestOptions = {
    protocol: 'https:',
    hostname: pinned.address,
    port: 443,
    method: 'GET',
    path: `${url.pathname}${url.search}`,
    servername: normalizedHostname(url),
    maxHeaderSize: 16 * 1024,
    headers: {
      Host: url.host,
      Accept:
        'text/html,application/xhtml+xml,image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1',
      'Accept-Encoding': 'identity',
      'Accept-Language': 'en-CA,en;q=0.9',
      'User-Agent': USER_AGENT,
    },
  };

  return new Promise((resolve, reject) => {
    const request = httpsRequest(options, async (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location;

      if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
        response.resume();
        if (redirectsRemaining <= 0) {
          logSourceFailure('REDIRECT_LIMIT', url, {
            family: pinned.family,
            attempt,
          });
          reject(
            new ProductSourceError(
              'SOURCE_UNAVAILABLE',
              'Product source redirected too many times.',
            ),
          );
          return;
        }

        try {
          resolve(
            await fetchPinned(
              new URL(location, url),
              maxBytes,
              redirectsRemaining - 1,
              deadlineAt,
            ),
          );
        } catch (error) {
          reject(error);
        }
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        const kind =
          statusCode === 403 || statusCode === 429
            ? 'REMOTE_BLOCKED'
            : 'REMOTE_HTTP_ERROR';
        logSourceFailure(kind, url, {
          statusCode,
          family: pinned.family,
          attempt,
        });
        reject(
          new ProductSourceError(
            'SOURCE_UNAVAILABLE',
            kind === 'REMOTE_BLOCKED'
              ? 'Product source rejected the request.'
              : 'Product source returned an unsuccessful response.',
            { statusCode, remoteBlocked: kind === 'REMOTE_BLOCKED' },
          ),
        );
        return;
      }

      try {
        const body = await readBoundedBody(response, maxBytes);
        resolve({
          finalUrl: url,
          contentType: responseContentType(response.headers['content-type']),
          body,
        });
      } catch (error) {
        reject(error);
      }
    });

    request.setTimeout(remainingMs, () => {
      request.destroy(createTimeoutError());
    });
    request.on('error', reject);
    request.end();
  });
}

async function configureBrowserPage(page: unknown): Promise<void> {
  const browserPage = page as {
    setExtraHTTPHeaders(headers: Record<string, string>): Promise<void>;
    addInitScript(script: () => void): Promise<void>;
  };

  await browserPage.setExtraHTTPHeaders({
    'Accept-Language': 'en-CA,en;q=0.9',
  });
  await browserPage.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-CA', 'en'],
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
  });
}

async function browserFetchHtml(
  rawUrl: string | URL,
  maxBytes: number,
  deadlineAt: number,
): Promise<BoundedResponse> {
  const url = normalizeAndValidateUrl(String(rawUrl));
  const remainingMs = Math.max(1, deadlineAt - Date.now());
  const { chromium } = await import('playwright-chromium');
  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  };
  if (process.env.PRODUCT_SOURCE_BROWSER_PROXY_URL) {
    launchOptions.proxy = {
      server: process.env.PRODUCT_SOURCE_BROWSER_PROXY_URL,
    };
  }
  const browser = await chromium.launch(launchOptions);
  let page: Awaited<ReturnType<typeof browser.newPage>> | null = null;

  try {
    page = await browser.newPage({ userAgent: FALLBACK_BROWSER_USER_AGENT });
    await configureBrowserPage(page);
    const response = await page.goto(url.toString(), {
      timeout: remainingMs,
      waitUntil: 'domcontentloaded',
    });

    if (!response) {
      throw new ProductSourceError(
        'SOURCE_UNAVAILABLE',
        'Product source request failed.',
      );
    }

    const status = response.status();
    if (status < 200 || status >= 300) {
      const remoteBlocked = status === 403 || status === 429;
      throw new ProductSourceError(
        'SOURCE_UNAVAILABLE',
        remoteBlocked
          ? 'Product source rejected the request.'
          : 'Product source returned an unsuccessful response.',
        { statusCode: status, remoteBlocked },
      );
    }

    const html = await page.content();
    const body = Buffer.from(html, 'utf8');
    if (body.byteLength > maxBytes) {
      throw new ProductSourceError(
        'SOURCE_TOO_LARGE',
        'Remote response exceeds the import size limit.',
      );
    }

    const finalUrl = normalizeAndValidateUrl(page.url());
    return {
      finalUrl,
      contentType: 'text/html',
      body,
    };
  } finally {
    if (page) await page.close();
    await browser.close();
  }
}

async function browserFetchBinary(
  rawUrl: string | URL,
  maxBytes: number,
  deadlineAt: number,
): Promise<BoundedResponse> {
  const url = normalizeAndValidateUrl(String(rawUrl));
  const remainingMs = Math.max(1, deadlineAt - Date.now());
  const { chromium } = await import('playwright-chromium');
  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  };
  if (process.env.PRODUCT_SOURCE_BROWSER_PROXY_URL) {
    launchOptions.proxy = {
      server: process.env.PRODUCT_SOURCE_BROWSER_PROXY_URL,
    };
  }
  const browser = await chromium.launch(launchOptions);
  let page: Awaited<ReturnType<typeof browser.newPage>> | null = null;

  try {
    page = await browser.newPage({ userAgent: FALLBACK_BROWSER_USER_AGENT });
    await configureBrowserPage(page);
    const response = await page.goto(url.toString(), {
      timeout: remainingMs,
      waitUntil: 'domcontentloaded',
    });

    if (!response) {
      throw new ProductSourceError(
        'SOURCE_UNAVAILABLE',
        'Product source request failed.',
      );
    }

    const status = response.status();
    if (status < 200 || status >= 300) {
      const remoteBlocked = status === 403 || status === 429;
      throw new ProductSourceError(
        'SOURCE_UNAVAILABLE',
        remoteBlocked
          ? 'Product source rejected the request.'
          : 'Product source returned an unsuccessful response.',
        { statusCode: status, remoteBlocked },
      );
    }

    const body = await response.body();
    if (body.byteLength > maxBytes) {
      throw new ProductSourceError(
        'SOURCE_TOO_LARGE',
        'Remote response exceeds the import size limit.',
      );
    }

    const finalUrl = normalizeAndValidateUrl(page.url());
    return {
      finalUrl,
      contentType: responseContentType(response.headers()['content-type']),
      body: Buffer.from(body),
    };
  } finally {
    if (page) await page.close();
    await browser.close();
  }
}

async function fetchPinned(
  rawUrl: string | URL,
  maxBytes: number,
  redirectsRemaining = MAX_REDIRECTS,
  deadlineAt = Date.now() + REQUEST_TIMEOUT_MS,
  allowBrowserFallback = false,
): Promise<BoundedResponse> {
  const url = normalizeAndValidateUrl(String(rawUrl));
  const addresses = await resolvePinnedPublicAddresses(url);
  let lastTransportError: unknown = null;

  for (let index = 0; index < addresses.length; index += 1) {
    if (Date.now() >= deadlineAt) break;
    const pinned = addresses[index];
    if (!pinned) continue;

    try {
      return await requestPinnedAddress(
        url,
        pinned,
        maxBytes,
        redirectsRemaining,
        deadlineAt,
        index + 1,
      );
    } catch (error) {
      if (error instanceof ProductSourceError) {
        if (
          allowBrowserFallback &&
          error.reason === 'SOURCE_UNAVAILABLE' &&
          error.metadata?.remoteBlocked
        ) {
          return await browserFetchHtml(url, maxBytes, deadlineAt);
        }
        throw error;
      }
      lastTransportError = error;
      const failure = classifyTransportFailure(error);
      logSourceFailure(failure.kind, url, {
        family: pinned.family,
        attempt: index + 1,
        code: failure.code,
      });
    }
  }

  const failure = classifyTransportFailure(lastTransportError);
  throw new ProductSourceError(
    'SOURCE_UNAVAILABLE',
    failure.kind === 'TIMEOUT'
      ? 'Product source request timed out.'
      : failure.kind === 'TLS'
        ? 'Product source TLS connection failed.'
        : 'Product source request failed.',
  );
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .trim();
}

function parseTagAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag))) {
    const name = match[1]?.toLocaleLowerCase('en');
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    if (name) attributes[name] = decodeHtml(value);
  }
  return attributes;
}

function extractMeta(html: string): Map<string, string> {
  const meta = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseTagAttributes(tag);
    const key = (attributes.property ?? attributes.name)?.toLocaleLowerCase(
      'en',
    );
    const content = attributes.content;
    if (key && content && !meta.has(key)) meta.set(key, content);
  }
  return meta;
}

export function isBlockedProductDocumentForTest(content: string): boolean {
  const title = content.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?? content.match(/^Title:\s*(.+)$/im)?.[1]
    ?? '';
  const normalizedTitle = decodeHtml(title.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en');

  return /^(?:access denied|forbidden|request blocked|page blocked|security check|required|just a moment)(?:\b|[.! -])/.test(normalizedTitle)
    || /(?:you don't have permission to access|verify you are human|enable javascript and cookies to continue|reference\s*#\s*\d+\.)/i.test(content);
}

function findProductNode(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findProductNode(entry);
      if (found) return found;
    }
    return null;
  }

  if (!value || typeof value !== 'object') return null;
  const object = value as Record<string, unknown>;
  const type = object['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (
    types.some((entry) => typeof entry === 'string' && /product/i.test(entry))
  ) {
    return object;
  }

  for (const child of Object.values(object)) {
    const found = findProductNode(child);
    if (found) return found;
  }
  return null;
}

function extractJsonLdProduct(html: string): Record<string, unknown> | null {
  const pattern =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const body = match[1]?.trim();
    if (!body) continue;
    try {
      const found = findProductNode(JSON.parse(body));
      if (found) return found;
    } catch {
      // Ignore malformed third-party JSON-LD and continue to metadata fallbacks.
    }
  }
  return null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? decodeHtml(value) : null;
}

function brandValue(value: unknown): string | null {
  const direct = stringValue(value);
  if (direct) return direct;
  if (value && typeof value === 'object') {
    return stringValue((value as Record<string, unknown>).name);
  }
  return null;
}

function stringList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((entry) => (typeof entry === 'string' ? entry.split(/[,;|]/) : []))
    .map(decodeHtml)
    .filter(Boolean);
}

function imageCandidatesFromValue(value: unknown): string[] {
  if (typeof value === 'string') return [value.trim()].filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(imageCandidatesFromValue);
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return imageCandidatesFromValue(
      object.contentUrl ??
        object.url ??
        object['@id'] ??
        object.image ??
        object.thumbnailUrl,
    );
  }
  return [];
}

function parseSrcset(srcset: string): string[] {
  return srcset
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter((value): value is string => Boolean(value));
}

export function extractProductMetadataForTest(
  html: string,
  pageUrl: URL,
): ProductMetadata {
  if (isBlockedProductDocumentForTest(html)) {
    return { name: null, brand: null, colors: [], materials: [], categoryHint: null, imageUrls: [] };
  }
  const product = extractJsonLdProduct(html);
  const meta = extractMeta(html);

  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const name =
    stringValue(product?.name) ??
    meta.get('og:title') ??
    meta.get('twitter:title') ??
    (titleMatch ? decodeHtml(titleMatch.replace(/<[^>]+>/g, ' ')) : null);
  const brand =
    brandValue(product?.brand) ??
    meta.get('product:brand') ??
    meta.get('og:brand') ??
    null;
  const colors = stringList(product?.color ?? meta.get('product:color'));
  const materials = stringList(
    product?.material ?? meta.get('product:material'),
  );
  const categoryHint = stringValue(product?.category) ?? null;

  const structuredProductImages = imageCandidatesFromValue(product?.image);
  const rawImageValues = structuredProductImages.length > 0
    ? structuredProductImages
    : [
        meta.get('og:image:secure_url'),
        meta.get('og:image'),
        meta.get('twitter:image'),
      ].filter(Boolean) as string[];

  const imageUrls = Array.from(
    new Set(
      rawImageValues
        .map((rawImage) => {
          try {
            return normalizeAndValidateUrl(
              new URL(rawImage, pageUrl).toString(),
            ).toString();
          } catch {
            return null;
          }
        })
        .filter((url): url is string => Boolean(url)),
    ),
  );

  return {
    name,
    brand,
    colors,
    materials,
    categoryHint,
    imageUrls,
  };
}

function isLikelyProductImage(url: URL, alt: string): boolean {
  const searchable = `${url.pathname} ${alt}`.toLocaleLowerCase('en');
  if (/\.svg$/i.test(url.pathname)) return false;
  if (/(?:logo|icon|avatar|sprite|banner|badge|payment|klarna|afterpay|chat)/.test(searchable)) {
    return false;
  }

  return /(?:productimages?|products?|sku|pdp|catalog|merchandise|zoom|primary|main)/.test(searchable);
}

/** Parse the bounded Markdown returned by the final reader fallback. */
export function extractReaderProductMetadataForTest(
  markdown: string,
  pageUrl: URL,
): ProductMetadata {
  if (isBlockedProductDocumentForTest(markdown)) {
    return { name: null, brand: null, colors: [], materials: [], categoryHint: null, imageUrls: [] };
  }
  const title = markdown.match(/^Title:\s*(.+)$/im)?.[1]?.trim() ?? null;
  const titleParts = title?.split(/\s+[|]\s+|\s+-\s+/).map((part) => part.trim()).filter(Boolean) ?? [];
  const retailer = titleParts.length > 2 ? titleParts.at(-1) : null;
  const name = titleParts[0] ?? title;
  const brand = titleParts.length > 1
    ? [...titleParts].reverse().find((part) => part !== name && part !== retailer) ?? null
    : null;

  const firstBreadcrumb = markdown.match(/^\d+\.\s+\[([^\]]+)]\(https?:\/\/[^)]+\)$/m)?.[1] ?? null;
  const detail = (label: string) => markdown.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]+)`, 'i'))?.[1]?.trim() ?? null;
  const keyNotes = (detail('Key Notes') ?? '').split(',').map((note) => note.trim()).filter(Boolean);
  const bottleSizeMatch = markdown.match(/\bSize:\s*(?:[\d.]+\s*oz\s*\/\s*)?([\d.]+)\s*ml\b/i);
  const priceMatch = markdown.match(/\*\*\$([\d,]+(?:\.\d{1,2})?)\*\*/);
  const price = priceMatch?.[1] ? Number(priceMatch[1].replaceAll(',', '')) : null;
  const currency = price !== null
    ? (/\/ca(?:\/|$)/i.test(pageUrl.pathname) ? 'CAD' : 'USD')
    : null;
  const imageUrls: string[] = [];
  const imagePattern = /!\[([^\]]*)]\((https:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/gi;
  let imageMatch: RegExpExecArray | null;
  while ((imageMatch = imagePattern.exec(markdown))) {
    try {
      const candidate = normalizeAndValidateUrl(imageMatch[2] ?? '');
      if (isLikelyProductImage(candidate, imageMatch[1] ?? '')) {
        imageUrls.push(candidate.toString());
      }
    } catch {
      // Ignore malformed or unsafe third-party image references.
    }
  }

  const requestedSku = pageUrl.searchParams.get('skuId')?.toLocaleLowerCase('en') ?? null;
  const uniqueImages = Array.from(new Set(imageUrls));
  const skuImages = requestedSku
    ? uniqueImages.filter((imageUrl) => new URL(imageUrl).pathname.toLocaleLowerCase('en').includes(`s${requestedSku}`))
    : [];
  if (
    requestedSku &&
    /^\d+$/.test(requestedSku) &&
    /(^|\.)sephora\.com$/i.test(pageUrl.hostname) &&
    skuImages.length === 0
  ) {
    skuImages.push(`https://www.sephora.com/productimages/sku/s${requestedSku}-main-zoom-1.jpg?imwidth=1200`);
  }

  return {
    name,
    brand,
    colors: [],
    materials: [],
    categoryHint: firstBreadcrumb,
    imageUrls: requestedSku ? skuImages : uniqueImages,
    fragranceDetails: {
      fragranceFamily: detail('Fragrance Family'),
      scentType: detail('Scent Type'),
      keyNotes,
      bottleSizeMl: bottleSizeMatch?.[1] ? Number(bottleSizeMatch[1]) : null,
      price: Number.isFinite(price) ? price : null,
      currency,
    },
  };
}

async function inspectWithReaderFallback(sourceUrl: string): Promise<ProductSourceSnapshot> {
  const originalUrl = normalizeAndValidateUrl(sourceUrl);
  const readerUrl = `${READER_FALLBACK_ORIGIN}${originalUrl.toString()}`;
  const response = await fetchPinned(
    readerUrl,
    MAX_HTML_BYTES,
    MAX_REDIRECTS,
    Date.now() + READER_FALLBACK_TIMEOUT_MS,
  );
  if (!['text/plain', 'text/markdown', 'text/html'].includes(response.contentType)) {
    throw new ProductSourceError('UNSUPPORTED_CONTENT', 'Product reader returned unsupported content.');
  }

  const metadata = extractReaderProductMetadataForTest(response.body.toString('utf8'), originalUrl);
  if (!metadata.name && !metadata.brand && !metadata.categoryHint && metadata.imageUrls.length === 0) {
    throw new ProductSourceError('PRODUCT_NOT_RECOGNIZED', 'Product reader metadata could not be recognized.');
  }

  return { sourceUrl: originalUrl.toString(), ...metadata };
}

/**
 * Retailers commonly rotate signed query strings between preview and save.
 * Resolve a submitted choice back to the freshly inspected, server-trusted
 * candidate instead of fetching the browser value directly.
 */
export function selectProductImageUrlForTest(
  discoveredUrls: string[],
  selectedUrl?: string,
): string | undefined {
  if (!selectedUrl) return discoveredUrls[0];

  const exact = discoveredUrls.find((url) => url === selectedUrl);
  if (exact) return exact;

  try {
    const selected = new URL(selectedUrl);
    return discoveredUrls.find((candidate) => {
      const discovered = new URL(candidate);
      return discovered.origin === selected.origin &&
        discovered.pathname === selected.pathname;
    });
  } catch {
    return undefined;
  }
}

export class HttpProductSourceService implements IProductSourceService {
  async inspect(sourceUrl: string): Promise<ProductSourceSnapshot> {
    normalizeAndValidateUrl(sourceUrl);
    try {
      const response = await fetchPinned(
        sourceUrl,
        MAX_HTML_BYTES,
        MAX_REDIRECTS,
        Date.now() + REQUEST_TIMEOUT_MS,
        true,
      );
      if (!['text/html', 'application/xhtml+xml'].includes(response.contentType)) {
        throw new ProductSourceError('UNSUPPORTED_CONTENT', 'Product source must return HTML.');
      }

      const metadata = extractProductMetadataForTest(response.body.toString('utf8'), response.finalUrl);
      if (!metadata.name && !metadata.brand && !metadata.categoryHint && metadata.imageUrls.length === 0) {
        throw new ProductSourceError('PRODUCT_NOT_RECOGNIZED', 'Product metadata could not be recognized.');
      }

      return { sourceUrl: response.finalUrl.toString(), ...metadata };
    } catch (error) {
      if (error instanceof ProductSourceError && error.reason === 'URL_NOT_ALLOWED') throw error;
      try {
        return await inspectWithReaderFallback(sourceUrl);
      } catch {
        throw error;
      }
    }
  }

  async downloadPrimaryImage(
    sourceUrl: string,
    imageUrl?: string,
  ): Promise<DownloadedProductImage> {
    const snapshot = await this.inspect(sourceUrl);
    const selectedImageUrl = selectProductImageUrlForTest(
      snapshot.imageUrls,
      imageUrl,
    );

    if (!selectedImageUrl) {
      throw new ProductSourceError(
        'IMAGE_NOT_FOUND',
        'Product source does not expose a primary image.',
      );
    }

    try {
      const response = await fetchPinned(selectedImageUrl, MAX_IMAGE_BYTES);
      if (
        !response.contentType.startsWith('image/') &&
        response.contentType !== 'application/octet-stream'
      ) {
        throw new ProductSourceError(
          'UNSUPPORTED_CONTENT',
          'Product image source did not return image content.',
        );
      }

      return {
        bytes: response.body,
        declaredContentType: response.contentType || null,
      };
    } catch (error) {
      if (
        error instanceof ProductSourceError &&
        error.reason === 'SOURCE_UNAVAILABLE' &&
        error.metadata?.remoteBlocked
      ) {
        const response = await browserFetchBinary(
          selectedImageUrl,
          MAX_IMAGE_BYTES,
          Date.now() + REQUEST_TIMEOUT_MS,
        );
        if (
          !response.contentType.startsWith('image/') &&
          response.contentType !== 'application/octet-stream'
        ) {
          throw new ProductSourceError(
            'UNSUPPORTED_CONTENT',
            'Product image source did not return image content.',
          );
        }

        return {
          bytes: response.body,
          declaredContentType: response.contentType || null,
        };
      }
      throw error;
    }
  }
}
