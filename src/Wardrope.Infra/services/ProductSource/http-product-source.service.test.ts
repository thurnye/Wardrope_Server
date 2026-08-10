import { describe, expect, it } from 'vitest';
import {
  classifyTransportFailureForTest,
  extractReaderProductMetadataForTest,
  extractProductMetadataForTest,
  HttpProductSourceService,
  isBlockedProductDocumentForTest,
  selectProductImageUrlForTest,
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
  it('does not treat access-denied pages as product names', () => {
    const html = '<html><head><title>Access Denied</title></head><body>You do not have access.</body></html>';
    const markdown = 'Title: Access Denied\n\nYou don\'t have permission to access this page.';

    expect(isBlockedProductDocumentForTest(html)).toBe(true);
    expect(extractProductMetadataForTest(html, new URL('https://shop.example/item'))).toMatchObject({
      name: null,
      imageUrls: [],
    });
    expect(extractReaderProductMetadataForTest(markdown, new URL('https://shop.example/item'))).toMatchObject({
      name: null,
      imageUrls: [],
    });
  });

  it('extracts only product media from the final reader fallback', () => {
    const markdown = `Title: Sauvage Eau de Parfum - Dior | Sephora

1. [Fragrance](https://www.sephora.com/ca/en/shop/fragrance)

**$150.00**
Size: 2.0 oz / 60 ml
**Fragrance Family:** Earthy & Woody
**Scent Type:** Citrus & Woods
**Key Notes:** Calabrian Bergamot, Patchouli, Vanilla Absolute

![Klarna](https://www.sephora.com/img/ufe/logo-klarna.svg)
![AI Chat](https://www.sephora.com/img/ufe/ai/ai_chat.svg)
![Product](https://www.sephora.com/productimages/sku/s2038123-main-zoom-1.jpg?imwidth=160)`;

    expect(extractReaderProductMetadataForTest(
      markdown,
      new URL('https://www.sephora.com/ca/en/product/sauvage-eau-de-parfum-P428500?skuId=2038123'),
    )).toEqual({
      name: 'Sauvage Eau de Parfum',
      brand: 'Dior',
      colors: [],
      materials: [],
      categoryHint: 'Fragrance',
      imageUrls: ['https://www.sephora.com/productimages/sku/s2038123-main-zoom-1.jpg?imwidth=160'],
      fragranceDetails: {
        fragranceFamily: 'Earthy & Woody',
        scentType: 'Citrus & Woods',
        keyNotes: ['Calabrian Bergamot', 'Patchouli', 'Vanilla Absolute'],
        bottleSizeMl: 60,
        price: 150,
        currency: 'CAD',
      },
    });
  });

  it('rejects recommendation images that do not match a requested retailer SKU', () => {
    const markdown = `Title: Sauvage Eau de Parfum - Dior | Sephora
![Other product](https://www.sephora.com/productimages/sku/s9999999-main-zoom.jpg)
![Requested product](https://www.sephora.com/productimages/sku/s2038123-main-zoom-1.jpg)`;

    expect(extractReaderProductMetadataForTest(
      markdown,
      new URL('https://www.sephora.com/product/example?skuId=2038123'),
    ).imageUrls).toEqual([
      'https://www.sephora.com/productimages/sku/s2038123-main-zoom-1.jpg',
    ]);
  });

  it('derives only the exact Sephora SKU image when reader output omits the hero image', () => {
    const metadata = extractReaderProductMetadataForTest(
      'Title: Sauvage Eau de Parfum - Dior | Sephora',
      new URL('https://www.sephora.com/ca/en/product/sauvage-P428500?skuId=2038123'),
    );

    expect(metadata.imageUrls).toEqual([
      'https://www.sephora.com/productimages/sku/s2038123-main-zoom-1.jpg?imwidth=1200',
    ]);
  });

  it('matches a selected product image after its signed query parameters rotate', () => {
    expect(selectProductImageUrlForTest(
      ['https://cdn.example/products/shirt.jpg?signature=new&width=1200'],
      'https://cdn.example/products/shirt.jpg?signature=old&width=1200',
    )).toBe('https://cdn.example/products/shirt.jpg?signature=new&width=1200');
  });

  it('does not match a browser-supplied URL to a different product image path', () => {
    expect(selectProductImageUrlForTest(
      ['https://cdn.example/products/shirt.jpg'],
      'https://cdn.example/site/logo.jpg',
    )).toBeUndefined();
  });

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
      imageUrls: ['https://shop.example/media/navy.jpg'],
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
      imageUrls: [],
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
      imageUrls: ['https://image.hm.com/assets/hm-product.jpg'],
    });
  });

  it('does not offer unrelated page images when product metadata has no image', () => {
    const html = `<html><head><meta property="og:title" content="Blue Shirt" /></head>
      <body><img src="/logo.png"><img src="/recommendation.jpg"><img src="/tracking.gif"></body></html>`;
    expect(extractProductMetadataForTest(
      html,
      new URL('https://shop.example/products/blue-shirt'),
    ).imageUrls).toEqual([]);
  });
});
