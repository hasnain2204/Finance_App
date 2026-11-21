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
    expect(() => repository.list()).toThrow('Its stored data is invalid.');
  });

  it('moves deleted notes to recoverable trash and restores them', () => {
    repository.save({
      id: 'note-trash',
      title: 'Recover me',
      body: 'Still needed',
      updatedAt: new Date().toISOString()
    });

    repository.delete('note-trash');
    expect(repository.list()).toEqual([]);
    expect(repository.listTrash().map((note) => note.id)).toEqual(['note-trash']);
    expect(repository.restore('note-trash')).toMatchObject({ id: 'note-trash', deletedAt: null });
    expect(repository.list().map((note) => note.id)).toEqual(['note-trash']);
  });

  it('captures periodic note revisions', () => {
    repository.save({
      id: 'note-history',
      title: 'First title',
      body: 'First version',
      updatedAt: new Date(Date.now() - 61_000).toISOString()
    });
    repository.save({
      id: 'note-history',
      title: 'Second title',
      body: 'Second version',
      updatedAt: new Date().toISOString()
    });

    expect(repository.listRevisions('note-history')).toHaveLength(1);
    expect(repository.listRevisions('note-history')[0]).toMatchObject({
      title: 'First title',
      body: 'First version'
    });
  });

  it('purges trash after the 30-day recovery period', () => {
    repository.save({
      id: 'expired-note',
      title: 'Expired',
      body: 'Remove after retention',
      updatedAt: new Date().toISOString(),
      deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    });

    expect(repository.listTrash()).toEqual([]);
    expect(repository.list()).toEqual([]);
  });
});
