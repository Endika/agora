import { useTranslation } from 'react-i18next'
import type { Proposal } from '@/domain/entities/Proposal'
import type { Participant } from '@/domain/repositories/BoardRepository'
import { Money } from '@/domain/value-objects/Money'
import { useBoard } from '@/presentation/context/boardContext'
import { useAction } from '@/presentation/useAction'
import { LiquidationList } from './LiquidationList'
import { formatCents } from './money'

interface Props {
  proposal: Proposal
  participants: Participant[]
  meId: string
  onChanged: () => void
}

/**
 * What a proposal costs and who is in for it. The split is between whoever opted in — not the whole
 * agora — and the cents are exact: `Money.splitInto` hands the remainder out one cent at a time, so
 * 100 € between three is 33,34 / 33,33 / 33,33 and adds back up to 100,00.
 */
export function ExpensePanel({ proposal, participants, meId, onChanged }: Props) {
  const { t, i18n } = useTranslation()
  const { repo } = useBoard()
  const { run, error } = useAction()
  const frozen = proposal.status === 'completed'

  const optedIn = proposal.shares
    .filter((share) => share.optedIn)
    .map((share) => share.participantId)
  const iAmIn = optedIn.includes(meId)
  const total = proposal.actualCents ?? proposal.estimatedCents
  const shares =
    total !== null && optedIn.length > 0 ? Money.fromCents(total).splitInto(optedIn.length) : []
  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? '—'

  if (proposal.estimatedCents === null && proposal.actualCents === null) return null

  return (
    <section
      className="grid gap-3 rounded-[--radius] p-3"
      style={{ background: 'var(--surface-sunken)' }}
    >
      <h4 className="font-semibold">{t('expense.heading')}</h4>

      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <dl className="grid gap-1 text-sm" style={{ fontFamily: 'var(--font-data)' }}>
        {proposal.estimatedCents !== null && (
          <div className="flex justify-between gap-2">
            <dt>{t('expense.estimated')}</dt>
            <dd>{formatCents(proposal.estimatedCents, i18n.language)}</dd>
          </div>
        )}
        {proposal.actualCents !== null && (
          <div className="flex justify-between gap-2">
            <dt>{t('expense.actual')}</dt>
            <dd>{formatCents(proposal.actualCents, i18n.language)}</dd>
          </div>
        )}
      </dl>

      {proposal.estimatedCents !== null && proposal.actualCents !== null && (
        <Deviation estimated={proposal.estimatedCents} actual={proposal.actualCents} />
      )}

      {!frozen && (
        <button
          type="button"
          onClick={() =>
            run(() => repo.setExpenseShare({ proposalId: proposal.id, optedIn: !iAmIn }), onChanged)
          }
          aria-pressed={iAmIn}
          className="min-h-11 justify-self-start rounded-[--radius] border px-4 font-medium"
          style={{
            background: iAmIn ? 'var(--pos)' : 'var(--surface)',
            color: iAmIn ? '#ffffff' : 'var(--ink)',
            borderColor: iAmIn ? 'var(--pos)' : 'var(--border)',
          }}
        >
          {iAmIn ? t('expense.iPay') : t('expense.iDontPay')}
        </button>
      )}

      {frozen && (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('expense.frozen')}
        </p>
      )}

      <div className="grid gap-1">
        <h5 className="text-sm font-medium">{t('expense.sharesHeading')}</h5>
        {optedIn.length === 0 || total === null ? (
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {t('expense.nobodyIn')}
          </p>
        ) : (
          <>
            <ul className="grid gap-1 text-sm" style={{ fontFamily: 'var(--font-data)' }}>
              {optedIn.map((participantId, index) => (
                <li key={participantId} className="flex justify-between gap-2">
                  <span>{nameOf(participantId)}</span>
                  <span data-testid="share-amount">
                    {formatCents(shares[index]!.cents, i18n.language)}
                  </span>
                </li>
              ))}
            </ul>
            <p
              className="text-sm font-medium"
              data-testid="share-total"
              style={{ fontFamily: 'var(--font-data)' }}
            >
              {t('expense.total', { amount: formatCents(total, i18n.language) })}
            </p>
          </>
        )}
      </div>

      <LiquidationList
        proposal={proposal}
        participants={participants}
        optedIn={optedIn}
        frozen={frozen}
        onChanged={onChanged}
      />
    </section>
  )
}

function Deviation({ estimated, actual }: { estimated: number; actual: number }) {
  const { t, i18n } = useTranslation()
  const difference = actual - estimated
  if (difference === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        {t('expense.deviationNone')}
      </p>
    )
  }
  const over = difference > 0
  return (
    <p className="text-sm font-medium" style={{ color: over ? 'var(--warn)' : 'var(--pos)' }}>
      {t(over ? 'expense.deviationOver' : 'expense.deviationUnder', {
        amount: formatCents(Math.abs(difference), i18n.language),
      })}
    </p>
  )
}
