import { useTranslation } from 'react-i18next'
import type { ProposalImage } from '@/domain/entities/Proposal'
import { useBoard } from '@/presentation/context/boardContext'

/**
 * The list shows thumbnails and only thumbnails: 30 KB each instead of 200 KB, which is where the
 * egress budget is won. The full image is one tap away for whoever wants it.
 */
export function ImageGallery({ images }: { images: ProposalImage[] }) {
  const { t } = useTranslation()
  const { images: pipeline } = useBoard()
  if (images.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2">
      {images.map((image, index) => (
        <li key={image.id}>
          <a
            href={pipeline.urlFor(image.path)}
            target="_blank"
            rel="noopener noreferrer"
            title={t('images.open')}
          >
            <img
              src={pipeline.urlFor(image.thumbPath)}
              alt={t('images.alt', { n: index + 1 })}
              width={112}
              height={112}
              loading="lazy"
              decoding="async"
              className="size-28 rounded-[--radius] object-cover"
              style={{ background: 'var(--surface-sunken)' }}
            />
          </a>
        </li>
      ))}
    </ul>
  )
}
