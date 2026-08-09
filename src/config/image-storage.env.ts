import { z } from 'zod';

const s3PrefixSegment = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'must be a single safe S3 prefix segment');

const imageStorageEnvSchema = z.object({
  AWS_REGION: z.string().trim().min(1),
  AWS_S3_BUCKET_NAME: z.string().trim().min(3).max(63),
  AWS_S3_ROOT_PREFIX: s3PrefixSegment.default('wardrope'),
});

export interface ImageStorageConfig {
  region: string;
  bucketName: string;
  rootPrefix: string;
}

export function getImageStorageConfig(): ImageStorageConfig {
  const parsed = imageStorageEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid Wardrope image storage configuration: ${details}`);
  }

  return {
    region: parsed.data.AWS_REGION,
    bucketName: parsed.data.AWS_S3_BUCKET_NAME,
    rootPrefix: parsed.data.AWS_S3_ROOT_PREFIX,
  };
}
