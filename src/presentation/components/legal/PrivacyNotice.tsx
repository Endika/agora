import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { Logo } from '@/presentation/components/Logo'
import { BoardContext } from '@/presentation/context/boardContext'
import { boardHref } from '@/presentation/routing'

/**
 * Short, plain and honest — a privacy notice nobody reads is a dark pattern with extra steps. It names every
 * processor, says where the data actually sits (London, not "the EU"), and points at the two things a person
 * can do about it: export the agora, or delete it.
 *
 * "Who can see this" is the one section that stopped being a single truth the day each agora started
 * choosing its ballot. One paragraph cannot carry both answers: the reader's question is not "what can an
 * agora do" but "is my vote going to carry my name", and a paragraph that answers it with "one of these
 * two" answers nothing at all. So the shared half — the link is the key, an open round leaks nothing —
 * stays in `privacy.visible`, and the half that differs is one of three paragraphs, chosen by the agora
 * the reader came from.
 *
 * The context is optional on purpose. Reached from the home screen, or from a link somebody pasted, there
 * is no agora and no mode to report: `privacy.visibleBoth` then describes the two and says where the
 * answer for a given agora is written, which is the honest reading of "it depends". The component still
 * renders bare, outside any provider and with no slug, which is what keeps it a document and not a
 * board screen.
 */
export function PrivacyNotice({ slug = null }: { slug?: string | null }) {
  const { t } = useTranslation()
  const context = useContext(BoardContext)
  const board = context?.board ?? null
  const visible =
    board === null
      ? 'privacy.visibleBoth'
      : board.group.ballotOpen
        ? 'privacy.visibleOpen'
        : 'privacy.visibleSecret'
  // `board === null` is four situations at once — loading, offline, failed to load, and never in an
  // agora at all — and `visibleBoth` ends by telling the reader to enter an agora to find out which
  // mode applies. To somebody who *is* in one, that is advice they have already taken.
  //
  // The slug says there is an agora behind this page; the context's status says what happened to
  // it. Both are needed: on `slug` alone the apology is printed during an ordinary cold fetch —
  // "could not be read" while it is being read — and then vanishes when the board arrives.
  const generic = board === null && slug !== null && context?.status === 'error'

  const section = (heading: string, body: string[]) => (
    <section className="grid gap-2" key={heading}>
      <h2 className="text-xl font-semibold">{t(heading)}</h2>
      {body.map((key) => (
        <p key={key}>{t(key)}</p>
      ))}
    </section>
  )

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
      <header className="grid gap-2">
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <h1 className="text-3xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            {t('privacy.title')}
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('privacy.updated')}
        </p>
      </header>

      {section('privacy.whoHeading', ['privacy.who'])}
      {section('privacy.whatHeading', ['privacy.what', 'privacy.noAccounts'])}
      {section('privacy.basisHeading', ['privacy.basis'])}
      {section(
        'privacy.visibleHeading',
        generic
          ? ['privacy.visible', visible, 'privacy.visibleUnknown']
          : ['privacy.visible', visible],
      )}

      <section className="grid gap-2">
        <h2 className="text-xl font-semibold">{t('privacy.processorsHeading')}</h2>
        <ul className="grid gap-2">
          <li>{t('privacy.supabase')}</li>
          <li>{t('privacy.github')}</li>
        </ul>
        <p>{t('privacy.noAnalytics')}</p>
      </section>

      {section('privacy.retentionHeading', ['privacy.retention'])}
      {section('privacy.rightsHeading', ['privacy.rights'])}
      {section('privacy.deviceHeading', ['privacy.device'])}

      {/* Back is back to where you were. Reached from an agora's footer that is its board, not the
          home screen — the slug is in the address, so losing it would be a choice. */}
      <a href={slug ? boardHref(slug) : '#/'} className="min-h-11 content-center underline">
        {t(slug ? 'board.back' : 'footer.back')}
      </a>
    </main>
  )
}
