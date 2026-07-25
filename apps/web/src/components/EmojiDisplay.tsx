"use client"

import { getEmojiFromCode } from '@/constants/reactions'

export function EmojiDisplay({ code, className = '' }: { code: string; className?: string }) {
  const character = getEmojiFromCode(code)
  const match = code.match(/^flag_([a-z]{2})$/)
  if (match) {
    return (
      <img
        src={`https://flagcdn.com/40x30/${match[1]}.png`}
        alt={character}
        className={`inline-block align-text-bottom ${className}`}
        style={{ width: '1em', height: '0.75em' }}
      />
    )
  }
  return <span className={className}>{character}</span>
}
