import { z } from 'zod';

export const registerBodySchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(12).max(128),
    displayName: z.string().trim().min(1).max(80),
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
