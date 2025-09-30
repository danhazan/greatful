import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from '@jest/globals'
import RichTextEditor from '@/components/RichTextEditor'
import { POST_STYLES } from '@/components/PostStyleSelector'

// Mock the MinimalEmojiPicker component
jest.mock('@/components/MinimalEmojiPicker', () => {
  return function MockMinimalEmojiPicker() {
    return <div data-testid="emoji-picker">Emoji Picker</div>
  }
})

describe('RichTextEditor Background Styles', () => {
  it('applies default background style correctly', () => {
    const defaultStyle = POST_STYLES[0] // Default style
    
    render(
      <RichTextEditor
        selectedStyle={defaultStyle}
        placeholder="Test placeholder"
      />
    )

    const editorWrapper = document.querySelector('.editor-wrapper')
    const computedStyle = window.getComputedStyle(editorWrapper!)
    
    // Check that default styles are applied
    expect(computedStyle.backgroundColor).toBe('rgb(255, 255, 255)') // #ffffff
    expect(computedStyle.color).toBe('rgb(55, 65, 81)') // #374151
  })

  it('applies warm sunset background style correctly', () => {
    const warmSunsetStyle = POST_STYLES.find(style => style.id === 'warm-sunset')!
    
    render(
      <RichTextEditor
        selectedStyle={warmSunsetStyle}
        placeholder="Test placeholder"
      />
    )

    const editorWrapper = document.querySelector('.editor-wrapper')
    const computedStyle = window.getComputedStyle(editorWrapper!)
    
    // Check that warm sunset styles are applied with smart text color
    expect(computedStyle.backgroundColor).toBe('rgb(254, 243, 199)') // #FEF3C7
    expect(computedStyle.color).toBe('rgb(55, 65, 81)') // #374151 - smart text color for light background
  })

  it('applies peaceful purple background style correctly', () => {
    const peacefulPurpleStyle = POST_STYLES.find(style => style.id === 'peaceful-purple')!
    
    render(
      <RichTextEditor
        selectedStyle={peacefulPurpleStyle}
        placeholder="Test placeholder"
      />
    )

    const editorWrapper = document.querySelector('.editor-wrapper')
    const computedStyle = window.getComputedStyle(editorWrapper!)
    
    // Check that peaceful purple styles are applied with smart text color
    expect(computedStyle.backgroundColor).toBe('rgb(243, 232, 255)') // #F3E8FF
    expect(computedStyle.color).toBe('rgb(55, 65, 81)') // #374151 - smart text color for light background
  })

  it('applies elegant dark background style correctly', () => {
    const elegantDarkStyle = POST_STYLES.find(style => style.id === 'elegant-dark')!
    
    render(
      <RichTextEditor
        selectedStyle={elegantDarkStyle}
        placeholder="Test placeholder"
      />
    )

    const editorWrapper = document.querySelector('.editor-wrapper')
    const computedStyle = window.getComputedStyle(editorWrapper!)
    
    // Check that elegant dark styles are applied (keeps explicit light text)
    expect(computedStyle.backgroundColor).toBe('rgb(31, 41, 55)') // #1F2937
    expect(computedStyle.color).toBe('rgb(249, 250, 251)') // #F9FAFB - explicit light text for dark background
  })

  it('applies background gradient when specified', () => {
    const gradientStyle = POST_STYLES.find(style => style.backgroundGradient)!
    
    render(
      <RichTextEditor
        selectedStyle={gradientStyle}
        placeholder="Test placeholder"
      />
    )

    const editorWrapper = document.querySelector('.editor-wrapper')
    const computedStyle = window.getComputedStyle(editorWrapper!)
    
    // Check that gradient background is applied (fallback to backgroundColor if gradient not supported)
    expect(computedStyle.background).toBeTruthy()
  })

  it('applies border style when specified', () => {
    const borderStyle = POST_STYLES.find(style => style.borderStyle)!
    
    render(
      <RichTextEditor
        selectedStyle={borderStyle}
        placeholder="Test placeholder"
      />
    )

    const editorWrapper = document.querySelector('.editor-wrapper')
    const computedStyle = window.getComputedStyle(editorWrapper!)
    
    // Check that border style is applied
    expect(computedStyle.border).toContain('2px solid')
  })

  it('applies font family when specified', () => {
    const styleWithFont = POST_STYLES.find(style => style.fontFamily)
    
    if (styleWithFont) {
      render(
        <RichTextEditor
          selectedStyle={styleWithFont}
          placeholder="Test placeholder"
        />
      )

      const editor = screen.getByRole('textbox')
      const computedStyle = window.getComputedStyle(editor)
      
      // Check that font family is applied to the contenteditable element
      expect(computedStyle.fontFamily).toBe(styleWithFont.fontFamily)
    }
  })

  it('updates caret visibility with wrapper color', () => {
    const coloredStyle = POST_STYLES.find(style => style.textColor !== '#374151')!
    
    render(
      <RichTextEditor
        selectedStyle={coloredStyle}
        placeholder="Test placeholder"
      />
    )

    const editorWrapper = document.querySelector('.editor-wrapper')
    const computedStyle = window.getComputedStyle(editorWrapper!)
    
    // Check that wrapper has the computed text color
    expect(computedStyle.color).toBeTruthy()
  })

  it('handles undefined selectedStyle gracefully', () => {
    render(
      <RichTextEditor
        selectedStyle={undefined as any}
        placeholder="Test placeholder"
      />
    )

    const editorWrapper = document.querySelector('.editor-wrapper')
    const computedStyle = window.getComputedStyle(editorWrapper!)
    
    // Should fall back to default values
    expect(computedStyle.backgroundColor).toBe('transparent')
    expect(computedStyle.color).toBe('rgb(55, 65, 81)') // #374151
  })
})