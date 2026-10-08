import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { isPlanner } from '@/lib/navigation'
import { AIDE_EMPLOYEE_SECTION, chaptersOf, type AideBlock, type AideChapter } from '@/lib/aide'
import { useAide, useAideImage } from '@/hooks/useAide'
import { DEFAULT_LOGO } from '@/lib/branding'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

/** **gras** et *italique* → éléments React. */
function rich(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (!part) return null
    if (part.startsWith('**'))
      return (
        <strong key={i} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      )
    if (part.startsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
    return <Fragment key={i}>{part}</Fragment>
  })
}

type Group = { kind: 'block'; block: AideBlock } | { kind: 'list'; ordered: boolean; items: string[] }

/** Regroupe les puces / étapes consécutives en une liste. */
function groupBlocks(blocks: AideBlock[]): Group[] {
  const out: Group[] = []
  for (const b of blocks) {
    if (b.t === 'li' || b.t === 'ol') {
      const ordered = b.t === 'ol'
      const last = out[out.length - 1]
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(b.text)
      else out.push({ kind: 'list', ordered, items: [b.text] })
    } else out.push({ kind: 'block', block: b })
  }
  return out
}

const chapterOf = (chapters: AideChapter[], id: string) => chapters.find((c) => c.id === id || c.sections.some((s) => s.id === id))?.id

/** Capture chargée avec le jeton ; emplacement réservé (même format) en attendant. */
function AideImage({ block }: { block: Extract<AideBlock, { t: 'img' }> }) {
  const { data: url } = useAideImage(block.src)
  const width = block.mobile ? 'max-w-[260px]' : 'max-w-[760px]'
  if (!url) return <div className={`mx-auto w-full rounded-xl bg-gray-900/[0.04] ${width}`} style={{ aspectRatio: `${block.w} / ${block.h}` }} aria-hidden />
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block" title="Agrandir">
      <img src={url} alt={block.caption} width={block.w} height={block.h} className={`mx-auto h-auto w-full rounded-xl shadow-[0_10px_30px_-12px_rgb(15_40_90/0.35)] ${width}`} />
    </a>
  )
}

/**
 * Mode d'emploi intégré : sommaire à gauche (section en cours surlignée), contenu avec
 * captures, bouton « Imprimer / PDF » (impression du navigateur → « Enregistrer en PDF »).
 * Ouvert par le bouton « ? » en bas à droite, directement sur la section de la page en cours.
 */
