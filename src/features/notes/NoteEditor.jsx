import { useEffect, useRef } from 'react';
import {
  Bold,
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2
} from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';

const toolbarActions = [
  { label: 'Heading 1', icon: Heading1, run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2', icon: Heading2, run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3', icon: Heading3, run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Bold', icon: Bold, run: (editor) => editor.chain().focus().toggleBold().run() },
  { label: 'Italic', icon: Italic, run: (editor) => editor.chain().focus().toggleItalic().run() },
  { label: 'Underline', icon: UnderlineIcon, run: (editor) => editor.chain().focus().toggleUnderline().run() },
  { label: 'Strikethrough', icon: Strikethrough, run: (editor) => editor.chain().focus().toggleStrike().run() },
  { label: 'Bulleted list', icon: List, run: (editor) => editor.chain().focus().toggleBulletList().run() },
  { label: 'Numbered list', icon: ListOrdered, run: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { label: 'Checklist', icon: CheckSquare, run: (editor) => editor.chain().focus().toggleTaskList().run() },
  { label: 'Quote', icon: Quote, run: (editor) => editor.chain().focus().toggleBlockquote().run() },
  { label: 'Inline code', icon: Code2, run: (editor) => editor.chain().focus().toggleCode().run() }
];

const activeStates = {
  'Heading 1': (editor) => editor.isActive('heading', { level: 1 }),
  'Heading 2': (editor) => editor.isActive('heading', { level: 2 }),
  'Heading 3': (editor) => editor.isActive('heading', { level: 3 }),
  Bold: (editor) => editor.isActive('bold'),
  Italic: (editor) => editor.isActive('italic'),
  Underline: (editor) => editor.isActive('underline'),
  Strikethrough: (editor) => editor.isActive('strike'),
  'Bulleted list': (editor) => editor.isActive('bulletList'),
  'Numbered list': (editor) => editor.isActive('orderedList'),
  Checklist: (editor) => editor.isActive('taskList'),
  Quote: (editor) => editor.isActive('blockquote'),
  'Inline code': (editor) => editor.isActive('code')
};

function getEditorContent(note) {
  if (note.content?.type === 'doc') return note.content;
  const paragraphs = (note.body || '').split('\n').map((line) => ({
    type: 'paragraph',
    ...(line ? { content: [{ type: 'text', text: line }] } : {})
  }));
  return { type: 'doc', content: paragraphs.length ? paragraphs : [{ type: 'paragraph' }] };
}

function moveCompletedTasksToBottom(node) {
  let changed = false;
  const content = node.content?.map((child) => {
    const result = moveCompletedTasksToBottom(child);
    if (result !== child) changed = true;
    return result;
  });
  let nextContent = content;
  if (node.type === 'taskList' && content) {
    nextContent = [
      ...content.filter((item) => !item.attrs?.checked),
      ...content.filter((item) => item.attrs?.checked)
    ];
    if (nextContent.some((item, index) => item !== content[index])) changed = true;
  }
  return changed ? { ...node, content: nextContent } : node;
}

export function NoteEditor({ note, onChange }) {
  const onChangeRef = useRef(onChange);
  const draggedTaskPosition = useRef(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true, HTMLAttributes: { draggable: 'true' } })
    ],
    content: getEditorContent(note),
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      const currentContent = currentEditor.getJSON();
      const reorderedContent = moveCompletedTasksToBottom(currentContent);
      if (reorderedContent !== currentContent) {
        currentEditor.commands.setContent(reorderedContent, { emitUpdate: false });
      }
      onChangeRef.current({
        content: currentEditor.getJSON(),
        body: currentEditor.getText({ blockSeparator: '\n' })
      });
    }
  }, [note.id]);

  useEffect(() => {
    if (!editor) return;
    const incoming = getEditorContent(note);
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(incoming)) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [editor, note.content, note.body]);

  if (!editor) return <div className="notes-editor-loading" role="status">Opening editor…</div>;

  return (
    <div className="notes-rich-editor">
      <div className="notes-format-toolbar" role="toolbar" aria-label="Note formatting">
        {toolbarActions.map(({ label, icon: Icon, run }) => (
          <button
            type="button"
            className="notes-format-button"
            key={label}
            aria-label={label}
            aria-pressed={activeStates[label](editor)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(editor)}
          >
            <Icon size={17} aria-hidden="true" />
          </button>
        ))}
        <span className="notes-format-divider" aria-hidden="true" />
        <button
          type="button"
          className="notes-format-button"
          aria-label="Undo"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo2 size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="notes-format-button"
          aria-label="Redo"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo2 size={17} aria-hidden="true" />
        </button>
      </div>
      <EditorContent
        editor={editor}
        className="notes-rich-content"
        aria-label="Note content"
        onDragStart={(event) => {
          const taskItem = event.target.closest('li[data-type="taskItem"]');
          if (!taskItem) return;
          let foundPosition = null;
          editor.state.doc.descendants((node, position) => {
            if (node.type.name === 'taskItem' && editor.view.nodeDOM(position) === taskItem) {
              foundPosition = position;
              return false;
            }
            return true;
          });
          draggedTaskPosition.current = foundPosition;
          if (foundPosition !== null) event.dataTransfer?.setData('text/plain', 'task-item');
        }}
        onDragOver={(event) => {
          if (draggedTaskPosition.current !== null && event.target.closest('li[data-type="taskItem"]')) {
            event.preventDefault();
          }
        }}
        onDrop={(event) => {
          const taskItem = event.target.closest('li[data-type="taskItem"]');
          const sourcePosition = draggedTaskPosition.current;
          draggedTaskPosition.current = null;
          if (!taskItem || sourcePosition === null) return;
          event.preventDefault();
          let targetPosition = null;
          editor.state.doc.descendants((node, position) => {
            if (node.type.name === 'taskItem' && editor.view.nodeDOM(position) === taskItem) {
              targetPosition = position;
              return false;
            }
            return true;
          });
          const sourceNode = editor.state.doc.nodeAt(sourcePosition);
          if (targetPosition === null || !sourceNode || sourcePosition === targetPosition) return;
          const insertPosition = sourcePosition < targetPosition
            ? targetPosition - sourceNode.nodeSize
            : targetPosition;
          const transaction = editor.state.tr
            .delete(sourcePosition, sourcePosition + sourceNode.nodeSize)
            .insert(insertPosition, sourceNode);
          editor.view.dispatch(transaction);
        }}
      />
    </div>
  );
}
