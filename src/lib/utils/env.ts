import { z } from 'zod';

/**
 * Environment variables schema with Zod validation
 * This ensures that all required environment variables are present and correctly typed
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),
  
  // NextAuth
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1),
  
  // Email (for authentication and sending)
  EMAIL_SERVER_HOST: z.string().min(1).optional(),
  EMAIL_SERVER_PORT: z.coerce.number().optional(),
  EMAIL_SERVER_USER: z.string().optional(),
  EMAIL_SERVER_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Parse and validate environment variables
 * This will throw an error if any required variables are missing or invalid
 */
export const env = envSchema.parse(process.env);

/**
 * Type definition for environment variables
 * This provides type safety when accessing environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Safe environment variable access
 * This function provides a safe way to access environment variables with proper typing
 */
export const getEnv = <K extends keyof Env>(key: K): Env[K] => {
  return env[key];
};