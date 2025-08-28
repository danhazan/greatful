import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, jest } from '@jest/globals'
import MentionHighlighter from '@/components/MentionHighlighter'

describe('MentionHighlighter', () => {
  it('should render plain text without mentions', () => {
    render(
      <MentionHighlighter content="This is plain text without mentions" />
    )
    
    expect(screen.getByText('This is plain text without mentions')).toBeInTheDocument()
  })

  it('should render empty content', () => {
    const { container } = render(
      <MentionHighlighter content="" />
    )
    
    expect(container.firstChild).toBeInTheDocument()
    expect(container.firstChild?.textContent).toBe('')
  })

  it('should highlight single mention', () => {
    render(
      <MentionHighlighter content="Hello @john, how are you?" validUsernames={['john']} />
    )
    
    expect(screen.getByText((content, element) => {
      return element?.textContent === 'Hello ' && element.tagName.toLowerCase() === 'span'
    })).toBeInTheDocument()
    expect(screen.getByText('@john')).toBeInTheDocument()
    expect(screen.getByText((content, element) => {
      return element?.textContent === ', how are you?' && element.tagName.toLowerCase() === 'span'
    })).toBeInTheDocument()
    
    const mentionElement = screen.getByText('@john')
    expect(mentionElement).toHaveClass('mention', 'text-purple-600', 'font-medium')
  })

  it('should highlight multiple mentions', () => {
    render(
      <MentionHighlighter content="Hey @alice and @bob, check this out!" validUsernames={['alice', 'bob']} />
    )
    
    expect(screen.getByText((content, element) => {
      return element?.textContent === 'Hey ' && element.tagName.toLowerCase() === 'span'
    })).toBeInTheDocument()
    expect(screen.getByText('@alice')).toBeInTheDocument()
    expect(screen.getByText((content, element) => {
      return element?.textContent === ' and ' && element.tagName.toLowerCase() === 'span'
    })).toBeInTheDocument()
    expect(screen.getByText('@bob')).toBeInTheDocument()
    expect(screen.getByText((content, element) => {
      return element?.textContent === ', check this out!' && element.tagName.toLowerCase() === 'span'
    })).toBeInTheDocument()
    
    const aliceMention = screen.getByText('@alice')
    const bobMention = screen.getByText('@bob')
    
    expect(aliceMention).toHaveClass('mention', 'text-purple-600', 'font-medium')
    expect(bobMention).toHaveClass('mention', 'text-purple-600', 'font-medium')
  })

  it('should handle content starting with mention', () => {
    render(
      <MentionHighlighter content="@john hello there" validUsernames={['john']} />
    )
    
    expect(screen.getByText('@john')).toBeInTheDocument()
    expect(screen.getByText((content, element) => {
      return element?.textContent === ' hello there' && element.tagName.toLowerCase() === 'span'
    })).toBeInTheDocument()
    
    const mentionElement = screen.getByText('@john')
    expect(mentionElement).toHaveClass('mention')
  })

  it('should handle content ending with mention', () => {
    render(
      <MentionHighlighter content="Hello @john" validUsernames={['john']} />
    )
    
    expect(screen.getByText((content, element) => {
      return element?.textContent === 'Hello ' && element.tagName.toLowerCase() === 'span'
    })).toBeInTheDocument()
    expect(screen.getByText('@john')).toBeInTheDocument()
    
    const mentionElement = screen.getByText('@john')
    expect(mentionElement).toHaveClass('mention')
  })

  it('should call onMentionClick when mention is clicked', () => {
    const mockOnMentionClick = jest.fn()
    
    render(
      <MentionHighlighter 
        content="Hello @john" 
        onMentionClick={mockOnMentionClick}
        validUsernames={['john']}
      />
    )
    
    const mentionElement = screen.getByText('@john')
    fireEvent.click(mentionElement)
    
    expect(mockOnMentionClick).toHaveBeenCalledWith('john')
  })

  it('should call onMentionClick with correct username for multiple mentions', () => {
    const mockOnMentionClick = jest.fn()
    
    render(
      <MentionHighlighter 
        content="Hey @alice and @bob" 
        onMentionClick={mockOnMentionClick}
        validUsernames={['alice', 'bob']}
      />
    )
    
    const aliceMention = screen.getByText('@alice')
    const bobMention = screen.getByText('@bob')
    
    fireEvent.click(aliceMention)
    expect(mockOnMentionClick).toHaveBeenCalledWith('alice')
    
    fireEvent.click(bobMention)
    expect(mockOnMentionClick).toHaveBeenCalledWith('bob')
    
    expect(mockOnMentionClick).toHaveBeenCalledTimes(2)
  })

  it('should prevent event propagation when mention is clicked', () => {
    const mockOnMentionClick = jest.fn()
    const mockParentClick = jest.fn()
    
    render(
      <div onClick={mockParentClick}>
        <MentionHighlighter 
          content="Hello @john" 
          onMentionClick={mockOnMentionClick}
          validUsernames={['john']}
        />
      </div>
    )
    
    const mentionElement = screen.getByText('@john')
    fireEvent.click(mentionElement)
    
    expect(mockOnMentionClick).toHaveBeenCalledWith('john')
    expect(mockParentClick).not.toHaveBeenCalled()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <MentionHighlighter 
        content="Hello @john" 
        className="custom-class text-lg"
      />
    )
    
    const spanElement = container.firstChild as HTMLElement
    expect(spanElement).toHaveClass('custom-class', 'text-lg')
  })

  it('should handle usernames with numbers and underscores', () => {
    render(
      <MentionHighlighter content="Hello @user_123 and @test456" validUsernames={['user_123', 'test456']} />
    )
    
    expect(screen.getByText('@user_123')).toBeInTheDocument()
    expect(screen.getByText('@test456')).toBeInTheDocument()
    
    const mention1 = screen.getByText('@user_123')
    const mention2 = screen.getByText('@test456')
    
    expect(mention1).toHaveClass('mention')
    expect(mention2).toHaveClass('mention')
  })

  it('should handle consecutive mentions', () => {
    render(
      <MentionHighlighter content="@alice@bob hello" />
    )
    
    expect(screen.getByText('@alice')).toBeInTheDocument()
    expect(screen.getByText('@bob')).toBeInTheDocument()
    expect(screen.getByText((content, element) => {
      return element?.textContent === ' hello' && element.tagName.toLowerCase() === 'span'
    })).toBeInTheDocument()
  })

  it('should have proper accessibility attributes', () => {
    render(
      <MentionHighlighter content="Hello @john" validUsernames={['john']} />
    )
    
    const mentionElement = screen.getByText('@john')
    expect(mentionElement).toHaveAttribute('title', "View @john's profile")
  })

  it('should have hover styles', () => {
    render(
      <MentionHighlighter content="Hello @john" validUsernames={['john']} />
    )
    
    const mentionElement = screen.getByText('@john')
    expect(mentionElement).toHaveClass('hover:text-purple-700', 'hover:underline', 'cursor-pointer')
  })

  it('should not call onMentionClick when not provided', () => {
    // This test ensures no errors occur when onMentionClick is not provided
    render(
      <MentionHighlighter content="Hello @john" validUsernames={['john']} />
    )
    
    const mentionElement = screen.getByText('@john')
    
    // Should not throw error when clicked
    expect(() => {
      fireEvent.click(mentionElement)
    }).not.toThrow()
  })

  // New tests for validation behavior
  it('should not highlight mentions when validUsernames is not provided', () => {
    render(<MentionHighlighter content="Hello @john and @jane" />)
    
    const johnMention = screen.getByText('@john')
    const janeMention = screen.getByText('@jane')
    
    expect(johnMention).not.toHaveClass('mention')
    expect(johnMention).not.toHaveClass('text-purple-600')
    expect(janeMention).not.toHaveClass('mention')
    expect(janeMention).not.toHaveClass('text-purple-600')
  })

  it('should only highlight mentions that are in validUsernames', () => {
    render(
      <MentionHighlighter 
        content="Hello @john and @jane" 
        validUsernames={['john']} // Only john is valid
      />
    )
    
    const johnMention = screen.getByText('@john')
    const janeMention = screen.getByText('@jane')
    
    expect(johnMention).toHaveClass('mention', 'text-purple-600')
    expect(janeMention).not.toHaveClass('mention')
    expect(janeMention).not.toHaveClass('text-purple-600')
  })

  it('should not highlight any mentions when validUsernames is empty', () => {
    render(
      <MentionHighlighter 
        content="Hello @john and @jane" 
        validUsernames={[]} // Empty array
      />
    )
    
    const johnMention = screen.getByText('@john')
    const janeMention = screen.getByText('@jane')
    
    expect(johnMention).not.toHaveClass('mention')
    expect(janeMention).not.toHaveClass('mention')
  })

  it('should not call onMentionClick for non-validated mentions', () => {
    const mockOnMentionClick = jest.fn()
    
    render(
      <MentionHighlighter 
        content="Hello @john and @jane" 
        validUsernames={['john']} // Only john is valid
        onMentionClick={mockOnMentionClick}
      />
    )
    
    const johnMention = screen.getByText('@john')
    const janeMention = screen.getByText('@jane')
    
    // Click on valid mention - should call handler
    fireEvent.click(johnMention)
    expect(mockOnMentionClick).toHaveBeenCalledWith('john')
    
    // Click on invalid mention - should not call handler
    mockOnMentionClick.mockClear()
    fireEvent.click(janeMention)
    expect(mockOnMentionClick).not.toHaveBeenCalled()
  })
})