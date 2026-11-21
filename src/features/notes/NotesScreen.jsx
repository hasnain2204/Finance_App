import { useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ArrowLeft, FileText, Pin, Plus, Search, Trash2 } from 'lucide-react';
import { ConfirmDialog, EmptyState } from '../../components/ui';
import { notesRepository } from '../../services/notesRepository';

function createNoteId() {
  return globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function notePreview(body) {
  return body.trim().replace(/\s+/g, ' ');
}

function formatUpdatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NotesScreen({ onBack, repository = notesRepository }) {
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    try {
      setNotes(repository.list());
    } catch (loadError) {
      setError(loadError?.message || 'Saved notes could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  const selectedNote = notes.find((note) => note.id === selectedNoteId) || null;
  const visibleNotes = useMemo(() => notes
    .filter((note) => Boolean(note.archived) === showArchived)
    .filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
      String(b.updatedAt).localeCompare(String(a.updatedAt))), [notes, search, showArchived]);

  const persistNote = (note) => {
    try {
      repository.save(note);
      setNotes((current) => {
        const index = current.findIndex((item) => item.id === note.id);
        if (index < 0) return [note, ...current];
        return current.map((item) => item.id === note.id ? note : item);
      });
      setError('');
    } catch (saveError) {
      setError(saveError?.message || 'Your note could not be saved.');
    }
  };

  const createNote = () => {
    const now = new Date().toISOString();
    const note = {
      id: createNoteId(),
      title: '',
      body: '',
      pinned: false,
      archived: false,
      createdAt: now,
      updatedAt: now
    };
    persistNote(note);
    setSelectedNoteId(note.id);
  };

  const updateNote = (updates) => {
    if (!selectedNote) return;
    persistNote({ ...selectedNote, ...updates, updatedAt: new Date().toISOString() });
  };

  const handleDelete = () => {
    if (!selectedNote) return;
    try {
      repository.delete(selectedNote.id);
      setNotes((current) => current.filter((note) => note.id !== selectedNote.id));
      setSelectedNoteId(null);
      setShowDeleteConfirm(false);
      setError('');
    } catch (deleteError) {
      setError(deleteError?.message || 'The note could not be deleted.');
      setShowDeleteConfirm(false);
    }
  };

  if (selectedNote) {
    return (
      <main className="notes-shell">
        <header className="notes-editor-header">
          <button type="button" className="back-button" onClick={() => setSelectedNoteId(null)} aria-label="Back to notes">
            <ArrowLeft size={22} />
          </button>
          <span className="notes-save-status" role="status">{error ? 'Changes not saved' : 'Saved on this device'}</span>
          <div className="topbar-actions">
            <button
              type="button"
              className={`more-button ${selectedNote.pinned ? 'notes-action-active' : ''}`}
              onClick={() => updateNote({ pinned: !selectedNote.pinned })}
              aria-label={selectedNote.pinned ? 'Unpin note' : 'Pin note'}
              title={selectedNote.pinned ? 'Unpin note' : 'Pin note'}
            >
              <Pin size={19} />
            </button>
            <button
              type="button"
              className="more-button"
              onClick={() => updateNote({ archived: !selectedNote.archived })}
              aria-label={selectedNote.archived ? 'Unarchive note' : 'Archive note'}
              title={selectedNote.archived ? 'Unarchive note' : 'Archive note'}
            >
              {selectedNote.archived ? <ArchiveRestore size={20} /> : <Archive size={20} />}
            </button>
            <button
              type="button"
              className="more-button notes-delete-action"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Delete note"
              title="Delete note"
            >
              <Trash2 size={19} />
            </button>
          </div>
        </header>

        <section className="notes-editor">
          {error ? <p className="notes-error" role="alert">{error}</p> : null}
          <input
            className="notes-title-input"
            value={selectedNote.title}
            onChange={(event) => updateNote({ title: event.target.value })}
            placeholder="Title"
            aria-label="Note title"
          />
          <textarea
            className="notes-body-input"
            value={selectedNote.body}
            onChange={(event) => updateNote({ body: event.target.value })}
            placeholder="Write a note…"
            aria-label="Note"
          />
          <p className="notes-updated-label">Edited {formatUpdatedAt(selectedNote.updatedAt)}</p>
        </section>

        <ConfirmDialog
          open={showDeleteConfirm}
          titleId="delete-note-title"
          title="Delete this note?"
          description="This note will be permanently deleted from this device."
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      </main>
    );
  }

  return (
    <main className="notes-shell">
      <header className="notes-list-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="Back to Analytics">
          <ArrowLeft size={22} />
        </button>
        <h1>Notes</h1>
        <button
          type="button"
          className="more-button"
          onClick={createNote}
          aria-label="Create note"
          title="Create note"
          disabled={isLoading || Boolean(error)}
        >
          <Plus size={22} />
        </button>
      </header>

      <label className="notes-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search notes"
          aria-label="Search notes"
        />
      </label>

      <div className="notes-view-switch" role="group" aria-label="Note view">
        <button type="button" className={!showArchived ? 'active' : ''} onClick={() => setShowArchived(false)}>Notes</button>
        <button type="button" className={showArchived ? 'active' : ''} onClick={() => setShowArchived(true)}>Archived</button>
      </div>

      {error ? <p className="notes-error" role="alert">{error}</p> : null}
      {isLoading ? (
        <p className="notes-loading" role="status">Loading notes…</p>
      ) : visibleNotes.length ? (
        <section className="notes-grid" aria-label={showArchived ? 'Archived notes' : 'Your notes'}>
          {visibleNotes.map((note) => (
            <button
              type="button"
              className="note-card"
              key={note.id}
              onClick={() => setSelectedNoteId(note.id)}
              aria-label={`Open ${note.title || 'Untitled note'}`}
            >
              <span className="note-card-heading">
                <strong>{note.title || 'Untitled'}</strong>
                {note.pinned ? <Pin size={15} aria-label="Pinned" /> : null}
              </span>
              <span className="note-card-preview">{notePreview(note.body) || 'No additional text'}</span>
              <span className="note-card-date">{formatUpdatedAt(note.updatedAt)}</span>
            </button>
          ))}
        </section>
      ) : (
        <div className="notes-empty-state">
          <EmptyState>
            <FileText size={28} aria-hidden="true" />
            <span>{search ? 'No notes match your search.' : showArchived ? 'Archived notes will appear here.' : 'Capture an idea or make a quick note.'}</span>
            {!search && !showArchived ? (
              <button type="button" className="link-button" onClick={createNote} disabled={Boolean(error)}>Create your first note</button>
            ) : null}
          </EmptyState>
        </div>
      )}
    </main>
  );
}
