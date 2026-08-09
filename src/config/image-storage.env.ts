import { z } from 'zod';

const imageStorageEnvSchema = z.object({
  AWS_REGION: z.string().trim().min(1),
  AWS_S3_BUCKET_NAME: z.string().trim().min(3).max(63),
});

export interface ImageStorageConfig {
  region: string;
  bucketName: string;
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
  };
}
