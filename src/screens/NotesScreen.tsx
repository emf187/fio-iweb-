import { useMemo, useState } from 'react'
import { useFio, update } from '../lib/store'
import { uid, type Note } from '../lib/types'
import { Card, Empty, Markdown, Modal, ScreenHeader, TextField, Badge } from '../ui/components'
import { IconAdd, IconCheck, IconClose, IconNote, IconTrash } from '../ui/icons'
import { formatDateWeb } from '../lib/format'

export function NotesScreen() {
  const state = useFio()
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [folderFilter, setFolderFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [moveDialog, setMoveDialog] = useState(false)

  const folders = useMemo(() =>
    ['All', ...state.noteFolders], [state.noteFolders])

  const notes = useMemo(() => {
    let list = [...state.notes].sort((a, b) => b.updatedAtMillis - a.updatedAtMillis)
    if (folderFilter !== 'All') list = list.filter((n) => n.folder === folderFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    }
    return list
  }, [state.notes, folderFilter, query])

  const open = openId ? state.notes.find((n) => n.id === openId) : null

  const toggleSelected = (id: string) => {
    setSelectedIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])
  }

  const bulkDelete = () => {
    if (!confirm(`Delete ${selectedIds.length} note(s)? This cannot be undone.`)) return
    const drop = new Set(selectedIds)
    update((s) => ({ ...s, notes: s.notes.filter((n) => !drop.has(n.id)) }))
    setSelectedIds([])
    setSelectMode(false)
  }

  const bulkMove = (folder: string) => {
    const ids = new Set(selectedIds)
    update((s) => ({
      ...s,
      noteFolders: folder && !s.noteFolders.includes(folder) ? [...s.noteFolders, folder] : s.noteFolders,
      notes: s.notes.map((n) => ids.has(n.id) ? { ...n, folder, updatedAtMillis: Date.now() } : n)
    }))
    setSelectedIds([])
    setMoveDialog(false)
  }

  return (
    <div className="screen">
      <ScreenHeader
        title="Notes"
        subtitle={`${state.notes.length} notes · markdown-friendly`}
        action={
          <button className="icon-btn" onClick={() => setCreating(true)} aria-label="New note">
            <IconAdd />
          </button>
        }
      />

      <Card>
        <input className="input" placeholder="Search notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {state.noteFolders.length > 0 && (
          <div className="chip-row" style={{ marginTop: 10 }}>
            {folders.map((f) => (
              <button key={f} className={`chip ${folderFilter === f ? 'selected' : ''}`} onClick={() => setFolderFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
          <button className="text-btn" onClick={() => { setSelectMode(!selectMode); setSelectedIds([]) }}>
            {selectMode ? 'Done' : 'Select'}
          </button>
        </div>

        {selectedIds.length > 0 && (
          <div className="card elevated" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 0 }}>
            <strong style={{ flex: 1 }}>{selectedIds.length} selected</strong>
            <button className="text-btn" onClick={() => setSelectedIds(notes.map((n) => n.id))}>All</button>
            <button className="btn small" onClick={() => setMoveDialog(true)}>Move</button>
            <button className="btn danger-text small" onClick={bulkDelete}>
              <IconTrash width={15} height={15} /> Delete
            </button>
            <button className="icon-btn" aria-label="Clear selection" onClick={() => setSelectedIds([])}>
              <IconClose width={16} height={16} />
            </button>
          </div>
        )}

        {notes.length === 0 && <Empty>{query ? 'No matching notes.' : 'No notes yet. Tap + to write one.'}</Empty>}
        {notes.map((n) => {
          const isSelected = selectedIds.includes(n.id)
          return (
            <div className="row-item" key={n.id}
              style={{ borderRadius: 10, outline: isSelected ? '2px solid var(--accent-strong)' : undefined }}>
              <div className="row-main" style={{ cursor: 'pointer' }}
                onClick={() => selectMode ? toggleSelected(n.id) : setOpenId(n.id)}>
                <div className="row-title">{n.title || 'Untitled'}</div>
                <div className="row-sub">
                  {formatDateWeb(n.updatedAtMillis)}
                  {n.folder ? ` · ${n.folder}` : ''}
                  {n.tags.length ? ` · ${n.tags.join(', ')}` : ''}
                </div>
              </div>
              {isSelected && <IconCheck width={16} height={16} style={{ color: 'var(--accent-strong)' }} />}
              {!selectMode && (
                <button className="icon-btn" aria-label="Delete note"
                  onClick={() => {
                    if (confirm(`Delete "${n.title || 'Untitled'}"?`)) {
                      update((s) => ({ ...s, notes: s.notes.filter((x) => x.id !== n.id) }))
                    }
                  }}>
                  <IconTrash width={18} height={18} />
                </button>
              )}
            </div>
          )
        })}
      </Card>

      {moveDialog && (
        <Modal title={`Move ${selectedIds.length} note(s)`} onClose={() => setMoveDialog(false)}>
          <div className="row-sub" style={{ marginTop: 0 }}>Choose a folder:</div>
          <div className="chip-row">
            <button className="chip" onClick={() => bulkMove('')}>Unfiled</button>
            {state.noteFolders.map((f) => (
              <button key={f} className="chip" onClick={() => bulkMove(f)}>{f}</button>
            ))}
          </div>
        </Modal>
      )}

      {creating && <NoteEditor note={null} onClose={() => setCreating(false)} />}
      {open && <NoteViewer note={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function NoteViewer({ note, onClose }: { note: Note; onClose: () => void }) {
  const [editing, setEditing] = useState(false)
  if (editing) return <NoteEditor note={note} onClose={() => setEditing(false)} onCloseViewer={onClose} />
  return (
    <Modal title={note.title || 'Untitled'} onClose={onClose}>
      {note.folder && <Badge tone="accent">{note.folder}</Badge>}
      {note.tags.map((t) => <Badge key={t} tone="info" >{t}</Badge>)}
      <div style={{ marginTop: 12 }}>
        {note.content.trim() === ''
          ? <Empty>Empty note.</Empty>
          : <Markdown text={note.content} />}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={() => setEditing(true)}>Edit</button>
      </div>
    </Modal>
  )
}

function NoteEditor({ note, onClose, onCloseViewer }: {
  note: Note | null
  onClose: () => void
  onCloseViewer?: () => void
}) {
  const state = useFio()
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [folder, setFolder] = useState(note?.folder ?? '')
  const [tags, setTags] = useState((note?.tags ?? []).join(', '))
  const [preview, setPreview] = useState(false)

  const save = () => {
    const now = Date.now()
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
    if (folder.trim() && !state.noteFolders.includes(folder.trim())) {
      update((s) => ({ ...s, noteFolders: [...s.noteFolders, folder.trim()] }))
    }
    if (note) {
      update((s) => ({
        ...s,
        notes: s.notes.map((x) => x.id === note.id
          ? { ...x, title: title.trim(), content, folder: folder.trim(), tags: tagList, updatedAtMillis: now }
          : x)
      }))
    } else {
      const n: Note = {
        id: uid(), title: title.trim(), content,
        courseId: '', folder: folder.trim(), tags: tagList, imageUris: [],
        createdAtMillis: now, updatedAtMillis: now
      }
      update((s) => ({ ...s, notes: [...s.notes, n] }))
    }
    onCloseViewer?.()
    onClose()
  }

  return (
    <Modal title={note ? 'Edit note' : 'New note'} onClose={onClose}>
      <TextField label="Title" value={title} onChange={setTitle} placeholder="Note title" />
      <div className="field">
        <label>Content (markdown)</label>
        {preview
          ? <div className="card elevated" style={{ marginTop: 0, minHeight: 120 }}><Markdown text={content || '_Nothing yet_'} /></div>
          : <textarea className="input" style={{ minHeight: 160 }} value={content}
              placeholder={'Write freely. **bold**, lists, # headings work.'}
              onChange={(e) => setContent(e.target.value)} />}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn ghost small" onClick={() => setPreview(!preview)}>
          <IconNote width={14} height={14} /> {preview ? 'Edit' : 'Preview'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="field">
          <label>Folder</label>
          <input className="input" list="fio-folders" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Optional" />
          <datalist id="fio-folders">
            {state.noteFolders.map((f) => <option key={f} value={f} />)}
          </datalist>
        </div>
        <div className="field">
          <label>Tags</label>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" />
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Modal>
  )
}
