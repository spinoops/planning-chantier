import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Bouton de confirmation rouge (suppression…). */
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined)

/**
 * Fournit `useConfirm()` : une boîte de confirmation en promesse, qui remplace
 * `window.confirm` avec le style de l'app.
 *
 *   const confirm = useConfirm()
 *   if (await confirm({ title: 'Supprimer ?', danger: true })) …
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = useCallback((value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={options !== null} onClose={() => close(false)} title={options?.title} size="sm">
        {options?.message && <div className="text-sm text-gray-600">{options.message}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)} autoFocus>
            {options?.cancelLabel ?? 'Annuler'}
          </Button>
          <Button variant={options?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {options?.confirmLabel ?? 'Confirmer'}
          </Button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) {
    throw new Error("useConfirm doit être utilisé à l'intérieur de <ConfirmProvider>.")
  }
  return confirm
}
