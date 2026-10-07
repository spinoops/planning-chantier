import { useEffect, useState } from 'react'
import type { Toast } from '@/lib/toast'
import { dismiss, subscribe } from '@/lib/toast'

/* Bannières sombres translucides, façon notifications iOS. */
const ICON_STYLES: Record<Toast['type'], string> = {
  success: 'bg-sys-green text-white',
  error: 'bg-sys-red text-white',
  info: 'bg-sys-blue text-white',
}

const ICONS: Record<Toast['type'], string> = {
  success: '✓',
  error: '!',
  info: 'i',
}

export default function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([])

  useEffect(() => subscribe(setItems), [])

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => dismiss(item.id)}
          className="pc-pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-gray-900/90 px-4 py-3 text-left text-sm text-white shadow-xl ring-1 ring-white/10 backdrop-blur-xl"
        >
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${ICON_STYLES[item.type]}`}>
            {ICONS[item.type]}
          </span>
          <span className="flex-1 leading-snug">{item.message}</span>
        </button>
      ))}
    </div>
  )
}
