import { useEffect, useMemo, useState } from 'react'
import { useFio, update } from '../lib/store'
import { uid, type GalleryPhoto } from '../lib/types'
import { deletePhoto, getPhoto, putPhoto } from '../lib/db'
import { Badge, Card, Empty, Modal, ScreenHeader } from '../ui/components'
import { IconAdd, IconCheck, IconClose, IconPhoto, IconTrash } from '../ui/icons'
import { formatDateWeb, formatTimestampWeb } from '../lib/format'

/**
 * Gallery — pictures you save for studying live here. Photos are imported
 * with the browser file picker and stored as blobs in IndexedDB; only their
 * metadata lives in the state document (and never in backup JSON, matching
 * the Android app, whose files travel separately).
 *
 * Folders (like Android): each photo carries a folder name; folders are also
 * kept in state.galleryFolders so an empty folder survives. Multi-select
 * moves or deletes several photos at once.
 */
export function GalleryScreen() {
  const state = useFio()
  const [importing, setImporting] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<GalleryPhoto | null>(null)
  const [renameTarget, setRenameTarget] = useState<GalleryPhoto | null>(null)
  const [renameInput, setRenameInput] = useState('')

  // null = All, '' = Unfiled, otherwise a folder name.
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [folderDialog, setFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [moveDialog, setMoveDialog] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const photos = useMemo(() =>
    [...state.photos].sort((a, b) => b.addedAtMillis - a.addedAtMillis),
  [state.photos])

  const folders = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    const all = [...state.galleryFolders, ...state.photos.map((p) => p.folder ?? ''), ...state.gallery.map((g) => g.folder ?? '')]
    for (const f of all) {
      const clean = (f ?? '').trim()
      if (!clean || seen.has(clean.toLowerCase())) continue
      seen.add(clean.toLowerCase())
      out.push(clean)
    }
    return out
  }, [state.galleryFolders, state.photos, state.gallery])

  const visiblePhotos = useMemo(() => {
    if (selectedFolder === null) return photos
    return photos.filter((p) => (p.folder ?? '') === selectedFolder)
  }, [photos, selectedFolder])

  // Android backup gallery entries have no bytes on web — listed but dimmed.
  const androidEntries = state.gallery.filter(
    (g) => !state.photos.some((p) => p.id === g.id)
  )

  const subtitle = photos.length === 0
    ? 'Pictures you save for studying live here.'
    : photos.length === 1
      ? '1 photo, stored on this device.'
      : `${photos.length} photos, stored on this device.`

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setImporting(true)
    const targetFolder = selectedFolder ?? ''
    const imported: GalleryPhoto[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const id = uid()
      await putPhoto(id, file)
      imported.push({
        id,
        displayName: file.name.replace(/\.[^.]+$/, ''),
        mimeType: file.type,
        folder: targetFolder,
        addedAtMillis: Date.now()
      })
    }
    if (imported.length > 0) {
      update((s) => ({ ...s, photos: [...imported, ...s.photos] }))
    }
    setImporting(false)
  }

  const remove = async (p: GalleryPhoto) => {
    await deletePhoto(p.id)
    update((s) => ({
      ...s,
      photos: s.photos.filter((x) => x.id !== p.id),
      gallery: s.gallery.filter((x) => x.id !== p.id)
    }))
    setPendingDelete(null)
  }

  const removeSelected = async () => {
    const ids = new Set(selectedIds)
    for (const id of selectedIds) await deletePhoto(id)
    update((s) => ({
      ...s,
      photos: s.photos.filter((x) => !ids.has(x.id)),
      gallery: s.gallery.filter((x) => !ids.has(x.id))
    }))
    setSelectedIds([])
  }

  const rename = () => {
    if (!renameTarget) return
    const name = renameInput.trim() || renameTarget.displayName
    update((s) => ({
      ...s,
      photos: s.photos.map((x) => x.id === renameTarget.id ? { ...x, displayName: name } : x)
    }))
    setRenameTarget(null)
  }

  const addFolder = () => {
    const name = newFolderName.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!name) return
    if (folders.some((f) => f.toLowerCase() === name.toLowerCase())) return
    update((s) => ({ ...s, galleryFolders: [...(s.galleryFolders ?? []), name] }))
    setNewFolderName('')
    setSelectedFolder(name)
    setFolderDialog(false)
  }

  const deleteFolder = (name: string) => {
    if (!confirm(`Delete "${name}"? Photos in it move back to Unfiled.`)) return
    update((s) => ({
      ...s,
      galleryFolders: (s.galleryFolders ?? []).filter((f) => f !== name),
      photos: s.photos.map((p) => (p.folder ?? '') === name ? { ...p, folder: '' } : p),
      gallery: s.gallery.map((g) => (g.folder ?? '') === name ? { ...g, folder: '' } : g)
    }))
    if (selectedFolder === name) setSelectedFolder(null)
  }

  const moveSelected = (folder: string) => {
    const ids = new Set(selectedIds)
    update((s) => {
      const nextFolders = folder && !(s.galleryFolders ?? []).some((f) => f.toLowerCase() === folder.toLowerCase())
        ? [...(s.galleryFolders ?? []), folder]
        : (s.galleryFolders ?? [])
      return {
        ...s,
        galleryFolders: nextFolders,
        photos: s.photos.map((p) => ids.has(p.id) ? { ...p, folder } : p),
        gallery: s.gallery.map((g) => ids.has(g.id) ? { ...g, folder } : g)
      }
    })
    setSelectedIds([])
    setMoveDialog(false)
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])
  }

  return (
    <div className="screen">
      <ScreenHeader
        title="Gallery"
        subtitle={subtitle}
        action={
          <label className="icon-btn" aria-label="Add photos" style={{ cursor: 'pointer' }}>
            <IconAdd />
            <input
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }}
            />
          </label>
        }
      />

      {selectedIds.length > 0 && (
        <Card className="elevated" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ flex: 1 }}>{selectedIds.length} selected</strong>
          <button className="text-btn" onClick={() => setSelectedIds(visiblePhotos.map((p) => p.id))}>All</button>
          <button className="btn small" onClick={() => setMoveDialog(true)}>
            <IconPhoto width={15} height={15} /> Move
          </button>
          <button className="btn danger-text small" onClick={() => {
            if (confirm(`Delete ${selectedIds.length} photo(s)? This cannot be undone.`)) void removeSelected()
          }}>
            <IconTrash width={15} height={15} /> Delete
          </button>
          <button className="icon-btn" aria-label="Clear selection" onClick={() => setSelectedIds([])}>
            <IconClose width={16} height={16} />
          </button>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="chip-row" style={{ flex: 1, marginTop: 0, overflowX: 'auto', flexWrap: 'nowrap' }}>
            {photos.length > 0 && (
              <>
                <button className={`chip ${selectedFolder === null ? 'selected' : ''}`}
                  onClick={() => setSelectedFolder(null)}>All {photos.length}</button>
                <button className={`chip ${selectedFolder === '' ? 'selected' : ''}`}
                  onClick={() => setSelectedFolder('')}>
                  Unfiled {photos.filter((p) => !(p.folder ?? '')).length}
                </button>
              </>
            )}
            {folders.map((f) => (
              <button key={f} className={`chip ${selectedFolder === f ? 'selected' : ''}`}
                onClick={() => setSelectedFolder(f)}>
                {f} {photos.filter((p) => (p.folder ?? '') === f).length}
              </button>
            ))}
          </div>
          <button className="icon-btn" aria-label="New folder" onClick={() => { setNewFolderName(''); setFolderDialog(true) }}>
            <IconAdd width={18} height={18} />
          </button>
        </div>
        {photos.length === 0 && folders.length === 0 && (
          <div className="row-sub" style={{ marginTop: 8 }}>Make a folder for each subject or topic.</div>
        )}
      </Card>

      {photos.length === 0 && androidEntries.length === 0 && (
        <Card>
          <Empty>Tap "Add photos" to store pictures for your study notes.</Empty>
        </Card>
      )}

      {photos.length > 0 && visiblePhotos.length === 0 && (
        <Card>
          <Empty>{selectedFolder === '' ? 'Nothing unfiled.' : 'This folder is empty. Import photos here or move some in.'}</Empty>
        </Card>
      )}

      {visiblePhotos.length > 0 && (
        <Card>
          <div className="photo-grid">
            {visiblePhotos.map((p) => (
              <PhotoTile key={p.id} photo={p}
                selected={selectedIds.includes(p.id)}
                selecting={selectedIds.length > 0}
                onToggleSelect={() => toggleSelected(p.id)}
                onOpen={() => { if (selectedIds.length > 0) toggleSelected(p.id); else setViewing(p.id) }}
                onDelete={() => setPendingDelete(p)}
                onRename={() => { setRenameTarget(p); setRenameInput(p.displayName) }} />
            ))}
          </div>
        </Card>
      )}

      {photos.length > 0 && androidEntries.length > 0 && (
        <Card title={`From Android backups (${androidEntries.length})`} icon={<IconPhoto width={16} height={16} />}>
          <div className="row-sub" style={{ marginTop: 0 }}>
            These photos live on your phone — their names travel with backups, the files don't.
          </div>
          {androidEntries.slice(0, 10).map((g) => (
            <div className="row-item" key={g.id}>
              <div className="row-main">
                <div className="row-title" style={{ opacity: 0.7 }}>{g.displayName || g.fileName}</div>
                <div className="row-sub">
                  {formatDateWeb(g.addedAtMillis)}{g.folder ? ` · ${g.folder}` : ''} · file only
                </div>
              </div>
              <Badge tone="warning">Android</Badge>
            </div>
          ))}
        </Card>
      )}

      {importing && <div className="row-sub" style={{ marginTop: 10 }}>Importing…</div>}

      {viewing && <PhotoViewer id={viewing} onClose={() => setViewing(null)} />}

      {pendingDelete && (
        <div className="dialog-backdrop" onClick={() => setPendingDelete(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete photo?</h3>
            <div className="dialog-text">
              "{pendingDelete.displayName}" will be removed from this device. This cannot be undone.
            </div>
            <div className="dialog-actions">
              <button className="btn ghost" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="btn danger-text" onClick={() => void remove(pendingDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {renameTarget && (
        <Modal title="Rename photo" onClose={() => setRenameTarget(null)}>
          <input className="input" value={renameInput} onChange={(e) => setRenameInput(e.target.value)} />
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setRenameTarget(null)}>Cancel</button>
            <button className="btn primary" onClick={rename}>Save</button>
          </div>
        </Modal>
      )}

      {folderDialog && (
        <Modal title="Folders" onClose={() => setFolderDialog(false)}>
          <div className="field">
            <label>New folder</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={newFolderName} placeholder="e.g. Anatomy diagrams"
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addFolder() }} />
              <button className="btn primary" onClick={addFolder} disabled={!newFolderName.trim()}>Create</button>
            </div>
          </div>
          {folders.length > 0 && (
            <div className="field">
              <label>Existing folders</label>
              {folders.map((f) => (
                <div className="row-item" key={f}>
                  <div className="row-main">
                    <div className="row-title">{f}</div>
                    <div className="row-sub">{photos.filter((p) => (p.folder ?? '') === f).length} photos</div>
                  </div>
                  <button className="icon-btn" aria-label={`Delete ${f}`} onClick={() => deleteFolder(f)}>
                    <IconTrash width={16} height={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {moveDialog && (
        <Modal title={`Move ${selectedIds.length} photo(s)`} onClose={() => setMoveDialog(false)}>
          <div className="row-sub" style={{ marginTop: 0 }}>Choose a folder:</div>
          <div className="chip-row">
            <button className="chip" onClick={() => moveSelected('')}>Unfiled</button>
            {folders.map((f) => (
              <button key={f} className="chip" onClick={() => moveSelected(f)}>{f}</button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

function PhotoTile({ photo, selected, selecting, onToggleSelect, onOpen, onDelete, onRename }: {
  photo: GalleryPhoto
  selected: boolean
  selecting: boolean
  onToggleSelect: () => void
  onOpen: () => void
  onDelete: () => void
  onRename: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    void (async () => {
      const blob = await getPhoto(photo.id)
      if (!active || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })()
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photo.id])

  return (
    <div style={{
      position: 'relative',
      outline: selected ? '2px solid var(--accent-strong)' : undefined,
      outlineOffset: 2,
      borderRadius: 14
    }}>
      <button className="photo-tile" onClick={onOpen} aria-label={`Open ${photo.displayName}`}>
        {url ? <img src={url} alt={photo.displayName} loading="lazy" /> : <span className="empty" style={{ padding: 4 }}>…</span>}
      </button>

      <button
        className="icon-btn"
        aria-label={selected ? 'Unselect photo' : 'Select photo'}
        onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
        style={{
          position: 'absolute', top: 6, left: 6, width: 28, height: 28, borderRadius: '50%',
          background: selected ? 'var(--accent-strong)' : 'rgba(0,0,0,0.5)',
          color: selected ? '#04231f' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        {selected && <IconCheck width={15} height={15} />}
      </button>

      {!selecting && (
        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 2 }}>
          <button className="icon-btn" style={{ width: 28, height: 28, background: 'rgba(0,0,0,0.5)', borderRadius: 8, color: '#fff' }}
            onClick={(e) => { e.stopPropagation(); onRename() }} aria-label="Rename">
            ✎
          </button>
          <button className="icon-btn" style={{ width: 28, height: 28, background: 'rgba(0,0,0,0.5)', borderRadius: 8, color: '#fff' }}
            onClick={(e) => { e.stopPropagation(); onDelete() }} aria-label="Delete">
            <IconTrash width={15} height={15} />
          </button>
        </div>
      )}

      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {photo.displayName}{photo.folder ? ` · ${photo.folder}` : ''}
      </div>
    </div>
  )
}

function PhotoViewer({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useFio()
  const photo = state.photos.find((p) => p.id === id)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    void (async () => {
      const blob = await getPhoto(id)
      if (!active || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })()
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])

  if (!photo) {
    return (
      <Modal title="Photo" onClose={onClose}>
        <Empty>Photo not found.</Empty>
      </Modal>
    )
  }

  return (
    <Modal title={photo.displayName} onClose={onClose}>
      {url
        ? <img src={url} alt={photo.displayName} style={{ width: '100%', borderRadius: 14, display: 'block' }} />
        : <Empty>Loading…</Empty>}
      <div className="row-sub" style={{ marginTop: 8 }}>
        Added {formatTimestampWeb(photo.addedAtMillis)} · {photo.mimeType}{photo.folder ? ` · ${photo.folder}` : ''}
      </div>
      {url && (
        <div className="modal-actions">
          <a className="btn" href={url} download={photo.displayName}>Save / share</a>
        </div>
      )}
    </Modal>
  )
}
