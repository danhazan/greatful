import { describe, it, expect } from '@jest/globals'
import { insertEmojiIntoTextarea } from '@/utils/insertEmojiIntoTextarea'

describe('insertEmojiIntoTextarea', () => {
  it('inserts emoji at cursor position', () => {
    const result = insertEmojiIntoTextarea('hello world', '😊', 5, 5)
    expect(result.value).toBe('hello😊 world')
    expect(result.cursor).toBe(7)
  })

  it('replaces selected text with emoji', () => {
    const result = insertEmojiIntoTextarea('hello world', '🔥', 6, 11)
    expect(result.value).toBe('hello 🔥')
    expect(result.cursor).toBe(8)
  })

  it('inserts at start when selection is negative', () => {
    const result = insertEmojiIntoTextarea('test', '💜', -5, -1)
    expect(result.value).toBe('💜test')
    expect(result.cursor).toBe(2)
  })

  it('inserts at end when selection exceeds length', () => {
    const result = insertEmojiIntoTextarea('test', '✨', 10, 10)
    expect(result.value).toBe('test✨')
    expect(result.cursor).toBe(5)
  })
})
