import { useEffect, useState } from 'react'
import type { Toast } from '@/lib/toast'
import { dismiss, subscribe } from '@/lib/toast'

const STYLES: Record<Toast['type'], string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-gray-200 bg-white text-gray-800',
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
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm shadow-lg ${STYLES[item.type]}`}
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/10 text-xs font-bold">
            {ICONS[item.type]}
          </span>
          <span className="flex-1">{item.message}</span>
        </button>
      ))}
    </div>
  )
}
