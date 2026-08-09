import { describe, expect, it } from 'vitest';
import {
  extractProductMetadataForTest,
  HttpProductSourceService,
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
});
