import React from 'react';
import { render, screen, fireEvent } from '@/tests/utils/testUtils';
import { describe, it, expect, jest } from '@jest/globals';
import LocaleDateInput from '../LocaleDateInput';

describe('LocaleDateInput', () => {
  it('renders input with formatted initial value', () => {
    render(<LocaleDateInput value="2026-12-31" onChange={jest.fn()} />);
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    // Assuming default locale en-US
    expect((input as HTMLInputElement).value).toMatch(/12\/\d{2}\/2026/);
  });

  it('updates input value on prop change', () => {
    const { rerender } = render(<LocaleDateInput value="2026-12-31" onChange={jest.fn()} />);
    rerender(<LocaleDateInput value="2026-01-01" onChange={jest.fn()} />);
    const input = screen.getByRole('textbox');
    expect((input as HTMLInputElement).value).toMatch(/01\/\d{2}\/2026/);
  });

  it('calls onChange with empty string when input is cleared', () => {
    const onChange = jest.fn();
    render(<LocaleDateInput value="2026-12-31" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('does not call onChange for partial or invalid input but shows invalid state', () => {
    const onChange = jest.fn();
    render(<LocaleDateInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    
    fireEvent.change(input, { target: { value: '12/3' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Invalid date')).toBeInTheDocument();
  });

  it('calls onChange with valid ISO date when complete valid input is typed', () => {
    const onChange = jest.fn();
    render(<LocaleDateInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    
    // Type a full valid date in MDY format
    fireEvent.change(input, { target: { value: '12/31/2026' } });
    expect(onChange).toHaveBeenCalledWith('2026-12-31');
    expect(screen.queryByText('Invalid date')).not.toBeInTheDocument();
  });

  it('hidden date input correctly bubbles up onChange', () => {
    const onChange = jest.fn();
    const { container } = render(<LocaleDateInput value="" onChange={onChange} />);
    const hiddenInput = container.querySelector('input[type="date"]');
    expect(hiddenInput).toBeInTheDocument();
    
    fireEvent.change(hiddenInput!, { target: { value: '2026-01-15' } });
    expect(onChange).toHaveBeenCalledWith('2026-01-15');
  });

  it('clicking the calendar button triggers picker fallback chain', () => {
    render(<LocaleDateInput value="" onChange={jest.fn()} />);
    const btn = screen.getByLabelText('Open date picker');
    const container = btn.parentElement;
    const hiddenInput = container?.querySelector('input[type="date"]') as HTMLInputElement;
    
    // Mock showPicker
    hiddenInput.showPicker = jest.fn();
    fireEvent.click(btn);
    expect(hiddenInput.showPicker).toHaveBeenCalled();
  });
});
