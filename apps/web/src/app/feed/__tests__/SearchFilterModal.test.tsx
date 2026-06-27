import React from 'react'
import { render, screen, fireEvent } from '@/tests/utils/testUtils'
import { describe, it, expect, jest } from '@jest/globals'
import SearchFilterModal from '../SearchFilterModal'
import { createEmptyFeedFilters } from '@/utils/feedFilterState'

jest.mock('@/utils/userHydration', () => ({
  hydrateUserIds: () => Promise.resolve([]),
}))

const baseProps = {
  search: createEmptyFeedFilters().search,
  onChange: jest.fn(),
  onClose: jest.fn(),
  onDismiss: jest.fn(),
  onClear: jest.fn(),
  onApply: jest.fn(),
  isApplyDisabled: true,
  position: { x: 100, y: 200 },
}

describe('SearchFilterModal', () => {
  it('renders title', () => {
    render(<SearchFilterModal {...baseProps} />)
    expect(screen.getByText('Search in posts')).toBeInTheDocument()
  })

  it('header has title left, Clear/Cancel right', () => {
    render(<SearchFilterModal {...baseProps} />)
    const header = screen.getByText('Search in posts').closest('.flex')
    expect(header?.className).toContain('justify-between')
    expect(screen.getByText('Clear')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('header has a ghost Apply button to the right of Cancel', () => {
    render(<SearchFilterModal {...baseProps} />)
    const header = screen.getByText('Search in posts').closest('.flex')
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
    const input = screen.getByPlaceholderText('Search keywords...')
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

  it('renders author chips with @username from provided UserSearchResult', () => {
    const search = {
      authors: { mode: 'required' as const, users: [{ id: 1, username: 'existing_user', displayName: 'Existing User' }] },
      keyword: { mode: 'off' as const, text: '' },
    }
    render(<SearchFilterModal {...baseProps} search={search} />)
    expect(screen.getByText('@existing_user')).toBeInTheDocument()
  })

  it('keyword input is disabled when keyword mode is off', () => {
    render(<SearchFilterModal {...baseProps} />)
    const input = screen.getByPlaceholderText('Search keywords...')
    expect(input).toBeDisabled()
  })

  it('keyword input is enabled when keyword mode is not off', () => {
    const search = {
      authors: { mode: 'off' as const, users: [] },
      keyword: { mode: 'boost' as const, text: '' },
    }
    render(<SearchFilterModal {...baseProps} search={search} />)
    const input = screen.getByPlaceholderText('Search keywords...')
    expect(input).not.toBeDisabled()
  })

  it('author search is disabled when author mode is off', () => {
    render(<SearchFilterModal {...baseProps} />)
    const combobox = screen.getByRole('combobox')
    expect(combobox).toBeDisabled()
  })

  it('author search is enabled when author mode is not off', () => {
    const search = {
      authors: { mode: 'required' as const, users: [] },
      keyword: { mode: 'off' as const, text: '' },
    }
    render(<SearchFilterModal {...baseProps} search={search} />)
    const combobox = screen.getByRole('combobox')
    expect(combobox).not.toBeDisabled()
  })

  it('displays @deleted for users with null username before hydration', () => {
    const search = {
      authors: { mode: 'required' as const, users: [{ id: 1, username: null as string | null }] as any[] },
      keyword: { mode: 'off' as const, text: '' },
    }
    render(<SearchFilterModal {...baseProps} search={search} />)
    expect(screen.getByText('@deleted')).toBeInTheDocument()
  })
})
