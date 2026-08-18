import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './modal.js';

afterEach(cleanup);

describe('Modal', () => {
  it('does not render content when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Nova conta">
        <p>corpo</p>
      </Modal>,
    );
    expect(screen.queryByText('corpo')).not.toBeInTheDocument();
  });

  it('renders as a dialog with title when open', () => {
    render(
      <Modal open onClose={() => {}} title="Nova conta">
        <p>corpo</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('corpo')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Nova conta">
        <p>corpo</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on the close button', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Nova conta">
        <p>corpo</p>
      </Modal>,
    );
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(onClose).toHaveBeenCalled();
  });
});
