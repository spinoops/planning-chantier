/*
 * Verrou de défilement partagé par toutes les modales ouvertes (elles peuvent s'imbriquer :
 * affectation → nouveau chantier → nouveau client). Un compteur évite qu'une fermeture dans
 * le mauvais ordre laisse la page figée (body overflow hidden) — constaté sur Mac / Brave.
 */
let openModals = 0

export function lockScroll(): void {
  openModals += 1
  document.body.style.overflow = 'hidden'
}

/** `force` remet tout à zéro (changement de page : aucune modale ne survit). */
export function unlockScroll(force = false): void {
  openModals = force ? 0 : Math.max(0, openModals - 1)
  if (openModals === 0) document.body.style.overflow = ''
}
