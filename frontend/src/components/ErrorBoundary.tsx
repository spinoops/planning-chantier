import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Filet de sécurité : une erreur de rendu React affiche un écran de secours
 * au lieu d'une page blanche. Le détail est loggé en console.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Erreur de rendu :', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Oups, quelque chose s'est mal passé.</h1>
          <p className="mt-2 text-sm text-gray-600">
            L'erreur a été enregistrée. Recharge la page pour continuer.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 overflow-auto rounded-lg bg-gray-100 p-3 text-left text-xs text-red-700">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Recharger
          </button>
        </div>
      </div>
    )
  }
}
