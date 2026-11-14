import { useEffect, useMemo, useState } from 'react'
import { useFio, update } from '../lib/store'
import { uid, type GalleryPhoto } from '../lib/types'
import { deletePhoto, getPhoto, putPhoto } from '../lib/db'
import { Badge, Card, Empty, Modal, ScreenHeader } from '../ui/components'
import { IconAdd, IconPhoto, IconTrash } from '../ui/icons'
import { formatDateWeb, formatTimestampWeb } from '../lib/format'

/**
 * Gallery — pictures you save for studying live here. Photos are imported
 * with the browser file picker and stored as blobs in IndexedDB; only their
 * metadata lives in the state document (and never in backup JSON, matching
 * the Android app, whose files travel separately).
 */
export function GalleryScreen() {
  const state = useFio()
  const [importing, setImporting] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<GalleryPhoto | null>(null)
  const [renameTarget, setRenameTarget] = useState<GalleryPhoto | null>(null)
  const [renameInput, setRenameInput] = useState('')

  const photos = useMemo(() =>
    [...state.photos].sort((a, b) => b.addedAtMillis - a.addedAtMillis),
  [state.photos])

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
    const imported: GalleryPhoto[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const id = uid()
      await putPhoto(id, file)
      imported.push({
        id,
        displayName: file.name.replace(/\.[^.]+$/, ''),
        mimeType: file.type,
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
    update((s) => ({ ...s, photos: s.photos.filter((x) => x.id !== p.id) }))
    setPendingDelete(null)
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

      {photos.length === 0 && androidEntries.length === 0 && (
        <Card>
          <Empty>Tap "Add photos" to store pictures for your study notes.</Empty>
        </Card>
      )}

      {photos.length > 0 && (
        <Card>
          <div className="photo-grid">
            {photos.map((p) => (
              <PhotoTile key={p.id} photo={p}
                onOpen={() => setViewing(p.id)}
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
                <div className="row-sub">{formatDateWeb(g.addedAtMillis)} · file only</div>
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
    </div>
  )
}

function PhotoTile({ photo, onOpen, onDelete, onRename }: {
  photo: GalleryPhoto
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
    <div style={{ position: 'relative' }}>
      <button className="photo-tile" onClick={onOpen} aria-label={`Open ${photo.displayName}`}>
        {url ? <img src={url} alt={photo.displayName} loading="lazy" /> : <span className="empty" style={{ padding: 4 }}>…</span>}
      </button>
      <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2 }}>
        <button className="icon-btn" style={{ width: 28, height: 28, background: 'rgba(0,0,0,0.5)', borderRadius: 8, color: '#fff' }}
          onClick={(e) => { e.stopPropagation(); onRename() }} aria-label="Rename">
          ✎
        </button>
        <button className="icon-btn" style={{ width: 28, height: 28, background: 'rgba(0,0,0,0.5)', borderRadius: 8, color: '#fff' }}
          onClick={(e) => { e.stopPropagation(); onDelete() }} aria-label="Delete">
          <IconTrash width={15} height={15} />
        </button>
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {photo.displayName}
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
        Added {formatTimestampWeb(photo.addedAtMillis)} · {photo.mimeType}
      </div>
      {url && (
        <div className="modal-actions">
          <a className="btn" href={url} download={photo.displayName}>Save / share</a>
        </div>
      )}
    </Modal>
  )
}
