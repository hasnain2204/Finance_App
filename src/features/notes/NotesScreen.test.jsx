import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotesScreen } from './NotesScreen';

function createRepository(initialNotes = []) {
  const notes = [...initialNotes];
  return {
    list: vi.fn(() => [...notes]),
    save: vi.fn((note) => {
      const index = notes.findIndex((item) => item.id === note.id);
      if (index < 0) notes.unshift(note);
      else notes[index] = note;
      return note;
    }),
    delete: vi.fn((id) => {
      const index = notes.findIndex((item) => item.id === id);
      if (index >= 0) notes.splice(index, 1);
    })
  };
}

describe('NotesScreen', () => {
  it('creates a note, opens it, and saves edits', async () => {
    const repository = createRepository();
    render(<NotesScreen onBack={vi.fn()} repository={repository} />);

    await waitFor(() => expect(repository.list).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Shopping' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Milk and bread' } });

    expect(repository.save).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to notes' }));
    expect(screen.getByRole('button', { name: 'Open Shopping' })).toBeTruthy();
  });

  it('searches and opens saved notes', async () => {
    const repository = createRepository([{
      id: 'note-1',
      title: 'Trip plan',
      body: 'Book train',
      pinned: false,
      archived: false,
      createdAt: '2026-11-21T00:00:00.000Z',
      updatedAt: '2026-11-21T00:00:00.000Z'
    }]);
    render(<NotesScreen onBack={vi.fn()} repository={repository} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open Trip plan' })).toBeTruthy());
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search notes' }), { target: { value: 'train' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open Trip plan' }));
    expect(screen.getByLabelText('Note').value).toBe('Book train');
  });
});
