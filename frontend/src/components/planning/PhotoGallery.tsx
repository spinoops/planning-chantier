import { useRef, useState } from 'react'
import { useDeletePhoto, usePhotos, useUploadPhoto } from '@/hooks/usePhotos'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { getErrorMessage } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

interface PhotoGalleryProps {
  affectationId: number
  canDelete?: (photo: { user?: { id: number } | null }) => boolean
  compact?: boolean
}

/** Photos de fin de journée d'une affectation : vignettes, ajout depuis l'appareil photo, suppression. */
export default function PhotoGallery({ affectationId, canDelete = () => true, compact = false }: PhotoGalleryProps) {
  const { data: photos = [], isLoading } = usePhotos(affectationId)
  const upload = useUploadPhoto()
  const remove = useDeletePhoto()
  const confirm = useConfirm()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  function onFiles(files: FileList | null) {
    if (!files?.length) return
    Array.from(files).forEach((file) =>
      upload.mutate(
        { affectationId, file },
        { onSuccess: () => toast('Photo ajoutée.', 'success'), onError: (err) => toast(getErrorMessage(err, 'Envoi impossible.'), 'error') },
      ),
    )
    if (inputRef.current) inputRef.current.value = ''
  }

  async function onDelete(photoId: number) {
    const ok = await confirm({ title: 'Supprimer cette photo ?', confirmLabel: 'Supprimer', danger: true })
    if (!ok) return
    remove.mutate({ affectationId, photoId }, { onError: (err) => toast(getErrorMessage(err), 'error') })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          Photos {photos.length > 0 && <span className="font-normal text-gray-400">({photos.length})</span>}
        </p>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={upload.isPending}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          Ajouter
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : photos.length === 0 ? (
        !compact && <p className="text-xs text-gray-400">Aucune photo. Prends une photo du travail terminé : utile pour les décomptes.</p>
      ) : (
        <ul className={`grid gap-2 ${compact ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4'}`}>
          {photos.map((p) => (
            <li key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              <button type="button" onClick={() => setPreview(p.url)} className="block h-full w-full">
                <img src={p.url} alt={p.caption ?? ''} className="h-full w-full object-cover" loading="lazy" />
              </button>
              {canDelete(p) && (
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  aria-label="Supprimer la photo"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)} role="presentation">
          <img src={preview} alt="" className="max-h-full max-w-full rounded-lg shadow-2xl" />
          <p className="absolute bottom-4 text-xs text-white/70">{formatDateTime(photos.find((p) => p.url === preview)?.created_at)} · toucher pour fermer</p>
        </div>
      )}
    </div>
  )
}
