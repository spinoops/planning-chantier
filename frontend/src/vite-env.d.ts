/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de base de l'API Laravel (sans le suffixe /api). */
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
