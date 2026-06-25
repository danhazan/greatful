import React from 'react'
import { render, screen, fireEvent } from '@/tests/utils/testUtils'
import { describe, it, expect, jest } from '@jest/globals'
import DateFilterModal from '../DateFilterModal'
import { sanitizeDateInput } from '../DateFilterModal'
import { createEmptyFeedFilters } from '@/utils/feedFilterState'
import { FEED_CONFIG } from '@/config/feed'

const baseProps = {
  date: createEmptyFeedFilters().date,
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
  date: {
    mode: 'required' as const,
    localRange: { start: '2026-01-01', end: '2026-06-23' },
  },
}

describe('DateFilterModal', () => {
  it('renders title', () => {
    render(<DateFilterModal {...baseProps} />)
    expect(screen.getByText('Date Filter')).toBeInTheDocument()
  })

  it('header has title left, Clear/Cancel right', () => {
    render(<DateFilterModal {...baseProps} />)
    const header = screen.getByText('Date Filter').closest('.flex')
    expect(header?.className).toContain('justify-between')
    expect(screen.getByText('Clear')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('header has a ghost Apply button to the right of Cancel', () => {
    render(<DateFilterModal {...baseProps} />)
    const header = screen.getByText('Date Filter').closest('.flex')
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
    render(<DateFilterModal {...baseProps} />)
    const applies = screen.getAllByText('Apply')
    expect(applies).toHaveLength(2)
    const footerApplies = applies.filter(a => a.closest('.border-t'))
    expect(footerApplies).toHaveLength(1)
    expect(footerApplies[0].className).toContain('bg-purple-600')
  })

  it('renders with correct position style', () => {
    render(<DateFilterModal {...baseProps} />)
    const root = document.querySelector('.fixed.z-50') as HTMLElement
    expect(root).not.toBeNull()
    expect(root.style.left).toBe('100px')
    expect(root.style.top).toBe('200px')
  })

  it('has responsive width class', () => {
    const { container } = render(<DateFilterModal {...baseProps} />)
    const card = container.querySelector('.rounded-xl')
    expect(card?.className).toContain('w-[calc(100vw-1.5rem)]')
    expect(card?.className).toContain('sm:max-w-sm')
  })

  it('Clear is disabled when mode is off', () => {
    render(<DateFilterModal {...baseProps} />)
    const clear = screen.getByText('Clear')
    expect(clear.className).toContain('text-gray-400')
    expect(clear).toBeDisabled()
  })

  it('Clear has purple tint when mode is not off', () => {
    render(<DateFilterModal {...activeProps} />)
    const clear = screen.getByText('Clear')
    expect(clear.className).toContain('text-purple-600')
  })

  it('Cancel button has red styling', () => {
    render(<DateFilterModal {...baseProps} />)
    const cancel = screen.getByText('Cancel')
    expect(cancel.className).toContain('text-red-600')
  })

  it('both Apply buttons are disabled when isApplyDisabled is true', () => {
    render(<DateFilterModal {...baseProps} isApplyDisabled={true} />)
    screen.getAllByText('Apply').forEach(btn => {
      expect(btn).toBeDisabled()
    })
  })

  it('both Apply buttons are enabled when isApplyDisabled is false', () => {
    render(<DateFilterModal {...baseProps} isApplyDisabled={false} />)
    screen.getAllByText('Apply').forEach(btn => {
      expect(btn).not.toBeDisabled()
    })
  })

  it('Cancel calls onClose (revert + close)', () => {
    const onClose = jest.fn()
    render(<DateFilterModal {...baseProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Clear calls onClear', () => {
    const onClear = jest.fn()
    render(<DateFilterModal {...activeProps} onClear={onClear} isApplyDisabled={false} />)
    fireEvent.click(screen.getByText('Clear'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('header ghost Apply calls onApply only (no onChange)', () => {
    const onChange = jest.fn()
    const onApply = jest.fn()
    const props = {
      ...activeProps,
      onChange,
      onApply,
      isApplyDisabled: false,
    }
    render(<DateFilterModal {...props} />)
    fireEvent.click(screen.getAllByText('Apply')[0])
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('footer filled Apply also calls onApply', () => {
    const onApply = jest.fn()
    render(<DateFilterModal {...activeProps} onApply={onApply} isApplyDisabled={false} />)
    fireEvent.click(screen.getAllByText('Apply')[1])
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it('date input change calls onChange with localRange', () => {
    const onChange = jest.fn()
    render(<DateFilterModal {...activeProps} onChange={onChange} isApplyDisabled={false} />)
    const inputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(inputs[0], { target: { value: '2026-06-01' } })
    expect(onChange).toHaveBeenCalledWith({
      mode: 'required',
      localRange: { start: '2026-06-01', end: '2026-06-23' },
    })
  })

  it('mode change calls onChange with current localRange', () => {
    const onChange = jest.fn()
    render(<DateFilterModal {...activeProps} onChange={onChange} />)
    const modeButtons = screen.getAllByText('Mostly')
    fireEvent.click(modeButtons[0])
    expect(onChange).toHaveBeenCalledWith({
      mode: 'boost',
      localRange: { start: '2026-01-01', end: '2026-06-23' },
    })
  })

  it('both Apply disabled when start > end', () => {
    const props = {
      ...activeProps,
      date: {
        mode: 'required' as const,
        localRange: { start: '2026-06-30', end: '2026-06-24' },
      },
      isApplyDisabled: false,
    }
    render(<DateFilterModal {...props} />)
    screen.getAllByText('Apply').forEach(btn => {
      expect(btn).toBeDisabled()
    })
  })

  it('both Apply disabled when start < MIN_DATE', () => {
    const props = {
      ...activeProps,
      date: {
        mode: 'required' as const,
        localRange: { start: '2020-01-01', end: '2026-06-24' },
      },
      isApplyDisabled: false,
    }
    render(<DateFilterModal {...props} />)
    screen.getAllByText('Apply').forEach(btn => {
      expect(btn).toBeDisabled()
    })
  })

  it('date inputs use compact padding', () => {
    render(<DateFilterModal {...baseProps} />)
    const inputs = document.querySelectorAll('input[type="date"]')
    inputs.forEach(input => {
      expect(input.className).toContain('px-2')
      expect(input.className).toContain('py-1')
      expect(input.className).toContain('w-auto')
    })
  })

  it('shows Past Year preset label', () => {
    render(<DateFilterModal {...baseProps} />)
    expect(screen.getByText('Past Year')).toBeInTheDocument()
  })

  it('preset click auto-switches mode to boost when mode is off', () => {
    const onChange = jest.fn()
    render(<DateFilterModal {...baseProps} onChange={onChange} />)
    fireEvent.click(screen.getByText('Today'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'boost' })
    )
  })

  it('shows validation error when start > end and mode is not off', () => {
    const props = {
      ...activeProps,
      date: {
        mode: 'required' as const,
        localRange: { start: '2026-06-30', end: '2026-06-24' },
      },
      isApplyDisabled: false,
    }
    render(<DateFilterModal {...props} />)
    expect(screen.getByText('Start date must be before end date')).toBeInTheDocument()
  })

  it('shows validation error when date is below MIN_DATE and mode is not off', () => {
    const props = {
      ...activeProps,
      date: {
        mode: 'required' as const,
        localRange: { start: '2020-01-01', end: '2026-06-24' },
      },
      isApplyDisabled: false,
    }
    render(<DateFilterModal {...props} />)
    expect(screen.getByText(/Date must be on or after/)).toBeInTheDocument()
  })

  it('does not show validation errors when mode is off', () => {
    render(<DateFilterModal {...baseProps} />)
    expect(screen.queryByText('Start date must be before end date')).not.toBeInTheDocument()
    expect(screen.queryByText(/Date must be on or after/)).not.toBeInTheDocument()
  })

  describe('sanitizeDateInput', () => {
    it('prevents year overflow beyond 4 digits', () => {
      expect(sanitizeDateInput('20266')).toBe('2026')
    })

    it('prevents month overflow beyond 2 digits', () => {
      expect(sanitizeDateInput('2026-013')).toBe('2026-01')
    })

    it('prevents day overflow beyond 2 digits', () => {
      expect(sanitizeDateInput('2026-01-011')).toBe('2026-01-01')
    })

    it('strips non-digit non-hyphen characters', () => {
      expect(sanitizeDateInput('20a26-b01-c01')).toBe('2026-01-01')
    })

    it('allows empty string', () => {
      expect(sanitizeDateInput('')).toBe('')
    })

    it('allows progressive partial input', () => {
      expect(sanitizeDateInput('2')).toBe('2')
      expect(sanitizeDateInput('20')).toBe('20')
      expect(sanitizeDateInput('202')).toBe('202')
      expect(sanitizeDateInput('2026')).toBe('2026')
      expect(sanitizeDateInput('2026-')).toBe('2026-')
      expect(sanitizeDateInput('2026-0')).toBe('2026-0')
      expect(sanitizeDateInput('2026-01')).toBe('2026-01')
      expect(sanitizeDateInput('2026-01-')).toBe('2026-01-')
      expect(sanitizeDateInput('2026-01-0')).toBe('2026-01-0')
      expect(sanitizeDateInput('2026-01-01')).toBe('2026-01-01')
    })

    it('date inputs are positioned below mode buttons and above presets', () => {
      const { container } = render(<DateFilterModal {...baseProps} />)
      const body = container.querySelector('.border-b + div') || container
      const modeSection = body.querySelector('.flex.gap-2')
      const dateSection = body.querySelector('.flex.items-center.justify-center.gap-2')
      const presetSection = body.querySelector('.grid.grid-cols-2')
      if (modeSection && dateSection && presetSection) {
        const modeIndex = Array.from(body.children).indexOf(modeSection.closest('.space-y-4 > *') || modeSection)
        const dateIndex = Array.from(body.children).indexOf(dateSection.closest('.space-y-4 > *') || dateSection)
        const presetIndex = Array.from(body.children).indexOf(presetSection.closest('.space-y-4 > *') || presetSection)
        expect(dateIndex).toBeGreaterThan(modeIndex)
        expect(presetIndex).toBeGreaterThan(dateIndex)
      }
    })
  })
})
