/**
 * Contract Assertion Utility
 * Used to ensure API responses adhere to the camelCase contract.
 */

/**
 * Checks if an object or array contains any snake_case keys.
 * Recursively inspects nested objects and arrays.
 */
export function hasSnakeCaseKeys(obj: any): string[] {
    const snakeKeys: string[] = []

    if (!obj || typeof obj !== 'object') return snakeKeys

    if (Array.isArray(obj)) {
        obj.forEach(item => {
            snakeKeys.push(...hasSnakeCaseKeys(item))
        })
        return [...new Set(snakeKeys)]
    }

    Object.keys(obj).forEach(key => {
        if (key.includes('_')) {
            snakeKeys.push(key)
        }

        // Recursively check values
        const value = obj[key]
        if (value && typeof value === 'object') {
            snakeKeys.push(...hasSnakeCaseKeys(value))
        }
    })

    return [...new Set(snakeKeys)]
}

/**
 * Asserts that an object or array contains no snake_case keys.
 * Logs a warning in development mode if violations are found.
 */
export function assertNoSnakeCase(data: any, context: string = 'API Response'): void {
    // Only run in development
    if (process.env['NODE_ENV'] !== 'development') return

    const violations = hasSnakeCaseKeys(data)
    if (violations.length > 0) {
        console.warn(`[Contract Violation] ${context} contains snake_case keys:`, violations)
        // In strict mode, we could throw an error, but for now we'll just warn
        // throw new Error(`Contract violation: snake_case keys found in ${context}`)
    }
}

/**
 * Validates that an object has no snake_case keys.
 * Useful for filtering or debugging.
 */
export function validateCamelCase(data: any): boolean {
    return hasSnakeCaseKeys(data).length === 0
}
