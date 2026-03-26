'use client'

/**
 * Environment detection utility.
 *
 * Next.js only loads .env, .env.local, .env.development, .env.production, .env.test
 * automatically. There is no native .env.staging support.
 *
 * For staging deployments, inject NEXT_PUBLIC_ENVIRONMENT=staging at build time:
 *   - Vercel: set it in the project's environment variables for the staging deployment
 *   - CLI:   NEXT_PUBLIC_ENVIRONMENT=staging npm run build
 *   - CI/CD: inject as an environment variable in the pipeline config
 */

export type Environment = 'development' | 'staging' | 'production'

export function getEnvironment(): Environment {
  const explicit = process.env['NEXT_PUBLIC_ENVIRONMENT']
  if (explicit === 'staging') return 'staging'
  if (explicit === 'production') return 'production'
  if (process.env['NODE_ENV'] === 'production') return 'production'
  return 'development'
}

export function isDebugEnvironment(): boolean {
  const env = getEnvironment()
  return env === 'development' || env === 'staging'
}

/**
 * Returns a short label for the current environment, or null in production.
 * Can be used to render a visual indicator (e.g. badge in Navbar) to prevent
 * accidental confusion with production.
 */
export function getEnvironmentBadge(): string | null {
  const env = getEnvironment()
  if (env === 'staging') return 'STAGING'
  if (env === 'development') return 'DEV'
  return null
}
