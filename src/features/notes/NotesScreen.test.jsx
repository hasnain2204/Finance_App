import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotesScreen } from './NotesScreen';

function createRepository(initialNotes = []) {
  const notes = [...initialNotes];
  return {
    list: vi.fn(() => [...notes]),
    listTrash: vi.fn(() => []),
    listTemplates: vi.fn(() => []),
    listRevisions: vi.fn(() => []),
    saveTemplate: vi.fn(),
    save: vi.fn((note) => {
      const index = notes.findIndex((item) => item.id === note.id);
      if (index < 0) notes.unshift(note);
      else notes[index] = note;
      return note;
    }),
    delete: vi.fn((id) => {
      const index = notes.findIndex((item) => item.id === id);
      if (index >= 0) notes[index] = { ...notes[index], deletedAt: new Date().toISOString() };
    }),
    restore: vi.fn((id) => {
      const note = notes.find((item) => item.id === id);
      if (!note) return null;
      const restored = { ...note, deletedAt: null };
      notes[notes.indexOf(note)] = restored;
      return restored;
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
    await waitFor(() => expect(screen.getByRole('toolbar', { name: 'Note formatting' })).toBeTruthy(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Checklist' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));

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
    await waitFor(() => expect(screen.getByRole('toolbar', { name: 'Note formatting' })).toBeTruthy(), { timeout: 5000 });
  });

  it('rejects unsupported attachment types with a visible error', async () => {
    const repository = createRepository([{
      id: 'note-attachment',
      title: 'Receipts',
      body: '',
      pinned: false,
      archived: false,
      createdAt: '2026-11-21T00:00:00.000Z',
      updatedAt: '2026-11-21T00:00:00.000Z'
    }]);
    render(<NotesScreen onBack={vi.fn()} repository={repository} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open Receipts' }));
    fireEvent.change(screen.getByLabelText('Choose note attachments'), {
      target: { files: [new File(['data'], 'malware.exe', { type: 'application/x-msdownload' })] }
    });

    expect((await screen.findByRole('alert')).textContent).toContain('not a supported image, audio recording, or PDF');
  });
});
