import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useActivity } from '@/hooks/useActivity'
import { describeActivity, EVENT_LABELS } from '@/lib/activity'
import { formatDateTime } from '@/lib/format'
import type { ActivityEntry } from '@/types'
import Badge from '@/components/ui/Badge'
import type { BadgeTone } from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/ui/PageHeader'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Select from '@/components/ui/Select'

const EVENT_TONES: Record<string, BadgeTone> = {
  created: 'success',
  updated: 'info',
  deleted: 'danger',
  restored: 'warn',
  login: 'neutral',
}

export default function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const search = searchParams.get('search') ?? ''
  const event = searchParams.get('event') ?? ''
  const [selected, setSelected] = useState<ActivityEntry | null>(null)

  const { data, isLoading, isFetching } = useActivity({ page, search: search || undefined, event: event || undefined })

  function setParam(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  return (
    <div>
      <PageHeader title="Journal d'activité" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => setParam('search', v)} placeholder="Rechercher dans les descriptions…" className="w-full sm:w-72" />
        <Select value={event} onChange={(e) => setParam('event', e.target.value)} className="sm:w-52" aria-label="Filtrer par événement">
          <option value="">Tous les événements</option>
          {Object.keys(EVENT_LABELS).map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </Select>
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          rowKey={(e) => e.id}
          loading={isLoading}
          busy={isFetching}
          empty="Aucune activité enregistrée."
          onRowClick={setSelected}
          columns={[
            { key: 'created_at', header: 'Date', className: 'whitespace-nowrap', render: (e) => formatDateTime(e.created_at) },
            { key: 'causer', header: 'Par', render: (e) => e.causer?.name ?? <span className="text-gray-400">Système</span> },
            {
              key: 'event',
              header: 'Événement',
              render: (e) => (e.event ? <Badge tone={EVENT_TONES[e.event] ?? 'neutral'}>{e.event}</Badge> : '—'),
            },
            { key: 'description', header: 'Description', render: (e) => describeActivity(e) },
          ]}
        />
        <Pagination meta={data?.meta} onPageChange={(p) => setParam('page', String(p))} />
      </Card>

      <Modal open={selected !== null} onClose={() => setSelected(null)} title="Détail de l'entrée" size="lg">
        {selected && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-800">{describeActivity(selected)}</p>
            <dl className="grid grid-cols-3 gap-y-1 text-gray-600">
              <dt className="font-medium text-gray-500">Date</dt>
              <dd className="col-span-2">{formatDateTime(selected.created_at)}</dd>
              <dt className="font-medium text-gray-500">Sujet</dt>
              <dd className="col-span-2">
                {selected.subject_type ? `${selected.subject_type} #${selected.subject_id}` : '—'}
              </dd>
              <dt className="font-medium text-gray-500">Journal</dt>
              <dd className="col-span-2">{selected.log_name ?? '—'}</dd>
            </dl>
            <pre className="max-h-72 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
              {JSON.stringify(selected.properties, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  )
}
