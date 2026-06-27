import React from 'react'
import { render, screen, fireEvent } from '@/tests/utils/testUtils'
import { describe, it, expect, jest } from '@jest/globals'
import TypeFilterModal from '../TypeFilterModal'
import { DEFAULT_TYPE_FILTERS } from '@/utils/feedFilterState'

const baseProps = {
  type: { ...DEFAULT_TYPE_FILTERS },
  onChange: jest.fn(),
  onClose: jest.fn(),
  onDismiss: jest.fn(),
  onClear: jest.fn(),
  onApply: jest.fn(),
  isApplyDisabled: true,
  position: { x: 100, y: 200 },
}

const activeProps = {
  ...baseProps,
  type: { mine: 'required' as const, followed: 'off' as const, followers: 'off' as const, public: 'off' as const, images: 'off' as const },
}

describe('TypeFilterModal', () => {
  it('renders title', () => {
    render(<TypeFilterModal {...baseProps} />)
    expect(screen.getByText('Posts type')).toBeInTheDocument()
  })

  it('header has title left, Clear/Cancel right', () => {
    render(<TypeFilterModal {...baseProps} />)
    const header = screen.getByText('Posts type').closest('.flex')
    expect(header?.className).toContain('justify-between')
    expect(screen.getByText('Clear')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('header has a ghost Apply button to the right of Cancel', () => {
    render(<TypeFilterModal {...baseProps} />)
    const header = screen.getByText('Posts type').closest('.flex')
    const headerButtons = Array.from(header?.querySelectorAll('button') || [])
    const applyIndex = headerButtons.findIndex(b => b.textContent === 'Apply')
    expect(applyIndex).toBeGreaterThanOrEqual(0)
    const apply = headerButtons[applyIndex]
    expect(apply.className).toContain('bg-transparent')
    expect(apply.className).toContain('font-bold')
    expect(apply.className).toContain('text-purple-600')
    if (applyIndex > 0) {
      expect(headerButtons[applyIndex - 1].textContent).toBe('Cancel')
    }
  })

  it('footer has a filled Apply button', () => {
    render(<TypeFilterModal {...baseProps} />)
    const applies = screen.getAllByText('Apply')
    expect(applies).toHaveLength(2)
    const footerApplies = applies.filter(a => a.closest('.border-t'))
    expect(footerApplies).toHaveLength(1)
    expect(footerApplies[0].className).toContain('bg-purple-600')
  })

  it('renders with correct position style', () => {
    render(<TypeFilterModal {...baseProps} />)
    const root = document.querySelector('.fixed.z-50') as HTMLElement
    expect(root).not.toBeNull()
    expect(root.style.left).toBe('100px')
    expect(root.style.top).toBe('200px')
  })

  it('has responsive width class', () => {
    const { container } = render(<TypeFilterModal {...baseProps} />)
    const card = container.querySelector('.rounded-xl')
    expect(card?.className).toContain('w-[calc(100vw-1.5rem)]')
    expect(card?.className).toContain('sm:max-w-sm')
  })

  it('renders all 5 type filters split across two groups', () => {
    render(<TypeFilterModal {...baseProps} />)
    expect(screen.getByText('Match ANY of')).toBeInTheDocument()
    expect(screen.getByText('Always require')).toBeInTheDocument()
    const items = document.querySelectorAll('.rounded-lg.border.border-gray-200')
    expect(items.length).toBe(5)
  })

  it('Clear is disabled when all filters are off', () => {
    render(<TypeFilterModal {...baseProps} />)
    const clear = screen.getByText('Clear')
    expect(clear.className).toContain('text-gray-400')
    expect(clear).toBeDisabled()
  })

  it('Clear has purple tint when any filter is active', () => {
    render(<TypeFilterModal {...activeProps} />)
    const clear = screen.getByText('Clear')
    expect(clear.className).toContain('text-purple-600')
    expect(clear).not.toBeDisabled()
  })

  it('Cancel button has red styling', () => {
    render(<TypeFilterModal {...baseProps} />)
    const cancel = screen.getByText('Cancel')
    expect(cancel.className).toContain('text-red-600')
  })
})
