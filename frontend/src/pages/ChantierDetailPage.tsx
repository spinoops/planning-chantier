import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { downloadRecapCsv, useChantier, useChantierRecap, useUpdateChantier } from '@/hooks/useChantiers'
import { useCreateSousTraitant, useSousTraitants } from '@/hooks/useSousTraitants'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { todayKey } from '@/lib/dates'
import { formatDate, formatMinutes, formatMoney } from '@/lib/format'
import { toast } from '@/lib/toast'
import { CHANTIER_STATUSES, QUOTE_STATUSES } from '@/types'
import type { Chantier, ChantierStep, MaterielItem } from '@/types'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import PageHeader from '@/components/ui/PageHeader'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'
import StatCard from '@/components/ui/StatCard'
import Textarea from '@/components/ui/Textarea'
import AddressInput from '@/components/ui/AddressInput'
import ChantierTitleFields from '@/components/planning/ChantierTitleFields'
import { buildChantierName, complementOf } from '@/lib/chantierName'

const schema = z.object({
  client: z.string().max(255),
  complement: z.string().max(255),
  client_id: z.string(),
  address: z.string().max(255),
  city: z.string().max(120),
  status: z.enum(['planned', 'active', 'paused', 'done']),
  start_date: z.string(),
  end_date: z.string(),
  estimated_hours: z.string(),
  mesures: z.string().max(10000),
  notes: z.string().max(5000),
  quote_status: z.enum(['none', 'to_prepare', 'sent', 'accepted', 'refused']),
  quote_amount: z.string(),
  quote_sent_at: z.string(),
  quote_accepted_at: z.string(),
  remeasure_needed: z.boolean(),
  remeasured_at: z.string(),
  planning_hours: z.string(),
})

type FormValues = z.infer<typeof schema>

const STEP_TONE: Record<ChantierStep['state'], string> = {
  done: 'bg-sys-green text-white gloss',
  pending: 'bg-primary/15 text-primary',
  todo: 'glass-pill text-gray-600',
  skipped: 'bg-white/25 text-gray-400',
  refused: 'bg-sys-red/15 text-sys-red-deep',
}

function toForm(c: Chantier): FormValues {
  return {
    client: c.client_record?.name ?? c.client ?? '',
    complement: complementOf(c.name, c.client_record?.name ?? c.client),
    client_id: c.client_id ? String(c.client_id) : '',
    address: c.address ?? '',
    city: c.city ?? '',
    status: c.status,
    start_date: c.start_date ?? '',
    end_date: c.end_date ?? '',
    estimated_hours: c.estimated_hours != null ? String(c.estimated_hours) : '',
    mesures: c.mesures ?? '',
    notes: c.notes ?? '',
    quote_status: c.quote_status,
    quote_amount: c.quote_amount != null ? String(c.quote_amount) : '',
    quote_sent_at: c.quote_sent_at ?? '',
    quote_accepted_at: c.quote_accepted_at ?? '',
    remeasure_needed: c.remeasure_needed,
    remeasured_at: c.remeasured_at ?? '',
    planning_hours: c.planning_hours != null ? String(c.planning_hours) : '',
  }
}

const num = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(',', '.')))

/**
 * Fiche chantier : les sept étapes du déroulé (création, devis, reprise des
 * mesures, estimation pour le planning, planning, heures, récapitulatif),
 * tout se modifie ici ; le récapitulatif pour la facturation s'exporte en CSV.
 */
