/**
 * Centralized content limit constants.
 *
 * These are the frontend-authoritative values for all content length validation.
 * The backend enforces the same limits independently — keep them in sync by
 * updating `apps/api/app/core/constants.py` whenever these values change.
 */

/** Maximum characters for comments and replies */
export const MAX_COMMENT_CHARS = 2000

/** Maximum characters for posts */
export const MAX_POST_CHARS = 10000
