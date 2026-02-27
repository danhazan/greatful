export interface TextareaEmojiInsertionResult {
  value: string
  cursor: number
}

export function insertEmojiIntoTextarea(
  value: string,
  emoji: string,
  selectionStart: number,
  selectionEnd: number
): TextareaEmojiInsertionResult {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))

  const nextValue = value.slice(0, start) + emoji + value.slice(end)
  const cursor = start + emoji.length

  return { value: nextValue, cursor }
}
