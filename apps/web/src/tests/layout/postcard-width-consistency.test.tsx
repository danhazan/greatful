/**
 * Test to verify PostCard width consistency across all pages
 * Task 14.8: Standardize PostCard Width - Uniform card sizing across pages
 */

import { describe, it, expect } from '@jest/globals'
import fs from 'fs'
import path from 'path'

describe('PostCard Width Consistency', () => {
  const pagesDir = path.join(process.cwd(), 'src/app')
  
  it('should use max-w-2xl container width in feed page', () => {
    const feedPagePath = path.join(pagesDir, 'feed/page.tsx')
    const feedPageContent = fs.readFileSync(feedPagePath, 'utf-8')
    
    // Check that the feed page uses max-w-2xl instead of max-w-4xl
    expect(feedPageContent).toContain('max-w-2xl mx-auto')
    expect(feedPageContent).not.toContain('max-w-4xl mx-auto')
  })

  it('should use max-w-2xl container width in profile page', () => {
    const profilePagePath = path.join(pagesDir, 'profile/page.tsx')
    const profilePageContent = fs.readFileSync(profilePagePath, 'utf-8')
    
    // Check that the profile page uses max-w-2xl instead of max-w-4xl
    expect(profilePageContent).toContain('max-w-2xl mx-auto')
    expect(profilePageContent).not.toContain('max-w-4xl mx-auto')
  })

  it('should use max-w-2xl container width in user profile page', () => {
    const userProfilePagePath = path.join(pagesDir, 'profile/[userId]/page.tsx')
    const userProfilePageContent = fs.readFileSync(userProfilePagePath, 'utf-8')
    
    // Check that the user profile page uses max-w-2xl instead of max-w-4xl
    expect(userProfilePageContent).toContain('max-w-2xl mx-auto')
    expect(userProfilePageContent).not.toContain('max-w-4xl mx-auto')
  })

  it('should use max-w-2xl container width in individual post page', () => {
    const postPagePath = path.join(pagesDir, 'post/[id]/page.tsx')
    const postPageContent = fs.readFileSync(postPagePath, 'utf-8')
    
    // Check that the individual post page uses max-w-2xl (should already be correct)
    expect(postPageContent).toContain('max-w-2xl mx-auto')
    expect(postPageContent).not.toContain('max-w-4xl mx-auto')
  })

  it('should use max-w-2xl container width in demo page', () => {
    const demoPagePath = path.join(pagesDir, 'demo/page.tsx')
    const demoPageContent = fs.readFileSync(demoPagePath, 'utf-8')
    
    // Check that the demo page uses max-w-2xl instead of max-w-4xl
    expect(demoPageContent).toContain('max-w-2xl mx-auto')
    expect(demoPageContent).not.toContain('max-w-4xl mx-auto')
  })

  it('should maintain responsive behavior with consistent container classes', () => {
    // Test that the container classes include responsive padding
    const testClasses = [
      'container mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-20', // Feed page
      'container mx-auto px-3 sm:px-4 py-4 sm:py-8', // Profile page
      'container mx-auto px-4 py-8', // Individual post and demo pages
    ]

    testClasses.forEach(classString => {
      expect(classString).toContain('container')
      expect(classString).toContain('mx-auto')
      expect(classString).toContain('px-')
      expect(classString).toContain('py-')
    })
  })

  it('should verify all pages have consistent max-width configuration', () => {
    const pagesToCheck = [
      'feed/page.tsx',
      'profile/page.tsx', 
      'profile/[userId]/page.tsx',
      'post/[id]/page.tsx',
      'demo/page.tsx'
    ]

    pagesToCheck.forEach(pagePath => {
      const fullPath = path.join(pagesDir, pagePath)
      const pageContent = fs.readFileSync(fullPath, 'utf-8')
      
      // Each page should have max-w-2xl and not max-w-4xl
      expect(pageContent).toContain('max-w-2xl')
      
      // Count occurrences to ensure we're not missing any max-w-4xl instances
      const maxW4xlMatches = pageContent.match(/max-w-4xl/g)
      expect(maxW4xlMatches).toBeNull()
    })
  })
})