import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { uuidv7 } from 'uuidv7'
import type { Proposal } from '@/domain/entities/Proposal'
import { ManualLiquidationSplitter } from '@/domain/services/ManualLiquidationSplitter'
import type { Participant } from '@/domain/repositories/BoardRepository'
import { useBoard } from '@/presentation/context/boardContext'
import { formatCents, parseEuros } from './money'

interface Props {
  proposal: Proposal
  participants: Participant[]
  optedIn: string[]
  frozen: boolean
  onChanged: () => void
}

/**
 * "X put in Y" — squaring up by hand, which is what a group actually does. The per-head split of each
 * payment is `ManualLiquidationSplitter`, ported from EventSplit with its tests: the payer's own share
 * counts as paid, and the remainder is distributed cent by cent.
 */
export function LiquidationList({ proposal, participants, optedIn, frozen, onChanged }: Props) {
  const { t, i18n } = useTranslation()
  const { repo } = useBoard()
  const [amount, setAmount] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? '—'
  const everyone = participants.map((p) => p.id)

  const add = (event: React.FormEvent) => {
    event.preventDefault()
    const cents = parseEuros(amount)
    if (cents === null || cents === 0) {
      setError(t('expense.amountInvalid'))
      return
    }
    setError(null)
    setAmount('')
    setAdding(false)
    void repo
      .addLiquidation({
        id: uuidv7(),
        proposalId: proposal.id,
        cents,
        affects: optedIn.length > 0 ? optedIn : everyone,
      })
      .then(onChanged)
  }

  return (
    <div className="grid gap-2">
      <h5 className="text-sm font-medium">{t('expense.liquidations')}</h5>

      {proposal.liquidations.map((liquidation) => {
        const view = ManualLiquidationSplitter.compute(liquidation, everyone)
        return (
          <div
            key={liquidation.id}
            className="grid gap-1 rounded-[--radius] border p-2"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="text-sm">
              {liquidation.paidBy ? t('expense.paidBy', { name: nameOf(liquidation.paidBy) }) : ''}{' '}
              <span style={{ fontFamily: 'var(--font-data)' }}>
                {formatCents(liquidation.cents, i18n.language)}
              </span>
            </p>
            <ul className="grid gap-1 text-sm">
              {view.shares.map((share) => (
                <li key={share.participantId} className="flex items-center justify-between gap-2">
                  <span>{nameOf(share.participantId)}</span>
                  <span className="flex items-center gap-2">
                    <span style={{ fontFamily: 'var(--font-data)' }}>
                      {formatCents(share.cents, i18n.language)}
                    </span>
                    <input
                      type="checkbox"
                      checked={share.paid}
                      disabled={frozen || share.participantId === liquidation.paidBy}
                      aria-label={t('expense.markPaid', { name: nameOf(share.participantId) })}
                      onChange={(event) =>
                        void repo
                          .setLiquidationSharePaid({
                            liquidationId: liquidation.id,
                            participantId: share.participantId,
                            paid: event.target.checked,
                          })
                          .then(onChanged)
                      }
                      className="size-5"
                    />
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm" style={{ fontFamily: 'var(--font-data)' }}>
              <span style={{ color: 'var(--pos)' }}>
                {t('expense.paid', { amount: formatCents(view.paidCents, i18n.language) })}
              </span>
              {' · '}
              <span style={{ color: 'var(--warn)' }}>
                {t('expense.pending', { amount: formatCents(view.pendingCents, i18n.language) })}
              </span>
            </p>
          </div>
        )
      })}

      {!frozen &&
        (adding ? (
          <form onSubmit={add} className="grid gap-2" noValidate>
            <label className="grid gap-1">
              <span className="text-sm font-medium">{t('expense.amount')}</span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                className="min-h-11 min-w-0 rounded-[--radius] border px-3"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  fontFamily: 'var(--font-data)',
                }}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              className="min-h-11 justify-self-start rounded-[--radius] px-4 font-medium"
              style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
            >
              {t('expense.addPayment')}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-11 justify-self-start rounded-[--radius] border px-4"
            style={{ borderColor: 'var(--border)' }}
          >
            {t('expense.addPayment')}
          </button>
        ))}
    </div>
  )
}
