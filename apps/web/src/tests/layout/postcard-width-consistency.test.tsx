import fs from 'fs'
import path from 'path'

const pagesDir = path.join(process.cwd(), 'src/app')

describe('Postcard Width Consistency', () => {
  it('should verify feed page has max-w-2xl', () => {
    const feedPageContent = fs.readFileSync(path.join(pagesDir, 'feed/page.tsx'), 'utf-8')
    expect(feedPageContent).toContain('max-w-2xl')
    expect(feedPageContent).not.toContain('max-w-4xl mx-auto')
  })

  it('should verify profile page has max-w-2xl', () => {
    const profilePageContent = fs.readFileSync(path.join(pagesDir, 'profile/page.tsx'), 'utf-8')
    expect(profilePageContent).toContain('max-w-2xl')
    expect(profilePageContent).not.toContain('max-w-4xl mx-auto')
  })

  it('should verify user profile page has max-w-2xl', () => {
    const userProfilePageContent = fs.readFileSync(path.join(pagesDir, 'profile/[userId]/page.tsx'), 'utf-8')
    expect(userProfilePageContent).toContain('max-w-2xl')
    expect(userProfilePageContent).not.toContain('max-w-4xl mx-auto')
  })

  it('should verify post detail page uses max-w-2xl', () => {
    // Post detail page uses PostPageClient which contains the max-w classes
    const postPageContent = fs.readFileSync(path.join(pagesDir, 'post/[id]/PostPageClient.tsx'), 'utf-8')
    expect(postPageContent).toContain('max-w-2xl')
    expect(postPageContent).not.toContain('max-w-4xl')
  })

  it('should have consistent container padding and max-width', () => {
    const feedPageContent = fs.readFileSync(path.join(pagesDir, 'feed/page.tsx'), 'utf-8')
    
    // Check that the container has consistent padding
    const hasContainer = feedPageContent.includes('container')
    expect(hasContainer).toBe(true)
    
    // Check that max-w is present and is max-w-2xl
    expect(feedPageContent).toContain('max-w-2xl')
    expect(feedPageContent).toContain('mx-auto')
  })
})