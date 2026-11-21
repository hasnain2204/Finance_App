const notesStorageKey = 'pws-notes';
const revisionsStorageKey = 'pws-note-revisions';
const templatesStorageKey = 'pws-note-templates';
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_REVISIONS_PER_NOTE = 30;

export function createNotesRepository(storage) {
  if (!storage) throw new Error('Notes storage is unavailable.');

  const readArray = (key, label) => {
    let value;
    try {
      value = storage.getItem(key);
    } catch (error) {
      throw new Error(`${label} could not be accessed on this device.`, { cause: error });
    }

    if (value === null) return [];

    let records;
    try {
      records = JSON.parse(value);
    } catch (error) {
      throw new Error(`${label} could not be read. Its stored data is invalid.`, { cause: error });
    }

    if (!Array.isArray(records)) {
      throw new Error(`${label} could not be read. Its stored data is invalid.`);
    }
    return records;
  };

  const listAll = () => {
    const notes = readArray(notesStorageKey, 'Saved notes');
    if (notes.some((note) => (
      !note || typeof note.id !== 'string' || typeof note.title !== 'string' ||
      typeof note.body !== 'string' || typeof note.updatedAt !== 'string'
    ))) {
      throw new Error('Saved notes could not be read. Their stored data is invalid.');
    }
    return notes;
  };
  const list = () => listAll().filter((note) => !note.deletedAt);

  const writeArray = (key, records, message) => {
    const serialized = JSON.stringify(records);
    if (serialized.length > 4 * 1024 * 1024) {
      throw new Error('Notes storage is full. Remove large attachments or export notes to free space.');
    }
    try {
      storage.setItem(key, serialized);
    } catch (error) {
      throw new Error(message, { cause: error });
    }
  };

  const recordRevision = (previous, next) => {
    if (previous.content === next.content && previous.body === next.body && previous.title === next.title) return;
    const revisions = readArray(revisionsStorageKey, 'Note history');
    const noteRevisions = revisions.filter((revision) => revision.noteId === previous.id);
    const lastRevision = noteRevisions[0];
    if (lastRevision && Date.now() - new Date(lastRevision.createdAt).getTime() < 60_000) return;
    revisions.unshift({
      id: `${previous.id}-${Date.now()}`,
      noteId: previous.id,
      title: previous.title,
      body: previous.body,
      content: previous.content || null,
      createdAt: new Date().toISOString(),
      snapshotAt: previous.updatedAt
    });
    writeArray(
      revisionsStorageKey,
      revisions.filter((revision) => revision.noteId !== previous.id ||
        revisions.indexOf(revision) < MAX_REVISIONS_PER_NOTE),
      'Note history could not be saved.'
    );
  };

  return {
    list,
    listTrash() {
      const expiredBefore = Date.now() - TRASH_RETENTION_MS;
      const allNotes = listAll();
      const trash = allNotes.filter((note) => note.deletedAt);
      const remaining = trash.filter((note) => new Date(note.deletedAt).getTime() > expiredBefore);
      if (remaining.length !== trash.length) {
        writeArray(notesStorageKey, [
          ...allNotes.filter((note) => !note.deletedAt),
          ...remaining
        ], 'Expired notes could not be removed from Trash.');
      }
      return remaining;
    },
    listRevisions(noteId) {
      return readArray(revisionsStorageKey, 'Note history')
        .filter((revision) => revision.noteId === noteId);
    },
    listTemplates() {
      return readArray(templatesStorageKey, 'Note templates');
    },
    save(note) {
      if (!note || typeof note.id !== 'string' || typeof note.title !== 'string' || typeof note.body !== 'string') {
        throw new TypeError('A note must have an ID, title, and body.');
      }
      const notes = listAll();
      const existingIndex = notes.findIndex((item) => item.id === note.id);
      if (existingIndex < 0) notes.unshift(note);
      else {
        recordRevision(notes[existingIndex], note);
        notes[existingIndex] = note;
      }
      writeArray(notesStorageKey, notes, 'Your note could not be saved on this device.');
      return note;
    },
    delete(id) {
      const notes = listAll();
      const note = notes.find((item) => item.id === id);
      if (!note || note.deletedAt) return;
      this.save({ ...note, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    },
    restore(id) {
      const notes = listAll();
      const note = notes.find((item) => item.id === id);
      if (!note || !note.deletedAt) return null;
      const restored = { ...note, deletedAt: null, updatedAt: new Date().toISOString() };
      this.save(restored);
      return restored;
    },
    saveTemplate(template) {
      if (!template || typeof template.id !== 'string' || typeof template.name !== 'string') {
        throw new TypeError('A template must have an ID and name.');
      }
      const templates = this.listTemplates();
      const index = templates.findIndex((item) => item.id === template.id);
      if (index < 0) templates.unshift(template);
      else templates[index] = template;
      writeArray(templatesStorageKey, templates, 'Your template could not be saved.');
    }
  };
}

function getNotesRepository() {
  if (typeof window === 'undefined') throw new Error('Notes storage is unavailable.');
  return createNotesRepository(window.localStorage);
}

export const notesRepository = {
  list: () => getNotesRepository().list(),
  listTrash: () => getNotesRepository().listTrash(),
  listRevisions: (noteId) => getNotesRepository().listRevisions(noteId),
  listTemplates: () => getNotesRepository().listTemplates(),
  save: (note) => getNotesRepository().save(note),
  delete: (id) => getNotesRepository().delete(id),
  restore: (id) => getNotesRepository().restore(id),
  saveTemplate: (template) => getNotesRepository().saveTemplate(template)
};
