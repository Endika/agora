import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Proposal } from '@/domain/entities/Proposal'
import { canClose, canComplete, canEdit, canReopen } from '@/domain/services/ProposalTransitions'

interface Props {
  proposal: Proposal
  meId: string
  onEdit: () => void
  onReopen: () => void
  onClose: (reason: string) => void
  onComplete: () => void
}

/** What a tie leaves open, and who gets to decide it. The RPC checks all of this again. */
export function ProposalActions({ proposal, meId, onEdit, onReopen, onClose, onComplete }: Props) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [closing, setClosing] = useState(false)

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit(proposal, meId) && (
        <button
          type="button"
          onClick={onEdit}
          className="min-h-11 rounded-[--radius] border px-4"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('proposal.edit')}
        </button>
      )}

      {canComplete(proposal) && (
        <button
          type="button"
          onClick={onComplete}
          className="min-h-11 rounded-[--radius] border px-4"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('actions.complete')}
        </button>
      )}

      {canReopen(proposal, meId) && (
        <button
          type="button"
          onClick={onReopen}
          className="min-h-11 rounded-[--radius] px-4 font-medium"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          {t('actions.reopen')}
        </button>
      )}

      {canClose(proposal, meId) && !closing && (
        <button
          type="button"
          onClick={() => setClosing(true)}
          className="min-h-11 rounded-[--radius] border px-4"
          style={{ borderColor: 'var(--border)', color: 'var(--danger)' }}
        >
          {t('actions.close')}
        </button>
      )}

      {canClose(proposal, meId) && closing && (
        <div className="grid gap-1">
          <label htmlFor={`reason-${proposal.id}`} className="font-medium">
            {t('actions.closeReason')}
          </label>
          <textarea
            id={`reason-${proposal.id}`}
            aria-describedby={`reason-hint-${proposal.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            className="min-w-0 rounded-[--radius] border p-2"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          />
          <p
            id={`reason-hint-${proposal.id}`}
            className="text-sm"
            style={{ color: 'var(--ink-muted)' }}
          >
            {t('actions.closeReasonHint')}
          </p>
          <button
            type="button"
            disabled={reason.trim().length < 10}
            onClick={() => onClose(reason)}
            className="min-h-11 rounded-[--radius] px-4 font-medium disabled:opacity-50"
            style={{ background: 'var(--danger)', color: '#ffffff' }}
          >
            {t('actions.closeConfirm')}
          </button>
        </div>
      )}
    </div>
  )
}
