const notesStorageKey = 'pws-notes';

export function createNotesRepository(storage) {
  if (!storage) throw new Error('Notes storage is unavailable.');

  const list = () => {
    let value;
    try {
      value = storage.getItem(notesStorageKey);
    } catch (error) {
      throw new Error('Saved notes could not be accessed on this device.', { cause: error });
    }

    if (value === null) return [];

    let notes;
    try {
      notes = JSON.parse(value);
    } catch (error) {
      throw new Error('Saved notes could not be read. Their stored data is invalid.', { cause: error });
    }

    if (!Array.isArray(notes) || notes.some((note) => (
      !note || typeof note.id !== 'string' || typeof note.title !== 'string' ||
      typeof note.body !== 'string' || typeof note.updatedAt !== 'string'
    ))) {
      throw new Error('Saved notes could not be read. Their stored data is invalid.');
    }
    return notes;
  };

  const write = (notes) => {
    try {
      storage.setItem(notesStorageKey, JSON.stringify(notes));
    } catch (error) {
      throw new Error('Your note could not be saved on this device.', { cause: error });
    }
  };

  return {
    list,
    save(note) {
      if (!note || typeof note.id !== 'string' || typeof note.title !== 'string' || typeof note.body !== 'string') {
        throw new TypeError('A note must have an ID, title, and body.');
      }
      const notes = list();
      const existingIndex = notes.findIndex((item) => item.id === note.id);
      if (existingIndex < 0) notes.unshift(note);
      else notes[existingIndex] = note;
      write(notes);
      return note;
    },
    delete(id) {
      write(list().filter((note) => note.id !== id));
    }
  };
}

function getNotesRepository() {
  if (typeof window === 'undefined') throw new Error('Notes storage is unavailable.');
  return createNotesRepository(window.localStorage);
}

export const notesRepository = {
  list: () => getNotesRepository().list(),
  save: (note) => getNotesRepository().save(note),
  delete: (id) => getNotesRepository().delete(id)
};
