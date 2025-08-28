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
    it('should match usernames with allowed special characters only', () => {
      const testCases = [
        { content: '@alice.doe-123', expected: ['alice.doe-123'] },
        { content: '@simple_user', expected: ['simple_user'] },
        { content: '@user123', expected: ['user123'] },
        { content: '@user-name', expected: ['user-name'] },
        { content: '@user.name', expected: ['user.name'] },
        { content: '@Bob7', expected: ['Bob7'] }
      ]

      testCases.forEach(({ content, expected }) => {
        MENTION_REGEX.lastIndex = 0 // Reset regex
        const matches: string[] = []
        let match: RegExpExecArray | null
        while ((match = MENTION_REGEX.exec(content)) !== null) {
          matches.push(match[1])
        }
        expect(matches).toEqual(expected)
      })
    })

    it('should match only the valid part of usernames with mixed characters', () => {
      const testCases = [
        { content: '@Bob7??', expected: ['Bob7'] },  // matches valid part before ??
        { content: '@user+name', expected: ['user'] },  // matches valid part before +
        { content: '@test!user', expected: ['test'] },  // matches valid part before !
        { content: '@user@name', expected: ['user', 'name'] },  // matches both @user and @name
      ]
      
      testCases.forEach(({ content, expected }) => {
        MENTION_REGEX.lastIndex = 0
        const matches: string[] = []
        let match: RegExpExecArray | null
        while ((match = MENTION_REGEX.exec(content)) !== null) {
          matches.push(match[1])
        }
        expect(matches).toEqual(expected)
      })
    })

    it('should not match usernames that start with invalid characters', () => {
      const testCases = [
        '@?Bob7',  // starts with ?
        '@+user',  // starts with +
        '@!test',  // starts with !
        '@ user',  // starts with space
      ]
      
      testCases.forEach((content) => {
        MENTION_REGEX.lastIndex = 0
        const matches: string[] = []
        let match: RegExpExecArray | null
        while ((match = MENTION_REGEX.exec(content)) !== null) {
          matches.push(match[1])
        }
        // Should match nothing when starting with invalid chars
        expect(matches.length).toBe(0)
      })
    })

    it('should match multiple valid usernames', () => {
      const content = 'Thanks @alice.doe-123 and @user_name and @Bob7 here'
      MENTION_REGEX.lastIndex = 0
      const matches: string[] = []
      let match: RegExpExecArray | null
      while ((match = MENTION_REGEX.exec(content)) !== null) {
        matches.push(match[1])
      }
      expect(matches).toEqual(['alice.doe-123', 'user_name', 'Bob7'])
    })
  })

  describe('extractMentions', () => {
    it('should extract mentions with allowed special characters', () => {
      const content = 'Hello @Bob7 and @alice.doe-123 here'
      const mentions = extractMentions(content)
      
      expect(mentions).toHaveLength(2)
      expect(mentions[0].username).toBe('Bob7')
      expect(mentions[1].username).toBe('alice.doe-123')
    })

    it('should handle usernames with allowed special characters only', () => {
      const content = 'Hey @user_name and @test-user and @simple.user'
      const mentions = extractMentions(content)
      
      expect(mentions).toHaveLength(3)
      expect(mentions[0].username).toBe('user_name')
      expect(mentions[1].username).toBe('test-user')
      expect(mentions[2].username).toBe('simple.user')
    })

    it('should extract valid parts of usernames with mixed characters', () => {
      const content = 'Hey @user+name and @test!user but @valid_user is ok'
      const mentions = extractMentions(content)
      
      // Should extract valid parts and the fully valid username
      expect(mentions).toHaveLength(3)
      expect(mentions[0].username).toBe('user')  // valid part of @user+name
      expect(mentions[1].username).toBe('test')  // valid part of @test!user
      expect(mentions[2].username).toBe('valid_user')  // fully valid
    })
  })

  describe('splitContentWithMentions', () => {
    it('should split content with allowed special character usernames correctly', () => {
      const content = 'Thanks @Bob7 for help!'
      const parts = splitContentWithMentions(content, ['Bob7'])
      
      expect(parts).toHaveLength(3)
      expect(parts[0]).toEqual({ text: 'Thanks ', isMention: false })
      expect(parts[1]).toEqual({ 
        text: '@Bob7', 
        isMention: true, 
        username: 'Bob7' 
      })
      expect(parts[2]).toEqual({ text: ' for help!', isMention: false })
    })

    it('should handle multiple mentions with allowed special characters', () => {
      const content = 'Hey @alice.doe-123 and @Bob7 here'
      const parts = splitContentWithMentions(content, ['alice.doe-123', 'Bob7'])
      
      expect(parts).toHaveLength(5)
      expect(parts[0]).toEqual({ text: 'Hey ', isMention: false })
      expect(parts[1]).toEqual({ 
        text: '@alice.doe-123', 
        isMention: true, 
        username: 'alice.doe-123' 
      })
      expect(parts[2]).toEqual({ text: ' and ', isMention: false })
      expect(parts[3]).toEqual({ 
        text: '@Bob7', 
        isMention: true, 
        username: 'Bob7' 
      })
      expect(parts[4]).toEqual({ text: ' here', isMention: false })
    })

    it('should highlight only the valid part of usernames with mixed characters', () => {
      const content = 'Thanks @Bob7?? for help!'
      const parts = splitContentWithMentions(content, ['Bob7'])
      
      // Should extract @Bob7 and leave ?? as plain text
      expect(parts).toHaveLength(3)
      expect(parts[0]).toEqual({ text: 'Thanks ', isMention: false })
      expect(parts[1]).toEqual({ 
        text: '@Bob7', 
        isMention: true, 
        username: 'Bob7' 
      })
      expect(parts[2]).toEqual({ text: '?? for help!', isMention: false })
    })
  })

  describe('isValidUsername', () => {
    it('should validate usernames with allowed special characters', () => {
      const validUsernames = [
        'Bob7',
        'alice.doe-123',
        'simple_user',
        'user123',
        'test-user.name',
        'user_name',
        'user.name',
        'user-name'
      ]

      validUsernames.forEach(username => {
        expect(isValidUsername(username)).toBe(true)
      })
    })

    it('should reject usernames with disallowed characters', () => {
      const invalidUsernames = [
        '', // empty
        'a'.repeat(51), // too long
        'Bob7??', // question marks not allowed
        'user+name', // plus signs not allowed
        'test!user', // exclamation marks not allowed
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
    it('should extract unique usernames with allowed special characters', () => {
      const content = 'Thanks @Bob7 and @alice.doe-123 and @Bob7 again!'
      const usernames = getUniqueUsernames(content)
      
      expect(usernames).toHaveLength(2)
      expect(usernames).toContain('Bob7')
      expect(usernames).toContain('alice.doe-123')
    })

    it('should extract valid parts of usernames with mixed characters', () => {
      const content = 'Thanks @Bob7?? and @alice.doe-123 and @user+name!'
      const usernames = getUniqueUsernames(content)
      
      // Should extract valid parts and fully valid usernames
      expect(usernames).toHaveLength(3)
      expect(usernames).toContain('Bob7')  // valid part of @Bob7??
      expect(usernames).toContain('alice.doe-123')  // fully valid
      expect(usernames).toContain('user')  // valid part of @user+name
    })
  })

  describe('hasMentions', () => {
    it('should detect mentions with allowed special characters', () => {
      expect(hasMentions('Hello @Bob7')).toBe(true)
      expect(hasMentions('Hey @alice.doe-123!')).toBe(true)
      expect(hasMentions('Thanks @user_name')).toBe(true)
      expect(hasMentions('No mentions here')).toBe(false)
    })

    it('should detect mentions even with mixed valid/invalid characters', () => {
      expect(hasMentions('Hello @Bob7??')).toBe(true)  // detects @Bob7 part
      expect(hasMentions('Thanks @user+name')).toBe(true)  // detects @user part
      expect(hasMentions('Hey @test!user')).toBe(true)  // detects @test part
    })

    it('should NOT detect mentions that start with invalid characters', () => {
      expect(hasMentions('Hello @?Bob7')).toBe(false)
      expect(hasMentions('Thanks @+user')).toBe(false)
      expect(hasMentions('Hey @!test')).toBe(false)
    })
  })
})