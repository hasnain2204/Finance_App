import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, ArchiveRestore, ArrowLeft, AudioLines, Download, FileText, History, ImagePlus,
  LayoutGrid, List as ListIcon, Palette, Paperclip, Pin, Plus, Search, Sparkles, Tag, Trash2, Undo2, X
} from 'lucide-react';
import { ConfirmDialog, EmptyState } from '../../components/ui';
import { notesRepository } from '../../services/notesRepository';
const NoteEditor = lazy(() => import('./NoteEditor').then((module) => ({ default: module.NoteEditor })));
const SketchPad = lazy(() => import('./SketchPad').then((module) => ({ default: module.SketchPad })));

function createNoteId() {
  return globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function notePreview(body, maxWords = 60) {
  const words = body.trim().split(/\s+/).filter(Boolean);
  return words.length > maxWords ? `${words.slice(0, maxWords).join(' ')}…` : words.join(' ');
}

const noteColors = ['default', 'green', 'blue', 'yellow', 'pink', 'purple'];
const labelColors = ['green', 'blue', 'yellow', 'pink', 'purple'];

function formatUpdatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const builtInTemplates = [
  {
    id: 'template-meeting-notes',
    name: 'Meeting notes',
    title: 'Meeting notes',
    body: 'Attendees:\n\nAgenda:\n\nDiscussion:\n\nDecisions:\n\nNext steps:',
    content: null
  },
  {
    id: 'template-daily-checklist',
    name: 'Daily checklist',
    title: 'Daily checklist',
    body: '- [ ] Top priority\n- [ ] Follow up\n- [ ] Review the day',
    content: {
      type: 'doc',
      content: [{
        type: 'taskList',
        content: ['Top priority', 'Follow up', 'Review the day'].map((text) => ({
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
        }))
      }]
    }
  }
];

export function NotesScreen({ onBack, repository = notesRepository }) {
  const [notes, setNotes] = useState([]);
  const notesRef = useRef([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trash, setTrash] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tagFilter, setTagFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [attachmentFilter, setAttachmentFilter] = useState('');
  const [layout, setLayout] = useState('grid');
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSketch, setShowSketch] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [colorNoteId, setColorNoteId] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('green');
  const attachmentInputRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingTimeoutRef = useRef(null);

  useEffect(() => {
    try {
      const savedNotes = repository.list();
      notesRef.current = savedNotes;
      setNotes(savedNotes);
      setTrash(repository.listTrash());
      setTemplates([...builtInTemplates, ...repository.listTemplates()]);
    } catch (loadError) {
      setError(loadError?.message || 'Saved notes could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  useEffect(() => () => {
    window.clearTimeout(recordingTimeoutRef.current);
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
    recorder?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  const selectedNote = notes.find((note) => note.id === selectedNoteId) || null;
  const visibleNotes = useMemo(() => (showTrash ? trash : notes)
    .filter((note) => showTrash
      ? Boolean(note.deletedAt)
      : !note.deletedAt && Boolean(note.archived) === showArchived)
    .filter((note) => !tagFilter || (note.tags || []).includes(tagFilter))
    .filter((note) => !folderFilter || note.folder === folderFilter)
    .filter((note) => !colorFilter || (note.color || 'default') === colorFilter)
    .filter((note) => !dateFilter || new Date(note.updatedAt).getTime() >= Date.now() - Number(dateFilter) * 24 * 60 * 60 * 1000)
    .filter((note) => !attachmentFilter || (note.attachments || []).some((attachment) => attachment.type.startsWith(attachmentFilter)))
    .filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
      String(b.updatedAt).localeCompare(String(a.updatedAt))), [
      notes, trash, search, showArchived, showTrash, tagFilter, folderFilter, colorFilter, dateFilter, attachmentFilter
    ]);

  const persistNote = (note) => {
    try {
      repository.save(note);
      const index = notesRef.current.findIndex((item) => item.id === note.id);
      notesRef.current = index < 0
        ? [note, ...notesRef.current]
        : notesRef.current.map((item) => item.id === note.id ? note : item);
      setNotes(notesRef.current);
      setError('');
      return true;
    } catch (saveError) {
      setError(saveError?.message || 'Your note could not be saved.');
      return false;
    }
  };

  const createNote = () => {
    const now = new Date().toISOString();
    const note = {
      id: createNoteId(),
      title: '',
      body: '',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      tags: [],
      folder: '',
      color: 'default',
      emoji: '',
      pinned: false,
      archived: false,
      createdAt: now,
      updatedAt: now
    };
    if (persistNote(note)) setSelectedNoteId(note.id);
  };

  const updateNote = (updates) => {
    if (!selectedNote) return;
    const currentNote = notesRef.current.find((note) => note.id === selectedNote.id) || selectedNote;
    persistNote({ ...currentNote, ...updates, updatedAt: new Date().toISOString() });
  };

  const addAttachment = (attachment) => {
    if (attachment.data.length > 1_000_000) {
      setError('This attachment is too large for local notes. Choose a file under 750 KB.');
      return false;
    }
    const currentNote = notesRef.current.find((note) => note.id === selectedNote.id) || selectedNote;
    return persistNote({
      ...currentNote,
      attachments: [...(currentNote.attachments || []), attachment],
      updatedAt: new Date().toISOString()
    });
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The selected file could not be read.'));
    reader.readAsDataURL(file);
  });

  const handleAttachmentSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    for (const file of files) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('audio/') && file.type !== 'application/pdf') {
        setError(`${file.name} is not a supported image, audio recording, or PDF.`);
        continue;
      }
      if (file.size > 750 * 1024) {
        setError(`${file.name} is too large. Attachments must be under 750 KB.`);
        continue;
      }
      try {
        const saved = addAttachment({
          id: createNoteId(),
          name: file.name,
          type: file.type || 'application/octet-stream',
          data: await readFileAsDataUrl(file),
          createdAt: new Date().toISOString()
        });
        if (!saved) continue;
      } catch (attachmentError) {
        setError(attachmentError?.message || 'The attachment could not be added.');
      }
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      window.clearTimeout(recordingTimeoutRef.current);
      recorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      setError('Audio recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => setError('Audio recording failed. Check microphone permissions and try again.');
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) return;
        try {
          addAttachment({
            id: createNoteId(),
            name: `Audio recording ${new Date().toLocaleString()}`,
            type: blob.type,
            data: await readFileAsDataUrl(blob),
            createdAt: new Date().toISOString()
          });
        } catch (recordingError) {
          setError(recordingError?.message || 'The recording could not be saved.');
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 60_000);
      setError('');
    } catch (recordingError) {
      setError(recordingError?.message || 'Microphone access was denied or unavailable.');
    }
  };

  const transcribeVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice transcription is not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join(' ').trim();
      if (text) updateNote({ body: [selectedNote.body, text].filter(Boolean).join('\n'), content: null });
    };
    recognition.onerror = () => setError('Voice transcription failed. Check microphone permissions and try again.');
    recognition.start();
  };

  const saveSketch = (data) => {
    const saved = addAttachment({
      id: createNoteId(),
      name: `Sketch ${new Date().toLocaleString()}.png`,
      type: 'image/png',
      data,
      createdAt: new Date().toISOString()
    });
    setShowSketch(false);
    return saved;
  };

  const addLabel = () => {
    const label = newLabel.trim().replace(/^#/, '');
    if (!label || !selectedNote) return;
    updateNote({
      tags: [...new Set([...(selectedNote.tags || []), label])],
      tagColors: { ...(selectedNote.tagColors || {}), [label]: newLabelColor }
    });
    setNewLabel('');
  };

  const changeNoteColor = (note, color) => {
    const updatedNote = { ...note, color, updatedAt: new Date().toISOString() };
    if (persistNote(updatedNote)) setColorNoteId(null);
  };

  const removeAttachment = (id) => {
    updateNote({ attachments: (selectedNote.attachments || []).filter((attachment) => attachment.id !== id) });
  };

  const handleDelete = () => {
    if (!selectedNote) return;
    try {
      repository.delete(selectedNote.id);
      notesRef.current = notesRef.current.filter((note) => note.id !== selectedNote.id);
      setNotes(notesRef.current);
      setTrash((current) => [{ ...selectedNote, deletedAt: new Date().toISOString() }, ...current]);
      setSelectedNoteId(null);
      setShowDeleteConfirm(false);
      setError('');
    } catch (deleteError) {
      setError(deleteError?.message || 'The note could not be deleted.');
      setShowDeleteConfirm(false);
    }
  };

  const handleRestore = (note) => {
    try {
      const restored = repository.restore(note.id);
      if (restored) {
        setTrash((current) => current.filter((item) => item.id !== note.id));
        notesRef.current = [restored, ...notesRef.current];
        setNotes(notesRef.current);
      }
      setError('');
    } catch (restoreError) {
      setError(restoreError?.message || 'The note could not be restored.');
    }
  };

  const handleExport = async (format) => {
    if (!selectedNote) return;
    const text = selectedNote.body || '';
    if (format === 'pdf') {
      try {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF();
        let y = 20;
        pdf.setFontSize(18);
        pdf.text(selectedNote.title || 'Untitled note', 18, y);
        pdf.setFontSize(11);
        for (const line of pdf.splitTextToSize(text, 174)) {
          y += 6;
          if (y > 278) {
            pdf.addPage();
            y = 18;
          }
          pdf.text(line, 18, y);
        }
        pdf.save(`${selectedNote.title.trim() || 'note'}.pdf`);
        setShowDownloadOptions(false);
        return;
      } catch (exportError) {
        setError(exportError?.message || 'The PDF could not be created.');
        return;
      }
    }
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedNote.title.trim() || 'note'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setShowDownloadOptions(false);
  };

  const loadHistory = () => {
    try {
      setRevisions(repository.listRevisions(selectedNote.id));
      setShowHistory((current) => !current);
      setError('');
    } catch (historyError) {
      setError(historyError?.message || 'Note history could not be loaded.');
    }
  };

  const restoreRevision = (revision) => {
    updateNote({ title: revision.title, body: revision.body, content: revision.content });
    setShowHistory(false);
  };

  const createTemplate = () => {
    const name = window.prompt('Name this template');
    if (!name?.trim()) return;
    try {
      const template = {
        id: createNoteId(),
        name: name.trim(),
        title: selectedNote.title,
        body: selectedNote.body,
        content: selectedNote.content || null
      };
      repository.saveTemplate(template);
      setTemplates([...builtInTemplates, ...repository.listTemplates()]);
      setError('');
    } catch (templateError) {
      setError(templateError?.message || 'The template could not be saved.');
    }
  };

  const applyTemplate = (templateId) => {
    const template = templates.find((item) => item.id === templateId);
    if (template) updateNote({ title: template.title, body: template.body, content: template.content });
  };

  const allTags = useMemo(() => [...new Set(notes.flatMap((note) => note.tags || []))].sort(), [notes]);
  const allFolders = useMemo(() => [...new Set(notes.map((note) => note.folder).filter(Boolean))].sort(), [notes]);

  if (selectedNote && showSketch) {
    return (
      <Suspense fallback={<main className="notes-sketch-page"><p role="status">Opening sketch pad…</p></main>}>
        <SketchPad onSave={saveSketch} />
      </Suspense>
    );
  }

  if (selectedNote) {
    return (
      <main className="notes-shell">
        <header className="notes-editor-header">
          <button type="button" className="back-button" onClick={() => setSelectedNoteId(null)} aria-label="Back to notes">
            <ArrowLeft size={22} />
          </button>
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
            <button type="button" className="more-button" onClick={loadHistory} aria-label="Note history" title="Note history">
              <History size={19} />
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
          <div className="notes-metadata-row">
            <details className="notes-label-menu">
              <summary role="button" aria-label="Manage note labels">
                <Tag size={16} aria-hidden="true" />
                <span>{selectedNote.tags?.length ? selectedNote.tags.map((tag) => `#${tag}`).join(' ') : 'Labels'}</span>
              </summary>
              <div className="notes-label-popover">
                {(selectedNote.tags || []).length ? (
                  <div className="notes-label-list">
                    {selectedNote.tags.map((label) => (
                      <span className={`notes-label-chip note-label-${selectedNote.tagColors?.[label] || 'green'}`} key={label}>
                        #{label}
                        <button
                          type="button"
                          aria-label={`Remove label ${label}`}
                          onClick={() => updateNote({ tags: selectedNote.tags.filter((item) => item !== label) })}
                        ><X size={13} /></button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="notes-label-color-options" role="group" aria-label="Label color">
                  {labelColors.map((color) => (
                    <button
                      type="button"
                      key={color}
                      className={`notes-color-dot note-color-dot-${color} ${newLabelColor === color ? 'selected' : ''}`}
                      onClick={() => setNewLabelColor(color)}
                      aria-label={`${color} label color`}
                      aria-pressed={newLabelColor === color}
                    />
                  ))}
                </div>
                <div className="notes-add-label">
                  <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} aria-label="New label name" placeholder="Label name" />
                  <button type="button" onClick={addLabel} disabled={!newLabel.trim()}>Add</button>
                </div>
              </div>
            </details>
            <label className="notes-metadata-input">
              <input
                value={selectedNote.folder || ''}
                onChange={(event) => updateNote({ folder: event.target.value })}
                aria-label="Folder"
                placeholder="Notebook / folder"
              />
            </label>
          </div>
          <div className="notes-template-tools">
            <select
              aria-label="Apply note template"
              value=""
              onChange={(event) => applyTemplate(event.target.value)}
            >
              <option value="">Templates</option>
              {templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}
            </select>
            <button type="button" className="link-button" onClick={createTemplate}>Save as template</button>
          </div>
          <input
            className="notes-title-input"
            value={selectedNote.title}
            onChange={(event) => updateNote({ title: event.target.value })}
            placeholder="Title"
            aria-label="Note title"
          />
          <Suspense fallback={<div className="notes-editor-loading" role="status">Opening editor…</div>}>
            <NoteEditor
              key={selectedNote.id}
              note={selectedNote}
              onChange={updateNote}
            />
          </Suspense>
          {(selectedNote.attachments || []).length ? (
            <section className="notes-attachments" aria-label="Note attachments">
              <h2>Attachments</h2>
              {(selectedNote.attachments || []).map((attachment) => (
                <article className="notes-attachment" key={attachment.id}>
                  {attachment.type.startsWith('image/') ? (
                    <a href={attachment.data} target="_blank" rel="noreferrer" aria-label={`Open ${attachment.name}`}>
                      <img src={attachment.data} alt={attachment.name} />
                    </a>
                  ) : attachment.type.startsWith('audio/') ? (
                    <audio controls src={attachment.data} aria-label={attachment.name} />
                  ) : (
                    <a href={attachment.data} target="_blank" rel="noreferrer">{attachment.name}</a>
                  )}
                  <button type="button" className="link-button notes-remove-attachment" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.name}`}>Remove</button>
                </article>
              ))}
            </section>
          ) : null}
          {(() => {
            const candidate = selectedNote.body.match(/https?:\/\/[^\s]+/)?.[0];
            if (!candidate) return null;
            try {
              const url = new URL(candidate);
              if (!['http:', 'https:'].includes(url.protocol)) return null;
              return (
                <a className="notes-link-preview" href={url.href} target="_blank" rel="noreferrer">
                  <strong>{url.hostname}</strong>
                  <span>{url.href}</span>
                </a>
              );
            } catch {
              return null;
            }
          })()}
          <p className="notes-updated-label">Edited {formatUpdatedAt(selectedNote.updatedAt)}</p>
          <div className="notes-editor-tools" role="group" aria-label="Note actions">
            <input
              ref={attachmentInputRef}
              className="visually-hidden"
              type="file"
              accept="image/*,application/pdf,audio/*"
              multiple
              onChange={handleAttachmentSelect}
              aria-label="Choose note attachments"
            />
            <button type="button" className="notes-tool-icon" onClick={() => attachmentInputRef.current?.click()} aria-label="Attach" title="Attach">
              <Paperclip size={18} />
            </button>
            <button type="button" className="notes-tool-icon" onClick={() => setShowSketch(true)} aria-label="Sketch" title="Sketch">
              <ImagePlus size={18} />
            </button>
            <button type="button" className={`notes-tool-icon ${isRecording ? 'active' : ''}`} onClick={toggleRecording} aria-label={isRecording ? 'Stop recording' : 'Record audio'} title={isRecording ? 'Stop recording' : 'Record audio'}>
              <AudioLines size={18} />
            </button>
            <button type="button" className="notes-tool-icon" onClick={transcribeVoice} aria-label="Dictate" title="Dictate">
              <Sparkles size={18} />
            </button>
            <button type="button" className="notes-tool-icon" onClick={() => setShowDownloadOptions(true)} aria-label="Download note" title="Download">
              <Download size={18} />
            </button>
          </div>
          {showHistory ? (
            <section className="notes-history-panel" aria-label="Note revision history">
              <h2>Revision history</h2>
              {revisions.length ? revisions.map((revision) => (
                <article className="notes-history-item" key={revision.id}>
                  <span>{formatUpdatedAt(revision.createdAt)} · {revision.title || 'Untitled'}</span>
                  <button type="button" className="link-button" onClick={() => restoreRevision(revision)}>
                    <Undo2 size={15} /> Restore
                  </button>
                </article>
              )) : <p>No earlier revisions yet. Revisions are captured periodically while you edit.</p>}
            </section>
          ) : null}
        </section>

        <ConfirmDialog
          open={showDeleteConfirm}
          titleId="delete-note-title"
          title="Move this note to Trash?"
          description="You can restore this note for 30 days before it is permanently deleted."
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
        {showDownloadOptions ? (
          <div className="notes-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDownloadOptions(false); }}>
            <section className="notes-download-dialog" role="dialog" aria-modal="true" aria-labelledby="notes-download-title">
              <h2 id="notes-download-title">Download note</h2>
              <p>Choose a format</p>
              <button type="button" onClick={() => handleExport('text')}>Text (.txt)</button>
              <button type="button" onClick={() => handleExport('pdf')}>PDF (.pdf)</button>
              <button type="button" className="link-button" onClick={() => setShowDownloadOptions(false)}>Cancel</button>
            </section>
          </div>
        ) : null}
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
        <button type="button" className={!showArchived && !showTrash ? 'active' : ''} onClick={() => { setShowArchived(false); setShowTrash(false); }}>Notes</button>
        <button type="button" className={showArchived ? 'active' : ''} onClick={() => { setShowArchived(true); setShowTrash(false); }}>Archived</button>
        <button type="button" className={showTrash ? 'active' : ''} onClick={() => { setShowArchived(false); setShowTrash(true); }}>Trash</button>
        <button type="button" className={layout === 'grid' ? 'active notes-layout-toggle' : 'notes-layout-toggle'} onClick={() => setLayout((current) => current === 'grid' ? 'list' : 'grid')} aria-label={layout === 'grid' ? 'Switch to list view' : 'Switch to grid view'}>
          {layout === 'grid' ? <ListIcon size={17} /> : <LayoutGrid size={17} />}
        </button>
      </div>
      <label className="notes-tag-filter">
        <Tag size={15} aria-hidden="true" />
        <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} aria-label="Filter by tag">
          <option value="">All tags</option>
          {allTags.map((tag) => <option key={tag} value={tag}>#{tag}</option>)}
        </select>
      </label>
      <label className="notes-tag-filter">
        <select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)} aria-label="Filter by notebook">
          <option value="">All notebooks</option>
          {allFolders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
        </select>
      </label>
      <div className="notes-filter-row" role="group" aria-label="Additional note filters">
        <select value={colorFilter} onChange={(event) => setColorFilter(event.target.value)} aria-label="Filter by color">
          <option value="">All colors</option>
          {['green', 'blue', 'yellow', 'pink', 'purple'].map((color) => <option value={color} key={color}>{color[0].toUpperCase() + color.slice(1)}</option>)}
        </select>
        <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filter by date">
          <option value="">Any date</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="365">Last year</option>
        </select>
        <select value={attachmentFilter} onChange={(event) => setAttachmentFilter(event.target.value)} aria-label="Filter by attachment">
          <option value="">Any attachment</option>
          <option value="image/">Images</option>
          <option value="audio/">Audio</option>
          <option value="application/pdf">PDF files</option>
        </select>
      </div>

      {error ? <p className="notes-error" role="alert">{error}</p> : null}
      {isLoading ? (
        <p className="notes-loading" role="status">Loading notes…</p>
      ) : visibleNotes.length ? (
        <section className={`notes-grid ${layout === 'list' ? 'notes-list-layout' : ''}`} aria-label={showTrash ? 'Trash' : showArchived ? 'Archived notes' : 'Your notes'}>
          {visibleNotes.map((note) => (
            <article className={`note-card note-color-${note.color || 'default'}`} key={note.id}>
              <button
                type="button"
                className="note-card-open"
                onClick={() => setSelectedNoteId(note.id)}
                aria-label={`${showTrash ? 'View' : 'Open'} ${note.title || 'Untitled note'}`}
              >
              <span className="note-card-heading">
                <strong>{note.title || 'Untitled'}</strong>
                {note.pinned ? <Pin size={15} aria-label="Pinned" /> : null}
              </span>
              <span className="note-card-preview">{notePreview(note.body) || 'No additional text'}</span>
              {(note.tags || []).length ? <span className="note-card-tags">{note.tags.map((tag) => <span className={`note-card-tag note-label-${note.tagColors?.[tag] || 'green'}`} key={tag}>#{tag}</span>)}</span> : null}
              {note.folder ? <span className="note-card-folder">{note.folder}</span> : null}
              <span className="note-card-date">{formatUpdatedAt(note.updatedAt)}</span>
              </button>
              {!showTrash ? (
                <div className="note-card-color-menu">
                  <button type="button" className="note-card-color-trigger" aria-label={`Change color for ${note.title || 'Untitled note'}`} onClick={() => setColorNoteId(colorNoteId === note.id ? null : note.id)}>
                    <Palette size={16} />
                  </button>
                  {colorNoteId === note.id ? (
                    <div className="note-card-color-popover" role="group" aria-label="Note card color">
                      {noteColors.map((color) => (
                        <button
                          type="button"
                          key={color}
                          className={`notes-color-dot note-color-dot-${color} ${color === (note.color || 'default') ? 'selected' : ''}`}
                          aria-label={`${color} note color`}
                          aria-pressed={color === (note.color || 'default')}
                          onClick={() => changeNoteColor(note, color)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {showTrash ? <button type="button" className="link-button" onClick={() => handleRestore(note)}>Restore</button> : null}
            </article>
          ))}
        </section>
      ) : (
        <div className="notes-empty-state">
          <EmptyState>
            <FileText size={28} aria-hidden="true" />
            <span>{search ? 'No notes match your search.' : showTrash ? 'Trash is empty.' : showArchived ? 'Archived notes will appear here.' : 'Capture an idea or make a quick note.'}</span>
            {!search && !showArchived && !showTrash ? (
              <button type="button" className="link-button" onClick={createNote} disabled={Boolean(error)}>Create your first note</button>
            ) : null}
          </EmptyState>
        </div>
      )}
    </main>
  );
}
