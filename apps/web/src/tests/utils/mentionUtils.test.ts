import { describe, it, expect } from '@jest/globals'
import {
  extractMentions,
  hasMentions,
  splitContentWithMentions,
  isValidUsername,
  getUniqueUsernames,
  MENTION_REGEX
} from '@/utils/mentionUtils'

describe('mentionUtils', () => {
  describe('extractMentions', () => {
    it('should extract single mention from content', () => {
      const content = 'Hello @john, how are you?'
      const mentions = extractMentions(content)
      
      expect(mentions).toHaveLength(1)
      expect(mentions[0]).toEqual({
        username: 'john',
        startIndex: 6,
        endIndex: 11
      })
    })

    it('should extract multiple mentions from content', () => {
      const content = 'Hey @alice and @bob, check this out!'
      const mentions = extractMentions(content)
      
      expect(mentions).toHaveLength(2)
      expect(mentions[0]).toEqual({
        username: 'alice',
        startIndex: 4,
        endIndex: 10
      })
      expect(mentions[1]).toEqual({
        username: 'bob',
        startIndex: 15,
        endIndex: 19
      })
    })

    it('should handle usernames with numbers and underscores', () => {
      const content = 'Mentioning @user_123 and @test_user_456'
      const mentions = extractMentions(content)
      
      expect(mentions).toHaveLength(2)
      expect(mentions[0].username).toBe('user_123')
      expect(mentions[1].username).toBe('test_user_456')
    })

    it('should return empty array for content without mentions', () => {
      const content = 'This is just regular text without any mentions'
      const mentions = extractMentions(content)
      
      expect(mentions).toHaveLength(0)
    })

    it('should return empty array for empty content', () => {
      const mentions = extractMentions('')
      expect(mentions).toHaveLength(0)
    })

    it('should handle mentions at start and end of content', () => {
      const content = '@start middle @end'
      const mentions = extractMentions(content)
      
      expect(mentions).toHaveLength(2)
      expect(mentions[0].username).toBe('start')
      expect(mentions[1].username).toBe('end')
    })

    it('should handle duplicate mentions', () => {
      const content = '@john said hi to @john again'
      const mentions = extractMentions(content)
      
      expect(mentions).toHaveLength(2)
      expect(mentions[0].username).toBe('john')
      expect(mentions[1].username).toBe('john')
    })
  })

  describe('hasMentions', () => {
    it('should return true for content with mentions', () => {
      expect(hasMentions('Hello @john')).toBe(true)
      expect(hasMentions('@alice and @bob')).toBe(true)
    })

    it('should return false for content without mentions', () => {
      expect(hasMentions('Hello world')).toBe(false)
      expect(hasMentions('No mentions here')).toBe(false)
    })

    it('should return false for empty content', () => {
      expect(hasMentions('')).toBe(false)
    })

    it('should handle text without mentions', () => {
      expect(hasMentions('Email me at test dot example dot com')).toBe(false)
      expect(hasMentions('Price is $50')).toBe(false)
      expect(hasMentions('Contact us via email')).toBe(false)
      expect(hasMentions('No mentions in this text')).toBe(false)
    })
  })

  describe('splitContentWithMentions', () => {
    it('should split content with single mention', () => {
      const content = 'Hello @john, how are you?'
      const parts = splitContentWithMentions(content)
      
      expect(parts).toHaveLength(3)
      expect(parts[0]).toEqual({ text: 'Hello ', isMention: false })
      expect(parts[1]).toEqual({ text: '@john', isMention: true, username: 'john' })
      expect(parts[2]).toEqual({ text: ', how are you?', isMention: false })
    })

    it('should split content with multiple mentions', () => {
      const content = 'Hey @alice and @bob here'
      const parts = splitContentWithMentions(content)
      
      expect(parts).toHaveLength(5)
      expect(parts[0]).toEqual({ text: 'Hey ', isMention: false })
      expect(parts[1]).toEqual({ text: '@alice', isMention: true, username: 'alice' })
      expect(parts[2]).toEqual({ text: ' and ', isMention: false })
      expect(parts[3]).toEqual({ text: '@bob', isMention: true, username: 'bob' })
      expect(parts[4]).toEqual({ text: ' here', isMention: false })
    })

    it('should handle content starting with mention', () => {
      const content = '@john hello there'
      const parts = splitContentWithMentions(content)
      
      expect(parts).toHaveLength(2)
      expect(parts[0]).toEqual({ text: '@john', isMention: true, username: 'john' })
      expect(parts[1]).toEqual({ text: ' hello there', isMention: false })
    })

    it('should handle content ending with mention', () => {
      const content = 'Hello @john'
      const parts = splitContentWithMentions(content)
      
      expect(parts).toHaveLength(2)
      expect(parts[0]).toEqual({ text: 'Hello ', isMention: false })
      expect(parts[1]).toEqual({ text: '@john', isMention: true, username: 'john' })
    })

    it('should return single part for content without mentions', () => {
      const content = 'No mentions here'
      const parts = splitContentWithMentions(content)
      
      expect(parts).toHaveLength(1)
      expect(parts[0]).toEqual({ text: 'No mentions here', isMention: false })
    })

    it('should handle consecutive mentions', () => {
      const content = '@alice@bob hello'
      const parts = splitContentWithMentions(content)
      
      expect(parts).toHaveLength(3)
      expect(parts[0]).toEqual({ text: '@alice', isMention: true, username: 'alice' })
      expect(parts[1]).toEqual({ text: '@bob', isMention: true, username: 'bob' })
      expect(parts[2]).toEqual({ text: ' hello', isMention: false })
    })
  })

  describe('isValidUsername', () => {
    it('should validate correct usernames', () => {
      expect(isValidUsername('john')).toBe(true)
      expect(isValidUsername('user123')).toBe(true)
      expect(isValidUsername('test_user')).toBe(true)
      expect(isValidUsername('a')).toBe(true)
    })

    it('should reject invalid usernames', () => {
      expect(isValidUsername('')).toBe(false)
      expect(isValidUsername('user name')).toBe(false) // spaces not allowed
      expect(isValidUsername('user@name')).toBe(false) // @ not allowed
      expect(isValidUsername('user#name')).toBe(false) // # not allowed
      expect(isValidUsername('user$name')).toBe(false) // $ not allowed
    })

    it('should reject usernames that are too long', () => {
      const longUsername = 'a'.repeat(51) // 51 characters
      expect(isValidUsername(longUsername)).toBe(false)
    })
  })

  describe('getUniqueUsernames', () => {
    it('should return unique usernames from content', () => {
      const content = '@john @alice @john @bob @alice'
      const usernames = getUniqueUsernames(content)
      
      expect(usernames).toHaveLength(3)
      expect(usernames).toContain('john')
      expect(usernames).toContain('alice')
      expect(usernames).toContain('bob')
    })

    it('should return empty array for content without mentions', () => {
      const content = 'No mentions here'
      const usernames = getUniqueUsernames(content)
      
      expect(usernames).toHaveLength(0)
    })

    it('should preserve order of first occurrence', () => {
      const content = '@charlie @alice @bob @alice'
      const usernames = getUniqueUsernames(content)
      
      expect(usernames).toEqual(['charlie', 'alice', 'bob'])
    })
  })

  describe('MENTION_REGEX', () => {
    it('should match valid mention patterns', () => {
      const testCases = [
        '@john',
        '@user123',
        '@test_user',
        '@a',
        '@USER',
        '@User_123'
      ]
      
      testCases.forEach(testCase => {
        MENTION_REGEX.lastIndex = 0 // Reset regex state
        expect(MENTION_REGEX.test(testCase)).toBe(true)
      })
    })

    it('should not match invalid patterns', () => {
      const testCases = [
        'john', // no @
        '@', // @ only
        'no mentions here', // no @ at all
        'just text' // no @ at all
      ]
      
      testCases.forEach(testCase => {
        MENTION_REGEX.lastIndex = 0 // Reset regex state
        expect(MENTION_REGEX.test(testCase)).toBe(false)
      })
    })

    it('should match mentions even in complex text', () => {
      // Note: Our regex will match @domain in emails, but that's okay for our use case
      // We can filter these out at a higher level if needed
      const testCases = [
        '@user-name', // will match @user part
        '@user.name', // will match @user part  
        'email@domain.com', // will match @domain part
        'contact@company.com' // will match @company part
      ]
      
      testCases.forEach(testCase => {
        MENTION_REGEX.lastIndex = 0 // Reset regex state
        expect(MENTION_REGEX.test(testCase)).toBe(true)
      })
    })
  })
})