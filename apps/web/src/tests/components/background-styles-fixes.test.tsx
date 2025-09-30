import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, jest } from '@jest/globals'
import RichTextEditor from '@/components/RichTextEditor'
import { POST_STYLES } from '@/components/PostStyleSelector'
import { ToastProvider } from '@/contexts/ToastContext'

// Mock the router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn()
  })
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    {children}
  </ToastProvider>
)

describe('Background Styles Fixes', () => {
  it('applies background styles immediately during creation (not just editing)', () => {
    const warmSunsetStyle = POST_STYLES.find(style => style.id === 'warm-sunset')!
    
    render(
      <TestWrapper>
        <RichTextEditor
          value=""
          selectedStyle={warmSunsetStyle}
          onChange={() => {}}
        />
      </TestWrapper>
    )

    // Find the editor wrapper element (where background styles are applied)
    const editorWrapper = document.querySelector('.editor-wrapper')
    expect(editorWrapper).toBeInTheDocument()

    // Check that background styles are applied immediately (not just on edit)
    const computedStyle = window.getComputedStyle(editorWrapper!)
    expect(computedStyle.backgroundColor).toBe('rgb(254, 243, 199)') // #FEF3C7
    // Note: In test environment, gradient may be simplified to backgroundColor
  })

  it('uses smart text color logic - only white for dark backgrounds', () => {
    // Test light background - should use default dark text
    const lightStyle = POST_STYLES.find(style => style.id === 'warm-sunset')!
    
    const { rerender } = render(
      <TestWrapper>
        <RichTextEditor
          value=""
          selectedStyle={lightStyle}
          onChange={() => {}}
        />
      </TestWrapper>
    )

    let editorWrapper = document.querySelector('.editor-wrapper')
    let computedStyle = window.getComputedStyle(editorWrapper!)
    
    // Light background should use dark text
    expect(computedStyle.color).toBe('rgb(55, 65, 81)') // #374151 - default dark text

    // Test dark background - should use white text
    const darkStyle = POST_STYLES.find(style => style.id === 'elegant-dark')!
    
    rerender(
      <TestWrapper>
        <RichTextEditor
          value=""
          selectedStyle={darkStyle}
          onChange={() => {}}
        />
      </TestWrapper>
    )

    editorWrapper = document.querySelector('.editor-wrapper')
    computedStyle = window.getComputedStyle(editorWrapper!)
    
    // Dark background should use light text (elegant-dark uses #F9FAFB)
    expect(computedStyle.color).toBe('rgb(249, 250, 251)') // #F9FAFB - light text for dark background
  })

  it('applies styles consistently across all bright color backgrounds', () => {
    const brightStyles = [
      'warm-sunset',
      'peaceful-purple', 
      'nature-green',
      'ocean-blue',
      'rose-gold',
      'gratitude-gold'
    ]

    brightStyles.forEach(styleId => {
      const style = POST_STYLES.find(s => s.id === styleId)!
      
      const { unmount } = render(
        <TestWrapper>
          <RichTextEditor
            value=""
            selectedStyle={style}
            onChange={() => {}}
          />
        </TestWrapper>
      )

      const editorWrapper = document.querySelector('.editor-wrapper')
      const computedStyle = window.getComputedStyle(editorWrapper!)
      
      // All bright backgrounds should use dark text for readability
      expect(computedStyle.color).toBe('rgb(55, 65, 81)') // #374151
      
      unmount()
    })
  })

  it('maintains caret visibility with computed text color', () => {
    const warmSunsetStyle = POST_STYLES.find(style => style.id === 'warm-sunset')!
    
    render(
      <TestWrapper>
        <RichTextEditor
          value=""
          selectedStyle={warmSunsetStyle}
          onChange={() => {}}
        />
      </TestWrapper>
    )

    const editorWrapper = document.querySelector('.editor-wrapper')
    const computedStyle = window.getComputedStyle(editorWrapper!)
    
    // The wrapper should have the computed text color
    expect(computedStyle.color).toBe('rgb(55, 65, 81)') // Computed text color for light background
  })

  it('handles gradient backgrounds correctly for text color computation', () => {
    const gradientStyle = POST_STYLES.find(style => style.id === 'nature-green')!
    
    render(
      <TestWrapper>
        <RichTextEditor
          value=""
          selectedStyle={gradientStyle}
          onChange={() => {}}
        />
      </TestWrapper>
    )

    const editorWrapper = document.querySelector('.editor-wrapper')
    const computedStyle = window.getComputedStyle(editorWrapper!)
    
    // Should extract primary color from gradient and use appropriate text color
    // Note: In test environment, gradient may be simplified to backgroundColor
    expect(computedStyle.backgroundColor).toBe('rgb(236, 253, 245)') // #ECFDF5
    expect(computedStyle.color).toBe('rgb(55, 65, 81)') // Dark text for light gradient
  })
})