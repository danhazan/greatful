/**
 * Tests for mention utils with special characters support
 */

import { describe, it, expect } from '@jest/globals'
import { 
  extractMentions, 
  splitContentWithMentions, 
  isValidUsername,
  getUniqueUsernames,
  hasMentions,
  MENTION_REGEX 
} from '@/utils/mentionUtils'

describe('MentionUtils - Special Characters Support', () => {
  describe('MENTION_REGEX', () => {
    it('should match usernames with special characters', () => {
      const testCases = [
        { content: '@Bob7??', expected: ['Bob7??'] },
        { content: '@alice.doe-123', expected: ['alice.doe-123'] },
        { content: '@user+name', expected: ['user+name'] },
        { content: '@test!user', expected: ['test!user'] },
        { content: '@simple_user', expected: ['simple_user'] },
        { content: '@user123', expected: ['user123'] }
      ]

      testCases.forEach(({ content, expected }) => {
        MENTION_REGEX.lastIndex = 0 // Reset regex
        const matches = []
        let match
        while ((match = MENTION_REGEX.exec(content)) !== null) {
          matches.push(match[1])
        }
        expect(matches).toEqual(expected)
      })
    })

    it('should match multiple usernames with mixed special characters', () => {
      const content = 'Thanks @Bob7?? and @alice.doe-123 and @user+name here'
      MENTION_REGEX.lastIndex = 0
      const matches = []
      let match
      while ((match = MENTION_REGEX.exec(content)) !== null) {
        matches.push(match[1])
      }
      expect(matches).toEqual(['Bob7??', 'alice.doe-123', 'user+name'])
    })
  })

  describe('extractMentions', () => {
    it('should extract mentions with special characters', () => {
      const content = 'Hello @Bob7?? and @alice.doe-123 here'
      const mentions = extractMentions(content)
      
      expect(mentions).toHaveLength(2)
      expect(mentions[0].username).toBe('Bob7??')
      expect(mentions[1].username).toBe('alice.doe-123')
    })

    it('should handle usernames with various special characters', () => {
      const content = 'Hey @user+name and @test!user and @simple-user.name'
      const mentions = extractMentions(content)
      
      expect(mentions).toHaveLength(3)
      expect(mentions[0].username).toBe('user+name')
      expect(mentions[1].username).toBe('test!user')
      expect(mentions[2].username).toBe('simple-user.name')
    })
  })

  describe('splitContentWithMentions', () => {
    it('should split content with special character usernames correctly', () => {
      const content = 'Thanks @Bob7?? for help!'
      const parts = splitContentWithMentions(content, ['Bob7??'])
      
      expect(parts).toHaveLength(3)
      expect(parts[0]).toEqual({ text: 'Thanks ', isMention: false })
      expect(parts[1]).toEqual({ 
        text: '@Bob7??', 
        isMention: true, 
        username: 'Bob7??' 
      })
      expect(parts[2]).toEqual({ text: ' for help!', isMention: false })
    })

    it('should handle multiple mentions with special characters', () => {
      const content = 'Hey @alice.doe-123 and @Bob7?? here'
      const parts = splitContentWithMentions(content, ['alice.doe-123', 'Bob7??'])
      
      expect(parts).toHaveLength(5)
      expect(parts[0]).toEqual({ text: 'Hey ', isMention: false })
      expect(parts[1]).toEqual({ 
        text: '@alice.doe-123', 
        isMention: true, 
        username: 'alice.doe-123' 
      })
      expect(parts[2]).toEqual({ text: ' and ', isMention: false })
      expect(parts[3]).toEqual({ 
        text: '@Bob7??', 
        isMention: true, 
        username: 'Bob7??' 
      })
      expect(parts[4]).toEqual({ text: ' here', isMention: false })
    })
  })

  describe('isValidUsername', () => {
    it('should validate usernames with special characters', () => {
      const validUsernames = [
        'Bob7??',
        'alice.doe-123',
        'user+name',
        'test!user',
        'simple_user',
        'user123',
        'test-user.name'
      ]

      validUsernames.forEach(username => {
        expect(isValidUsername(username)).toBe(true)
      })
    })

    it('should reject invalid usernames', () => {
      const invalidUsernames = [
        '', // empty
        'a'.repeat(51), // too long
        'user@name', // @ not allowed
        'user#name', // # not allowed
        'user name', // space not allowed
        'user$name' // $ not allowed
      ]

      invalidUsernames.forEach(username => {
        expect(isValidUsername(username)).toBe(false)
      })
    })
  })

  describe('getUniqueUsernames', () => {
    it('should extract unique usernames with special characters', () => {
      const content = 'Thanks @Bob7?? and @alice.doe-123 and @Bob7?? again!'
      const usernames = getUniqueUsernames(content)
      
      expect(usernames).toHaveLength(2)
      expect(usernames).toContain('Bob7??')
      expect(usernames).toContain('alice.doe-123')
    })
  })

  describe('hasMentions', () => {
    it('should detect mentions with special characters', () => {
      expect(hasMentions('Hello @Bob7??')).toBe(true)
      expect(hasMentions('Hey @alice.doe-123!')).toBe(true)
      expect(hasMentions('Thanks @user+name')).toBe(true)
      expect(hasMentions('No mentions here')).toBe(false)
    })
  })
})