import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PreparedUpload } from '@/domain/ports/ProposalImages'
import { useBoard } from '@/presentation/context/boardContext'

const MAX_IMAGES = 10

/**
 * Pick a photo and it is compressed on the spot — before anything is uploaded, and before the proposal
 * even exists. That is what keeps a 4 MB phone photo from becoming 4 MB of egress, and what strips the
 * GPS position out of it.
 */
export function ImagePicker({
  images,
  onChange,
}: {
  images: PreparedUpload[]
  onChange: (images: PreparedUpload[]) => void
}) {
  const { t } = useTranslation()
  const { images: pipeline } = useBoard()
  const input = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)
    setBusy(true)
    const next = [...images]
    try {
      for (const file of Array.from(files)) {
        if (next.length >= MAX_IMAGES) {
          setError(t('images.limit'))
          break
        }
        next.push(await pipeline.prepare(file))
      }
      onChange(next)
    } catch (cause) {
      const code = (cause as { code?: string }).code
      setError(code === 'IMAGE_TYPE' ? t('images.wrongType') : t('images.tooLarge'))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={busy || images.length >= MAX_IMAGES}
        onClick={() => input.current?.click()}
        className="min-h-11 justify-self-start rounded-[--radius] border px-3 font-medium disabled:opacity-50"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        🖼 {t('images.add')}
      </button>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        aria-label={t('images.add')}
        onChange={(event) => void pick(event.target.files)}
      />

      <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
        {error ?? ''}
      </p>

      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <li key={image.previewUrl} className="relative">
              <img
                src={image.previewUrl}
                alt={t('images.alt', { n: index + 1 })}
                width={80}
                height={80}
                className="size-20 rounded-[--radius] object-cover"
              />
              <button
                type="button"
                onClick={() => onChange(images.filter((other) => other !== image))}
                aria-label={t('images.remove', { n: index + 1 })}
                className="absolute -right-2 -top-2 size-7 rounded-full text-sm"
                style={{ background: 'var(--danger)', color: '#ffffff' }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