export default function AidePage() {
  const { user } = useAuth()
  const { hash } = useLocation()
  const { data: blocks = [], isLoading } = useAide()
  const groups = useMemo(() => groupBlocks(blocks), [blocks])
  const chapters = useMemo(() => chaptersOf(blocks), [blocks])
  const chapterNumbers = useMemo(() => new Map(chapters.map((c) => [c.id, c.number])), [chapters])
  const [active, setActive] = useState<string>('')
  const employee = !isPlanner(user)
  const loaded = blocks.length > 0

  // Arrivée par le bouton « ? » ou un lien du sommaire : aller à la section demandée.
  useEffect(() => {
    const id = decodeURIComponent(hash.replace(/^#/, ''))
    const el = id ? document.getElementById(id) : null
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }))
    else window.scrollTo({ top: 0 })
  }, [hash, loaded])

  // Titre visible → surligné dans le sommaire.
  useEffect(() => {
    const headings = Array.from(document.querySelectorAll<HTMLElement>('[data-aide-heading]'))
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-90px 0px -65% 0px' },
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [loaded])

  const openChapter = chapterOf(chapters, active || (chapters[0]?.id ?? ''))

  return (
    <div className="aide-page">
      {/* En-tête (écran) */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <h2 className="text-[28px] font-bold tracking-tight text-gray-900">Mode d'emploi</h2>
          <p className="mt-0.5 text-[15px] text-gray-500">Tout ce qu'il faut savoir pour utiliser Planning Chantier.</p>
        </div>
        <Button onClick={() => window.print()}>
          <span className="inline-flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" strokeLinejoin="round" />
              <path d="M7 14h10v7H7z" strokeLinejoin="round" />
            </svg>
            Imprimer / PDF
          </span>
        </Button>
      </div>

      {/* Couverture (impression) */}
      <div className="hidden print:block print:pb-8">
        <img src={DEFAULT_LOGO} alt="Top Store" className="h-14 w-auto" />
        <p className="mt-6 text-2xl font-bold text-gray-900">Planning Chantier – Mode d'emploi</p>
        <p className="mt-1 text-sm text-gray-600">Planification des chantiers, des équipes et des heures · Top Store</p>
      </div>

      <div className="flex items-start gap-6">
        {/* Sommaire */}
        <nav
          aria-label="Sommaire"
          className="glass-panel sticky top-24 hidden max-h-[calc(100vh-7.5rem)] w-64 shrink-0 overflow-y-auto rounded-[18px] p-3 lg:block print:hidden"
        >
          <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Sommaire</p>
          <ol className="space-y-0.5">
            {chapters.map((c) => (
              <li key={c.id}>
                <Link
                  to={`#${c.id}`}
                  className={`flex gap-2 rounded-xl px-2 py-1.5 text-[13px] font-medium transition ${
                    active === c.id ? 'bg-primary-soft text-primary' : openChapter === c.id ? 'text-gray-900' : 'text-gray-700 hover:bg-gray-900/[0.05]'
                  }`}
                >
                  <span className="w-4 shrink-0 text-right tabular-nums text-gray-400">{c.number}</span>
                  <span>{c.title}</span>
                </Link>
                {openChapter === c.id && c.sections.length > 0 && (
                  <ul className="mb-1 ml-6 space-y-0.5">
                    {c.sections.map((s) => (
                      <li key={s.id}>
                        <Link
                          to={`#${s.id}`}
                          className={`block rounded-lg px-2 py-1 text-[12.5px] transition ${
                            active === s.id ? 'bg-primary-soft font-medium text-primary' : 'text-gray-600 hover:bg-gray-900/[0.05]'
                          }`}
                        >
                          {s.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Contenu */}
        <article className="glass-panel aide-content min-w-0 flex-1 rounded-[18px] px-5 py-6 sm:px-8 sm:py-8">
          {isLoading && <Spinner block />}
          {employee && (
            <Link
              to={`#${AIDE_EMPLOYEE_SECTION}`}
              className="mb-6 flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3 text-[14px] text-gray-800 transition hover:brightness-[0.98] print:hidden"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
                  <path d="M11 18.5h2" strokeLinecap="round" />
                </svg>
              </span>
              <span>
                <strong className="font-semibold">Vous êtes sur le terrain ?</strong> L'essentiel pour vous est au chapitre « Sur le téléphone : Mon planning ».
              </span>
            </Link>
          )}

          {groups.map((g, i) => {
            if (g.kind === 'list') {
              const Tag = g.ordered ? 'ol' : 'ul'
              return (
                <Tag
                  key={i}
                  className={`my-3 space-y-1.5 pl-6 text-[15px] leading-relaxed text-gray-700 ${
                    g.ordered ? 'list-decimal marker:font-semibold marker:text-primary' : 'list-disc marker:text-gray-400'
                  }`}
                >
                  {g.items.map((text, j) => (
                    <li key={j} className="pl-1">
                      {rich(text)}
                    </li>
                  ))}
                </Tag>
              )
            }
            const b = g.block
            switch (b.t) {
              case 'h1': {
                const chapterNo = chapterNumbers.get(b.id) ?? 0
                return (
                  <h2
                    key={i}
                    id={b.id}
                    data-aide-heading
                    className={`aide-h1 scroll-mt-24 text-[24px] font-bold tracking-tight text-gray-900 ${
                      chapterNo > 1 ? 'mt-12 pt-8 [box-shadow:inset_0_1px_0_rgb(0_0_0/0.06)]' : ''
                    }`}
                  >
                    <span className="mr-2 text-primary">{chapterNo}.</span>
                    {b.text}
                  </h2>
                )
              }
              case 'h2':
                return (
                  <h3 key={i} id={b.id} data-aide-heading className="aide-h2 mt-8 scroll-mt-24 text-[18px] font-semibold text-gray-900">
                    {b.text}
                  </h3>
                )
              case 'p':
                return (
                  <p key={i} className="my-3 text-[15px] leading-relaxed text-gray-700">
                    {rich(b.text)}
                  </p>
                )
              case 'tip':
                return (
                  <p key={i} className="aide-tip my-4 flex gap-3 rounded-2xl bg-sys-orange-soft px-4 py-3 text-[14.5px] leading-relaxed text-gray-800">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sys-orange text-[12px] font-bold text-white">!</span>
                    <span>
                      <strong className="font-semibold">Astuce : </strong>
                      {rich(b.text)}
                    </span>
                  </p>
                )
              case 'img':
                return (
                  <figure key={i} className="aide-figure my-6">
                    <AideImage block={b} />
                    {b.caption && <figcaption className="mt-2 text-center text-[13px] italic text-gray-500">{b.caption}</figcaption>}
                  </figure>
                )
              default:
                return null
            }
          })}
        </article>
      </div>
    </div>
  )
}
