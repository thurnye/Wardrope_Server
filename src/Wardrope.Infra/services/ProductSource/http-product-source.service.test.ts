import { describe, expect, it } from 'vitest';
import {
  classifyTransportFailureForTest,
  extractProductMetadataForTest,
  HttpProductSourceService,
  validateAndOrderPublicAddressesForTest,
} from './http-product-source.service';

async function expectBlocked(url: string) {
  const service = new HttpProductSourceService();
  await expect(service.inspect(url)).rejects.toMatchObject({
    reason: 'URL_NOT_ALLOWED',
  });
}

describe('HttpProductSourceService SSRF guardrails', () => {
  it('rejects non-HTTPS URLs before any outbound request', async () => {
    await expectBlocked('http://example.com/product');
    await expectBlocked('file:///etc/passwd');
  });

  it('rejects credential-bearing and non-standard-port product URLs', async () => {
    await expectBlocked('https://user:secret@example.com/product');
    await expectBlocked('https://example.com:8443/product');
  });

  it('rejects localhost, private networks, link-local metadata and IPv6 loopback', async () => {
    await expectBlocked('https://localhost/product');
    await expectBlocked('https://127.0.0.1/product');
    await expectBlocked('https://10.0.0.4/product');
    await expectBlocked('https://172.16.5.4/product');
    await expectBlocked('https://192.168.1.5/product');
    await expectBlocked('https://169.254.169.254/latest/meta-data');
    await expectBlocked('https://[::1]/product');
  });

  it('rejects known cloud metadata hostnames', async () => {
    await expectBlocked('https://metadata.amazonaws.com/latest/meta-data');
    await expectBlocked('https://metadata.google.internal/computeMetadata/v1');
  });

  it('validates every DNS answer, deduplicates it and prefers IPv4 before IPv6', () => {
    expect(validateAndOrderPublicAddressesForTest([
      { address: '2606:4700:4700::1111', family: 6 },
      { address: '1.1.1.1', family: 4 },
      { address: '1.1.1.1', family: 4 },
      { address: '8.8.8.8', family: 4 },
    ])).toEqual([
      { address: '1.1.1.1', family: 4 },
      { address: '8.8.8.8', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ]);
  });

  it('fails closed when any DNS answer is not publicly routable', () => {
    expect(() => validateAndOrderPublicAddressesForTest([
      { address: '1.1.1.1', family: 4 },
      { address: '10.0.0.4', family: 4 },
    ])).toThrow('Product source host is not publicly routable.');
  });

  it('caps the number of pinned addresses attempted for one request', () => {
    expect(validateAndOrderPublicAddressesForTest([
      { address: '1.1.1.1', family: 4 },
      { address: '8.8.8.8', family: 4 },
      { address: '9.9.9.9', family: 4 },
      { address: '208.67.222.222', family: 4 },
      { address: '76.76.2.0', family: 4 },
    ])).toHaveLength(4);
  });
});

describe('product source diagnostics', () => {
  it('classifies timeout, TLS and network transport failures without exposing raw error text', () => {
    expect(classifyTransportFailureForTest(
      Object.assign(new Error('secret timeout details'), { code: 'ETIMEDOUT' }),
    )).toEqual({ kind: 'TIMEOUT', code: 'ETIMEDOUT' });

    expect(classifyTransportFailureForTest(
      Object.assign(new Error('certificate details'), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' }),
    )).toEqual({ kind: 'TLS', code: 'ERR_TLS_CERT_ALTNAME_INVALID' });

    expect(classifyTransportFailureForTest(
      Object.assign(new Error('connection details'), { code: 'ECONNRESET' }),
    )).toEqual({ kind: 'NETWORK', code: 'ECONNRESET' });
  });
});

describe('product metadata extraction', () => {
  it('prefers structured Product JSON-LD and resolves relative primary images', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Navy Leather Sneaker",
            "brand": { "@type": "Brand", "name": "Example" },
            "color": ["Navy", "White"],
            "material": "Leather",
            "category": "Men > Shoes > Sneakers",
            "image": ["/media/navy.jpg"]
          }
        </script>
      </head></html>`;

    expect(extractProductMetadataForTest(
      html,
      new URL('https://shop.example/products/navy-sneaker'),
    )).toEqual({
      name: 'Navy Leather Sneaker',
      brand: 'Example',
      colors: ['Navy', 'White'],
      materials: ['Leather'],
      categoryHint: 'Men > Shoes > Sneakers',
      imageUrl: 'https://shop.example/media/navy.jpg',
    });
  });

  it('falls back to Open Graph metadata without accepting an unsafe image URL', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Classic Oxford Shirt" />
        <meta property="product:brand" content="Example Brand" />
        <meta property="og:image" content="http://127.0.0.1/private.jpg" />
      </head></html>`;

    expect(extractProductMetadataForTest(
      html,
      new URL('https://shop.example/products/oxford'),
    )).toMatchObject({
      name: 'Classic Oxford Shirt',
      brand: 'Example Brand',
      imageUrl: null,
    });
  });

  it('keeps H&M-style product metadata importable for the reported product page shape', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Relaxed-Fit Linen-Blend Pants" />
        <meta property="product:brand" content="H&amp;M" />
        <meta property="product:color" content="White/brown/beige" />
        <meta property="product:material" content="Linen;Viscose" />
        <meta property="og:image" content="https://image.hm.com/assets/hm-product.jpg" />
      </head></html>`;

    expect(extractProductMetadataForTest(
      html,
      new URL('https://www2.hm.com/en_ca/productpage.1315981004.html'),
    )).toEqual({
      name: 'Relaxed-Fit Linen-Blend Pants',
      brand: 'H&M',
      colors: ['White/brown/beige'],
      materials: ['Linen', 'Viscose'],
      categoryHint: null,
      imageUrl: 'https://image.hm.com/assets/hm-product.jpg',
    });
  });
});