export default function ChantierDetailPage() {
  const { id } = useParams()
  const chantierId = Number(id) || null
  const { data: c, isLoading } = useChantier(chantierId)
  const update = useUpdateChantier()
  const { data: sousTraitants = [] } = useSousTraitants()
  const createSousTraitant = useCreateSousTraitant()

  const [materiel, setMateriel] = useState<MaterielItem[]>([])
  const [selectedSt, setSelectedSt] = useState<{ id: number; note: string; planned_date: string }[]>([])
  const [newItem, setNewItem] = useState({ label: '', qty: '' })
  const [newSt, setNewSt] = useState({ name: '', trade: '' })
  const [recapRange, setRecapRange] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [tab, setTab] = useState<'fiche' | 'recap'>('fiche')
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: c ? toForm(c) : undefined })

  useEffect(() => {
    if (!c) return
    reset(toForm(c))
    setMateriel(c.materiel ?? [])
    setSelectedSt((c.sous_traitants ?? []).map((s) => ({ id: s.id, note: s.note ?? '', planned_date: s.planned_date ?? '' })))
  }, [c, reset])

  const recapParams = useMemo(() => ({ from: recapRange.from || undefined, to: recapRange.to || undefined }), [recapRange])
  const { data: recap, isLoading: loadingRecap } = useChantierRecap(chantierId, recapParams, tab === 'recap')

  const address = watch('address') ?? ''
  const quoteStatus = watch('quote_status')
  const remeasure = watch('remeasure_needed')

  function save(values: FormValues) {
    if (!c) return
    setFormError(null)
    update.mutate(
      {
        id: c.id,
        payload: {
          name: buildChantierName(values.client, values.complement) || c.name,
          client: values.client.trim() || null,
          client_id: Number(values.client_id) || null,
          address: values.address.trim() || null,
          city: values.city.trim() || null,
          color: c.color,
          status: values.status,
          start_date: values.start_date || null,
          end_date: values.end_date || null,
          notes: values.notes.trim() || null,
          estimated_hours: num(values.estimated_hours),
          mesures: values.mesures.trim() || null,
          materiel,
          sous_traitants: selectedSt.map((s) => ({ id: s.id, note: s.note.trim() || null, planned_date: s.planned_date || null })),
          quote_status: values.quote_status,
          quote_amount: num(values.quote_amount),
          quote_sent_at: values.quote_sent_at || null,
          quote_accepted_at: values.quote_accepted_at || null,
          remeasure_needed: values.remeasure_needed,
          remeasured_at: values.remeasured_at || null,
          planning_hours: num(values.planning_hours),
        },
      },
      {
        onSuccess: () => toast('Fiche enregistrée.', 'success'),
        onError: (err) => {
          if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err))
        },
      },
    )
  }

  function addMateriel() {
    if (!newItem.label.trim()) return
    setMateriel((prev) => [...prev, { label: newItem.label.trim(), qty: newItem.qty.trim() || null, done: false }])
    setNewItem({ label: '', qty: '' })
  }

  function addSousTraitant() {
    if (!newSt.name.trim()) return
    createSousTraitant.mutate(
      { name: newSt.name.trim(), trade: newSt.trade.trim() || null, contact_name: null, phone: null, email: null, notes: null },
      {
        onSuccess: (st) => {
          setSelectedSt((prev) => [...prev, { id: st.id, note: '', planned_date: '' }])
          setNewSt({ name: '', trade: '' })
          toast(`Sous-traitant « ${st.name} » créé.`, 'success')
        },
        onError: (err) => toast(getErrorMessage(err), 'error'),
      },
    )
  }

  if (isLoading || !c) return <Spinner block />

  const dirty = isDirty || JSON.stringify(materiel) !== JSON.stringify(c.materiel ?? []) || JSON.stringify(selectedSt) !== JSON.stringify((c.sous_traitants ?? []).map((s) => ({ id: s.id, note: s.note ?? '', planned_date: s.planned_date ?? '' })))

  return (
    <form onSubmit={handleSubmit(save)}>
      <PageHeader
        back="/chantiers"
        title={c.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
            {c.client_record?.name ?? c.client ?? 'Sans client'}
            {c.city && <span>· {c.city}</span>}
            <Badge tone={c.status === 'active' ? 'success' : c.status === 'planned' ? 'info' : c.status === 'paused' ? 'warn' : 'neutral'}>{c.status_label}</Badge>
          </span>
        }
        action={
          <>
            <Link to={`/planning?chantier=${c.id}`} className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Voir dans le planning
            </Link>
            <Button type="submit" loading={update.isPending} disabled={!dirty}>
              Enregistrer
            </Button>
          </>
        }
      />

      {/* Déroulé en 7 étapes */}
      <ol className="mb-6 grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {(c.steps ?? []).map((s, i) => (
          <li key={s.key} className={`rounded-2xl px-3.5 py-2.5 ${STEP_TONE[s.state]}`} title={s.hint ?? undefined}>
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Étape {i + 1}</p>
            <p className="text-sm font-semibold leading-tight">{s.label}</p>
            {s.hint && <p className="mt-0.5 truncate text-[11px] opacity-80">{s.hint}</p>}
          </li>
        ))}
      </ol>

      <div className="mb-4 inline-flex rounded-full bg-white/35 p-1 shadow-[inset_0_1px_2px_rgb(15_40_90/0.08)]">
        {(['fiche', 'recap'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1 text-sm font-medium transition ${tab === t ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgb(15_40_90/0.15)]' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t === 'fiche' ? 'Fiche de préparation' : 'Récapitulatif facturation'}
          </button>
        ))}
      </div>

      {formError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

      {tab === 'fiche' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title="1 · Création du chantier" description="Fait au bureau : client, lieu, estimation, mesures, remarques.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <ChantierTitleFields
                    clientId={watch('client_id')}
                    clientName={watch('client') ?? ''}
                    complement={watch('complement') ?? ''}
                    onClient={(id, client) => {
                      setValue('client_id', id, { shouldDirty: true })
                      setValue('client', client?.name ?? '', { shouldDirty: true })
                    }}
                    onComplement={(v) => setValue('complement', v, { shouldDirty: true })}
                    clientError={errors.client_id?.message}
                    complementError={errors.complement?.message}
                  />
                </div>
                <AddressInput
                  value={address}
                  onChange={(v) => setValue('address', v, { shouldDirty: true })}
                  onPick={(s) => {
                    setValue('address', s.street, { shouldDirty: true })
                    if (s.city) setValue('city', s.city, { shouldDirty: true })
                  }}
                  error={errors.address?.message}
                />
                <Input label="Ville" error={errors.city?.message} {...register('city')} />
                <Select label="Statut" error={errors.status?.message} {...register('status')}>
                  {CHANTIER_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <Input label="Estimation initiale (heures)" type="number" step="0.5" min={0} placeholder="Ex. 120" error={errors.estimated_hours?.message} {...register('estimated_hours')} />
                <Input label="Début" type="date" error={errors.start_date?.message} {...register('start_date')} />
                <Input label="Fin prévue" type="date" error={errors.end_date?.message} {...register('end_date')} />
                <div className="sm:col-span-2">
                  <Textarea label="Mesures" rows={3} placeholder="Dimensions, surfaces, hauteurs…" error={errors.mesures?.message} {...register('mesures')} />
                </div>
                <div className="sm:col-span-2">
                  <Textarea label="Remarques" rows={3} placeholder="Accès, contraintes, consignes…" error={errors.notes?.message} {...register('notes')} />
                </div>
              </div>
            </Card>

            <Card title="Matériel à prévoir" description="Coche ce qui est commandé ou prêt.">
              <ul className="divide-y divide-gray-100">
                {materiel.map((m, i) => (
                  <li key={i} className="flex items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      checked={m.done}
                      onChange={(e) => setMateriel((prev) => prev.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))}
                      className="h-4 w-4 rounded border-gray-300 accent-primary"
                      aria-label={`Prêt : ${m.label}`}
                    />
                    <span className={`flex-1 text-sm ${m.done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{m.label}</span>
                    {m.qty && <span className="text-xs text-gray-500">{m.qty}</span>}
                    <button type="button" onClick={() => setMateriel((prev) => prev.filter((_, j) => j !== i))} className="text-xs text-gray-400 hover:text-red-600" aria-label="Retirer">
                      ×
                    </button>
                  </li>
                ))}
                {materiel.length === 0 && <li className="py-2 text-sm italic text-gray-400">Aucun matériel listé.</li>}
              </ul>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    label="Ajouter"
                    placeholder="Béton C25/30"
                    value={newItem.label}
                    onChange={(e) => setNewItem((p) => ({ ...p, label: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addMateriel()
                      }
                    }}
                  />
                </div>
                <div className="w-32">
                  <Input label="Quantité" placeholder="6 m³" value={newItem.qty} onChange={(e) => setNewItem((p) => ({ ...p, qty: e.target.value }))} />
                </div>
                <Button variant="secondary" onClick={addMateriel} disabled={!newItem.label.trim()}>
                  Ajouter
                </Button>
              </div>
            </Card>

            <Card title="Sous-traitants à prévoir" description="Qui intervient, quand, et une note.">
              <ul className="space-y-2">
                {selectedSt.map((s, i) => {
                  const st = sousTraitants.find((x) => x.id === s.id)
                  return (
                    <li key={s.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 p-2">
                      <div className="min-w-40 flex-1">
                        <p className="text-sm font-medium text-gray-900">{st?.name ?? `#${s.id}`}</p>
                        <p className="text-xs text-gray-500">{[st?.trade, st?.phone].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="w-36">
                        <Input label="Date prévue" type="date" value={s.planned_date} onChange={(e) => setSelectedSt((prev) => prev.map((x, j) => (j === i ? { ...x, planned_date: e.target.value } : x)))} />
                      </div>
                      <div className="w-48">
                        <Input label="Note" placeholder="Après la dalle…" value={s.note} onChange={(e) => setSelectedSt((prev) => prev.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
                      </div>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => setSelectedSt((prev) => prev.filter((_, j) => j !== i))}>
                        Retirer
                      </Button>
                    </li>
                  )
                })}
                {selectedSt.length === 0 && <li className="text-sm italic text-gray-400">Aucun sous-traitant prévu.</li>}
              </ul>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-48 flex-1">
                  <Select
                    label="Ajouter un sous-traitant existant"
                    value=""
                    onChange={(e) => {
                      const id = Number(e.target.value)
                      if (id && !selectedSt.some((s) => s.id === id)) setSelectedSt((prev) => [...prev, { id, note: '', planned_date: '' }])
                    }}
                  >
                    <option value="">— Choisir —</option>
                    {sousTraitants
                      .filter((st) => !selectedSt.some((s) => s.id === st.id))
                      .map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                          {st.trade ? ` — ${st.trade}` : ''}
                        </option>
                      ))}
                  </Select>
                </div>
                <div className="w-44">
                  <Input label="Ou nouveau : nom" placeholder="Électro Jura" value={newSt.name} onChange={(e) => setNewSt((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="w-36">
                  <Input label="Métier" placeholder="Électricien" value={newSt.trade} onChange={(e) => setNewSt((p) => ({ ...p, trade: e.target.value }))} />
                </div>
                <Button variant="secondary" onClick={addSousTraitant} disabled={!newSt.name.trim()} loading={createSousTraitant.isPending}>
                  Créer
                </Button>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="2 · Devis" description="À prévoir : suivi seulement, pas encore d'édition.">
              <div className="space-y-4">
                <Select label="État du devis" error={errors.quote_status?.message} {...register('quote_status')}>
                  {QUOTE_STATUSES.map((q) => (
                    <option key={q.value} value={q.value}>
                      {q.label}
                    </option>
                  ))}
                </Select>
                {quoteStatus !== 'none' && (
                  <>
                    <Input label="Montant (CHF)" type="number" step="0.05" min={0} error={errors.quote_amount?.message} {...register('quote_amount')} />
                    <Input label="Envoyé le" type="date" error={errors.quote_sent_at?.message} {...register('quote_sent_at')} />
                    {(quoteStatus === 'accepted' || quoteStatus === 'refused') && <Input label={quoteStatus === 'accepted' ? 'Accepté le' : 'Refusé le'} type="date" error={errors.quote_accepted_at?.message} {...register('quote_accepted_at')} />}
                  </>
                )}
              </div>
            </Card>

            <Card title="3 · Reprise des mesures" description="Éventuellement, sur place, après acceptation du devis.">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 accent-primary" {...register('remeasure_needed')} />
                Mesures à reprendre sur place
              </label>
              {remeasure && (
                <div className="mt-3">
                  <Input label="Reprises le" type="date" error={errors.remeasured_at?.message} {...register('remeasured_at')} />
                  <Button variant="ghost" size="sm" className="mt-1" onClick={() => setValue('remeasured_at', todayKey(), { shouldDirty: true })}>
                    Aujourd'hui
                  </Button>
                </div>
              )}
            </Card>

            <Card title="4 · Estimation pour le planning" description="Heures à répartir sur les équipes.">
              <Input label="Heures prévues" type="number" step="0.5" min={0} placeholder="Ex. 110" error={errors.planning_hours?.message} {...register('planning_hours')} />
              <p className="mt-2 text-xs text-gray-500">
                {c.affectations_count ?? 0} jour(s) planifié(s) ·{' '}
                <Link to={`/planning?chantier=${c.id}`} className="text-primary hover:underline">
                  planifier
                </Link>
              </p>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Input label="Du" type="date" value={recapRange.from} onChange={(e) => setRecapRange((r) => ({ ...r, from: e.target.value }))} />
            </div>
            <div className="w-40">
              <Input label="Au" type="date" value={recapRange.to} onChange={(e) => setRecapRange((r) => ({ ...r, to: e.target.value }))} />
            </div>
            {(recapRange.from || recapRange.to) && (
              <Button variant="ghost" size="sm" onClick={() => setRecapRange({ from: '', to: '' })}>
                Tout le chantier
              </Button>
            )}
            <div className="ml-auto">
              <Button variant="secondary" onClick={() => downloadRecapCsv(c, recapParams).catch((err) => toast(getErrorMessage(err), 'error'))}>
                Exporter CSV
              </Button>
            </div>
          </div>

          {loadingRecap || !recap ? (
            <Spinner block />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Heures pointées" value={formatMinutes(recap.totals.worked_minutes)} hint={`${formatMinutes(recap.totals.validated_minutes)} validées`} tone="primary" />
                <StatCard label="Heures planifiées" value={formatMinutes(recap.totals.planned_minutes)} hint={`${recap.totals.days} jour(s) · ${recap.affectations.length} affectation(s)`} />
                <StatCard
                  label="Estimation"
                  value={recap.totals.planning_estimate_minutes ? formatMinutes(recap.totals.planning_estimate_minutes) : recap.totals.estimated_minutes ? formatMinutes(recap.totals.estimated_minutes) : '—'}
                  hint={recap.totals.estimated_minutes ? `initiale ${formatMinutes(recap.totals.estimated_minutes)}` : 'non renseignée'}
                  tone={recap.totals.planning_estimate_minutes && recap.totals.worked_minutes > recap.totals.planning_estimate_minutes ? 'warn' : 'default'}
                />
                <StatCard label="Devis" value={c.quote_amount != null ? formatMoney(c.quote_amount) : '—'} hint={c.quote_status_label} />
              </div>

              <Card title="Heures par personne" flush>
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Personne</th>
                      <th className="px-4 py-2 text-right font-medium">Validées</th>
                      <th className="px-4 py-2 text-right font-medium">Soumises</th>
                      <th className="px-4 py-2 text-right font-medium">Brouillon</th>
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recap.by_user.map((row) => (
                      <tr key={row.user.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-2">
                            <Avatar name={row.user.name} color={row.user.color} size="sm" />
                            <span className="text-gray-900">{row.user.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-green-700">{formatMinutes(row.validated_minutes)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-blue-700">{formatMinutes(row.submitted_minutes)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-500">{formatMinutes(row.draft_minutes)}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatMinutes(row.worked_minutes)}</td>
                      </tr>
                    ))}
                    {recap.by_user.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                          Aucune heure pointée sur ce chantier.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {recap.by_user.length > 0 && (
                    <tfoot className="border-t border-gray-200 bg-gray-50/60 font-semibold">
                      <tr>
                        <td className="px-4 py-2">Total</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatMinutes(recap.totals.validated_minutes)}</td>
                        <td className="px-4 py-2" />
                        <td className="px-4 py-2" />
                        <td className="px-4 py-2 text-right tabular-nums">{formatMinutes(recap.totals.worked_minutes)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </Card>

              <Card title="Détail des pointages" flush>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Date</th>
                        <th className="px-4 py-2 text-left font-medium">Personne</th>
                        <th className="px-4 py-2 text-left font-medium">Horaire</th>
                        <th className="px-4 py-2 text-right font-medium">Heures</th>
                        <th className="px-4 py-2 text-left font-medium">Statut</th>
                        <th className="px-4 py-2 text-left font-medium">Commentaire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recap.entries.map((e) => (
                        <tr key={e.id} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-2 whitespace-nowrap">{formatDate(e.date)}</td>
                          <td className="px-4 py-2">{e.user}</td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {e.start_time} – {e.end_time}
                            {e.break_minutes > 0 && <span className="text-xs text-gray-500"> · pause {e.break_minutes}</span>}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatMinutes(e.minutes)}</td>
                          <td className="px-4 py-2">
                            <Badge tone={e.status === 'validated' ? 'success' : e.status === 'submitted' ? 'info' : 'neutral'}>{e.status_label}</Badge>
                          </td>
                          <td className="px-4 py-2 text-xs italic text-gray-500">{e.comment}</td>
                        </tr>
                      ))}
                      {recap.entries.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                            Aucun pointage.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </form>
  )
}
