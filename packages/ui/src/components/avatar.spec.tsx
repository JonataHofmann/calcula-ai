import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Avatar } from './avatar.js';

afterEach(cleanup);

describe('Avatar', () => {
  it('renders image when src provided', () => {
    render(<Avatar src="/user.png" alt="Foto de Maria" />);
    expect(screen.getByRole('img', { name: 'Foto de Maria' })).toHaveAttribute('src', '/user.png');
  });

  it('renders initials fallback without src', () => {
    render(<Avatar alt="Maria Silva" name="Maria Silva" />);
    expect(screen.getByText('MS')).toBeInTheDocument();
  });

  it('falls back to initials when image fails', () => {
    render(<Avatar src="/broken.png" alt="Maria Silva" name="Maria Silva" />);
    fireEvent.error(screen.getByRole('img', { name: 'Maria Silva' }));
    expect(screen.getByText('MS')).toBeInTheDocument();
  });

  it('renders ? without name', () => {
    render(<Avatar alt="Usuário" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
