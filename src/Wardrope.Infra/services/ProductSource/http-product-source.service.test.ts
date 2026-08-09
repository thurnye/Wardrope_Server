import { describe, expect, it } from 'vitest';
import { ProductSourceError } from '../../../Wardrope.Core/services/ServicesInterface/ProductSource/product-source.service.interface';
import { HttpProductSourceService } from './http-product-source.service';

async function expectBlocked(url: string) {
  const service = new HttpProductSourceService();
  await expect(service.inspect(url)).rejects.toMatchObject<ProductSourceError>({
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
