import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Proposal } from '@/domain/entities/Proposal'
import type { Participant } from '@/domain/repositories/BoardRepository'
import { settle } from '@/domain/services/Settlement'
import { uuidv7 } from 'uuidv7'
import { useBoard } from '@/presentation/context/boardContext'
import { useAction } from '@/presentation/useAction'
import { formatCents, parseEuros } from './money'

interface Props {
  proposal: Proposal
  participants: Participant[]
  meId: string
  onChanged: () => void
}

/**
 * The money, in the terms a group actually uses: a total, the people it is split between, and what each of
 * them has put in so far. "1000 € between two, I put in 100, I owe 400" is a sentence this panel can say.
 *
 * It replaces two mechanics that never added up to that — an opt-in and a separate list of transactions —
 * with one: your share, and payments against it.
 */
export function ExpensePanel({ proposal, participants, meId, onChanged }: Props) {
  const { t, i18n } = useTranslation()
  const { repo } = useBoard()
  const { run, error } = useAction()
  const [amount, setAmount] = useState('')
  const [recording, setRecording] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)

  const total = proposal.actualCents ?? proposal.estimatedCents
  if (total === null) return null

  const optedIn = proposal.shares
    .filter((share) => share.optedIn)
    .map((share) => share.participantId)
  const iAmIn = optedIn.includes(meId)
  const result = settle({ totalCents: total, optedIn, payments: proposal.payments })
  const mine = result.balances.find((balance) => balance.participantId === meId)
  const myPayments = proposal.payments.filter((payment) => payment.participantId === meId)
  const nameOf = (id: string) => participants.find((person) => person.id === id)?.name ?? '—'
  const money = (cents: number) => formatCents(cents, i18n.language)

  const record = (event: React.FormEvent) => {
    event.preventDefault()
    const cents = parseEuros(amount)
    if (cents === null || cents === 0) {
      setAmountError(t('expense.amountInvalid'))
      return
    }
    setAmountError(null)
    setAmount('')
    setRecording(false)
    run(() => repo.addPayment({ id: uuidv7(), proposalId: proposal.id, cents }), onChanged)
  }

  return (
    <section
      className="grid gap-3 rounded-[--radius] p-3"
      style={{ background: 'var(--surface-sunken)' }}
      aria-labelledby={`expense-${proposal.id}`}
    >
      <h4 id={`expense-${proposal.id}`} className="font-semibold">
        {t('expense.heading')}
      </h4>

      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        {t('expense.explain')}
      </p>

      <p className="text-sm" style={{ fontFamily: 'var(--font-data)' }}>
        {t(proposal.actualCents !== null ? 'expense.actual' : 'expense.estimated')}: {money(total)}
        {' · '}
        {t('expense.progress', { paid: money(result.paidCents), total: money(total) })}
      </p>

      <p
        className="text-sm"
        data-testid="total-left"
        style={{
          color:
            result.leftCents > 0
              ? 'var(--warn)'
              : result.leftCents < 0
                ? 'var(--pos)'
                : 'var(--pos)',
        }}
      >
        {result.leftCents > 0
          ? t('expense.totalLeft', { amount: money(result.leftCents) })
          : result.leftCents < 0
            ? t('expense.totalOver', { amount: money(-result.leftCents) })
            : t('expense.allIn')}
      </p>

      {proposal.estimatedCents !== null && proposal.actualCents !== null && (
        <Deviation estimated={proposal.estimatedCents} actual={proposal.actualCents} />
      )}

      {/* Where I stand, said in one line rather than left to be worked out. */}
      {mine && (
        <p className="text-sm font-medium">
          {t('expense.yourShare', { amount: money(mine.shareCents) })}
          {' · '}
          {t('expense.youPaid', { amount: money(mine.paidCents) })}
          {' · '}
          <span
            style={{
              color:
                mine.leftCents > 0
                  ? 'var(--warn)'
                  : mine.leftCents < 0
                    ? 'var(--pos)'
                    : 'var(--pos)',
            }}
          >
            {mine.leftCents > 0
              ? t('expense.youOwe', { amount: money(mine.leftCents) })
              : mine.leftCents < 0
                ? t('expense.youOverpaid', { amount: money(-mine.leftCents) })
                : t('expense.settled')}
          </span>
        </p>
      )}

      {proposal.status !== 'completed' && (
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
          {iAmIn ? '✓ ' : ''}
          {t('expense.amIn')}
        </button>
      )}

      <div className="grid gap-1">
        <h5 className="text-sm font-medium">
          {t('expense.balances')}
          {optedIn.length > 0 && (
            <span className="font-normal" style={{ color: 'var(--ink-muted)' }}>
              {' · '}
              {t('expense.whoIsIn', { count: optedIn.length })}
            </span>
          )}
        </h5>

        {result.balances.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {t('expense.nobodyIn')}
          </p>
        ) : (
          <ul className="grid gap-1 text-sm" style={{ fontFamily: 'var(--font-data)' }}>
            {result.balances.map((balance) => (
              <li key={balance.participantId} className="flex flex-wrap justify-between gap-x-3">
                <span>{nameOf(balance.participantId)}</span>
                <span className="flex flex-wrap gap-x-3">
                  <span data-testid="share-amount">{money(balance.shareCents)}</span>
                  <span style={{ color: 'var(--ink-muted)' }}>
                    {t('expense.paid')} {money(balance.paidCents)}
                  </span>
                  {/* Overpaying is as interesting as underpaying — often more so, since somebody is owed
                      money back. Both are shown, with their sign. */}
                  <span
                    data-testid="left-amount"
                    style={{ color: balance.leftCents > 0 ? 'var(--warn)' : 'var(--pos)' }}
                  >
                    {balance.leftCents > 0
                      ? `${t('expense.left')} ${money(balance.leftCents)}`
                      : balance.leftCents < 0
                        ? t('expense.over', { amount: money(-balance.leftCents) })
                        : t('expense.settled')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {myPayments.length > 0 && (
        <div className="grid gap-1">
          <h5 className="text-sm font-medium">{t('expense.myPayments')}</h5>
          <ul className="grid gap-1 text-sm">
            {myPayments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-2">
                <span style={{ fontFamily: 'var(--font-data)' }}>{money(payment.cents)}</span>
                <button
                  type="button"
                  onClick={() => run(() => repo.removePayment(payment.id), onChanged)}
                  aria-label={t('expense.removePayment', { amount: money(payment.cents) })}
                  className="min-h-11 rounded-[--radius] border px-3"
                  style={{ borderColor: 'var(--border)', color: 'var(--danger)' }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recording ? (
        <form onSubmit={record} className="grid gap-2" noValidate>
          <label className="grid gap-1">
            <span className="text-sm font-medium">{t('expense.iPaidAmount')}</span>
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
          {amountError && (
            <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
              {amountError}
            </p>
          )}
          <button
            type="submit"
            className="min-h-11 justify-self-start rounded-[--radius] px-4 font-medium"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            {t('expense.save')}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setRecording(true)}
          className="min-h-11 justify-self-start rounded-[--radius] border px-4"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('expense.iPaid')}
        </button>
      )}

      {proposal.status === 'completed' && (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('expense.frozen')}
        </p>
      )}
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
