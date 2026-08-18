import { useTranslation } from 'react-i18next'
import { exportBoard, exportFilename, type ExportFormat } from '@/application/handlers/exportBoard'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'
import { useBoard } from '@/presentation/context/boardContext'

/** Straight from the cached snapshot, so this works offline and costs no egress. */
export function ExportButtons({ board }: { board: BoardSnapshot }) {
  const { t } = useTranslation()
  const { repo } = useBoard()

  const download = async (format: ExportFormat) => {
    // History is not in the snapshot, so an export that promises "the whole board" fetches it.
    const history = await repo.history({ slug: board.group.slug, limit: 200 }).catch(() => [])
    const content = exportBoard(
      board,
      format,
      {
        status: (status) => t(`status.${status}`),
        tally: (tally) => `${tally.up} / ${tally.down} / ${tally.abstain}`,
      },
      history,
    )
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportFilename(board, format, new Date().toISOString().slice(0, 10))
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        {t('export.explain')}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void download('md')}
          className="min-h-11 rounded-[--radius] border px-4"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('export.markdown')}
        </button>
        <button
          type="button"
          onClick={() => void download('json')}
          className="min-h-11 rounded-[--radius] border px-4"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('export.json')}
        </button>
      </div>
    </div>
  )
}
