import { beforeEach, describe, expect, it } from 'vitest';
import { createNotesRepository } from './notesRepository';

describe('notesRepository', () => {
  let storage;
  let repository;

  beforeEach(() => {
    storage = window.localStorage;
    storage.clear();
    repository = createNotesRepository(storage);
  });

  it('creates, updates, and deletes notes on the device', () => {
    const note = {
      id: 'note-1',
      title: 'Idea',
      body: 'Save for later',
      pinned: false,
      archived: false,
      updatedAt: '2026-11-21T00:00:00.000Z'
    };

    repository.save(note);
    expect(repository.list()).toEqual([note]);
    repository.save({ ...note, title: 'Updated idea' });
    expect(repository.list()).toEqual([{ ...note, title: 'Updated idea' }]);

    repository.delete(note.id);
    expect(repository.list()).toEqual([]);
  });

  it('reports invalid stored note data instead of hiding it', () => {
    storage.setItem('pws-notes', '{invalid');
    expect(() => repository.list()).toThrow('Their stored data is invalid.');
  });
});
