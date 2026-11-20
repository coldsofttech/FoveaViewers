import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { makePptx } from '../../../test-support/pptx.js';
import { PowerpointViewer } from './PowerpointViewer.jsx';
import { resolvePart } from './parsePresentation.js';

const file = async () =>
  new File([await makePptx()], 'deck.pptx', {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });

describe('resolvePart', () => {
  it('finds a part from the part that refers to it', () => {
    expect(resolvePart('ppt/slides/slide1.xml', '../media/a.png')).toBe('ppt/media/a.png');
    expect(resolvePart('ppt/presentation.xml', 'slides/slide1.xml')).toBe('ppt/slides/slide1.xml');
    expect(resolvePart('ppt/slides/slide1.xml', '/ppt/media/a.png')).toBe('ppt/media/a.png');
  });
});

describe('PowerpointViewer', () => {
  it('shows the first slide with its title, list and speaker notes', async () => {
    render(<PowerpointViewer source={await file()} />);
    const stage = await screen.findByRole('group', { name: /slide 1 of 2: Launch plan/i });
    expect(within(stage).getByRole('heading', { name: 'Launch plan' })).toBeInTheDocument();
    const items = within(stage).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['First, ship', 'Then measure']);
    expect(items[0].querySelector('span').style.fontWeight).toBe('700');
    // A paragraph that turns its bullet off is not a list item.
    expect(within(stage).getByText('Plain closing line').closest('li')).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Speaker notes' })).toHaveTextContent(
      'Remember to thank the team',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Slide 1 of 2');
  });

  it('places shapes that take their place from the layout', async () => {
    render(<PowerpointViewer source={await file()} thumbnails={false} />);
    const stage = await screen.findByRole('group', { name: /slide 1/i });
    const title = within(stage).getByRole('heading').parentElement;
    expect(title.style.left).toBe(`${(457200 / 9144000) * 100}%`);
    expect(title.style.top).toBe(`${(228600 / 5143500) * 100}%`);
  });

  it('moves between slides with the buttons, the thumbnails and the keys', async () => {
    const user = userEvent.setup();
    const onSlideChange = vi.fn();
    render(<PowerpointViewer source={await file()} onSlideChange={onSlideChange} />);
    await screen.findByRole('group', { name: /slide 1/i });
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(
      await screen.findByRole('group', { name: /slide 2 of 2: Results/i }),
    ).toBeInTheDocument();
    expect(onSlideChange).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Slide 1: Launch plan' }));
    expect(screen.getByRole('group', { name: /slide 1 of 2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Slide 1: Launch plan' })).toHaveAttribute(
      'aria-current',
      'true',
    );

    screen.getByRole('group', { name: /slide 1/i }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('group', { name: /slide 2/i })).toBeInTheDocument();
    await user.keyboard('{Home}');
    expect(screen.getByRole('group', { name: /slide 1/i })).toBeInTheDocument();
    await user.keyboard('{End}');
    expect(screen.getByRole('group', { name: /slide 2/i })).toBeInTheDocument();
  });

  it('shows a picture inside a group, and a table with merged cells', async () => {
    render(<PowerpointViewer source={await file()} slide={1} thumbnails={false} />);
    const stage = await screen.findByRole('group', { name: /slide 2/i });
    const picture = within(stage).getByRole('img', { name: 'A single dot' });
    expect(picture.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    // The group maps its own coordinates (0..1,000,000) onto its box on the slide.
    expect(picture.style.left).toBe(`${((457200 + 500000 * 2) / 9144000) * 100}%`);
    expect(picture.style.width).toBe(`${((500000 * 2) / 9144000) * 100}%`);
    const table = within(stage).getByRole('table');
    expect(within(table).getByText('South, merged')).toHaveAttribute('colspan', '2');
    expect(within(table).getAllByRole('row').at(2).querySelectorAll('td')).toHaveLength(1);
  });

  it('hides the notes and the thumbnails when asked', async () => {
    render(<PowerpointViewer source={await file()} showNotes={false} thumbnails={false} />);
    await screen.findByRole('group', { name: /slide 1/i });
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByRole('list', { name: /slides/i })).toBeNull();
  });

  it('lets the host choose the slide', async () => {
    render(<PowerpointViewer source={await file()} slide={1} />);
    expect(await screen.findByRole('group', { name: /slide 2 of 2/i })).toBeInTheDocument();
  });

  it('finds the target on another slide, shows it and marks it', async () => {
    const onMarked = vi.fn();
    const { container } = render(
      <PowerpointViewer
        source={await file()}
        thumbnails={false}
        target={{ matched: 'South, merged' }}
        onMarked={onMarked}
      />,
    );
    await waitFor(() => expect(container.querySelector('mark')).not.toBeNull());
    expect(screen.getByRole('group', { name: /slide 2 of 2/i })).toBeInTheDocument();
    await waitFor(() => expect(onMarked).toHaveBeenLastCalledWith(true));
  });

  it('finds a target in the speaker notes only when they are shown', async () => {
    const onMarked = vi.fn();
    const deck = await file();
    const target = { matched: 'thank the team' };
    const { container, rerender } = render(
      <PowerpointViewer
        source={deck}
        thumbnails={false}
        showNotes={false}
        target={target}
        onMarked={onMarked}
      />,
    );
    await screen.findByRole('group', { name: /slide 1/i });
    await waitFor(() => expect(onMarked).toHaveBeenLastCalledWith(false));
    expect(container.querySelector('mark')).toBeNull();
    rerender(
      <PowerpointViewer source={deck} thumbnails={false} target={target} onMarked={onMarked} />,
    );
    await waitFor(() => expect(container.querySelector('mark')).not.toBeNull());
    expect(onMarked).toHaveBeenLastCalledWith(true);
  });

  it('calls onReady with the slide count and has no accessibility violations', async () => {
    const onReady = vi.fn();
    const { container } = render(<PowerpointViewer source={await file()} onReady={onReady} />);
    await screen.findByRole('group', { name: /slide 1/i });
    await waitFor(() => expect(onReady).toHaveBeenCalledWith({ slideCount: 2 }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reports a file that cannot be read', async () => {
    const onError = vi.fn();
    render(<PowerpointViewer source={new File(['not a deck'], 'x.pptx')} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be read');
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
