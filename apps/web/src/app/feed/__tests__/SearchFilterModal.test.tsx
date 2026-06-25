import React from 'react'
import { render, screen, fireEvent } from '@/tests/utils/testUtils'
import { describe, it, expect, jest } from '@jest/globals'
import SearchFilterModal from '../SearchFilterModal'
import { createEmptyFeedFilters } from '@/utils/feedFilterState'

const baseProps = {
  search: createEmptyFeedFilters().search,
  onChange: jest.fn(),
  onClose: jest.fn(),
  onDismiss: jest.fn(),
  onClear: jest.fn(),
  onApply: jest.fn(),
  isApplyDisabled: true,
  position: { x: 100, y: 200 },
  authorProfiles: {},
}

describe('SearchFilterModal', () => {
  it('renders title', () => {
    render(<SearchFilterModal {...baseProps} />)
    expect(screen.getByText('Search Filter')).toBeInTheDocument()
  })

  it('header has title left, Clear/Cancel right', () => {
    render(<SearchFilterModal {...baseProps} />)
    const header = screen.getByText('Search Filter').closest('.flex')
    expect(header?.className).toContain('justify-between')
    expect(screen.getByText('Clear')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('header has a ghost Apply button to the right of Cancel', () => {
    render(<SearchFilterModal {...baseProps} />)
    const header = screen.getByText('Search Filter').closest('.flex')
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
    render(<SearchFilterModal {...baseProps} />)
    const applies = screen.getAllByText('Apply')
    expect(applies).toHaveLength(2)
    const footerApplies = applies.filter(a => a.closest('.border-t'))
    expect(footerApplies).toHaveLength(1)
    expect(footerApplies[0].className).toContain('bg-purple-600')
  })

  it('renders with correct position style', () => {
    render(<SearchFilterModal {...baseProps} />)
    const root = document.querySelector('.fixed.z-50') as HTMLElement
    expect(root).not.toBeNull()
    expect(root.style.left).toBe('100px')
    expect(root.style.top).toBe('200px')
  })

  it('has responsive width class', () => {
    const { container } = render(<SearchFilterModal {...baseProps} />)
    const card = container.querySelector('.rounded-xl')
    expect(card?.className).toContain('w-[calc(100vw-1.5rem)]')
    expect(card?.className).toContain('sm:max-w-sm')
  })

  it('Clear is disabled when keyword and authors are all off/empty', () => {
    render(<SearchFilterModal {...baseProps} />)
    const clear = screen.getByText('Clear')
    expect(clear.className).toContain('text-gray-400')
    expect(clear).toBeDisabled()
  })

  it('Cancel button has red styling', () => {
    render(<SearchFilterModal {...baseProps} />)
    const cancel = screen.getByText('Cancel')
    expect(cancel.className).toContain('text-red-600')
  })

  it('keyword input change calls onChange immediately', () => {
    const onChange = jest.fn()
    render(<SearchFilterModal {...baseProps} onChange={onChange} />)
    const input = screen.getByPlaceholderText('Search posts...')
    fireEvent.change(input, { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        keyword: expect.objectContaining({ text: 'hello' }),
      })
    )
  })

  it('keyword mode change calls onChange immediately', () => {
    const onChange = jest.fn()
    render(<SearchFilterModal {...baseProps} onChange={onChange} />)
    const mostlyButtons = screen.getAllByText('Mostly')
    fireEvent.click(mostlyButtons[0])
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        keyword: expect.objectContaining({ mode: 'boost' }),
      })
    )
  })

  it('Apply calls onApply and does NOT call onChange', () => {
    const onChange = jest.fn()
    const onApply = jest.fn()
    render(<SearchFilterModal {...baseProps} onChange={onChange} onApply={onApply} isApplyDisabled={false} />)
    const headerApply = screen.getAllByText('Apply')[0]
    fireEvent.click(headerApply)
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('displayName falls back to authorProfiles when username is null', () => {
    const search = {
      authors: { mode: 'required' as const, users: [{ id: 1, username: null as string | null, name: null as string | null }] },
      keyword: { mode: 'off' as const, text: '' },
    }
    const profiles = { 1: { username: 'hydrated_name', name: 'Hydrated Name' } }
    render(<SearchFilterModal {...baseProps} search={search} authorProfiles={profiles} />)
    expect(screen.getByText('hydrated_name')).toBeInTheDocument()
  })
})
