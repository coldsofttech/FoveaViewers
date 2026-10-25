import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExampleComponent } from './index.js';

describe('ExampleComponent', () => {
  it('greets by name', () => {
    render(<ExampleComponent name="World" />);
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
  });

  it('reports the name when the button is pressed', async () => {
    const onGreet = vi.fn();
    render(<ExampleComponent name="World" onGreet={onGreet} />);
    await userEvent.click(screen.getByRole('button', { name: 'Greet' }));
    expect(onGreet).toHaveBeenCalledWith('World');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<ExampleComponent name="World" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
