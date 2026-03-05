import React from 'react'
import { getEmojiFromCode } from '@/utils/emojiMapping'

interface ReactionsBannerProps {
    totalCount: number
    emojiCodes: string[]
    onClick: () => void
    className?: string
}

/**
 * Displays a compact, clickable summary of reactions on a post.
 * Shows the total reaction count followed by unique emoji characters.
 *
 * - Left-aligned, single row, overflow clipped silently (no +N indicator)
 * - Clicking anywhere on the banner opens the Reactions Modal
 * - Only renders when totalCount > 0
 */
export function ReactionsBanner({ totalCount, emojiCodes, onClick, className = '' }: ReactionsBannerProps) {
    if (totalCount <= 0) return null

    return (
        <div className={`mb-1 ${className}`}>
            <button
                type="button"
                onClick={onClick}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer max-w-full overflow-hidden"
                title="View reactions"
            >
                {/* Total count */}
                <span className="font-medium text-gray-600 flex-shrink-0 tabular-nums">
                    {totalCount}
                </span>

                {/* Emoji list — flex-nowrap, overflow clipped silently */}
                <span className="flex items-center gap-0.5 overflow-hidden flex-nowrap">
                    {emojiCodes.map((code) => (
                        <span
                            key={code}
                            className="text-sm flex-shrink-0 leading-none"
                            aria-label={code}
                        >
                            {getEmojiFromCode(code)}
                        </span>
                    ))}
                </span>
            </button>
        </div>
    )
}

export default ReactionsBanner
