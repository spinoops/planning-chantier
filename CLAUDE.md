# CLAUDE.md

Contexte pour Claude Code sur ce dépôt. À lire avant toute intervention.

## Projet
**Planning Chantier** — application de planification des ouvriers sur les chantiers,
dérivée du template **baseapp** (Laravel 13 API + React SPA). Un chef de chantier place
chaque jour les chantiers dans un calendrier (mois / semaine / liste) et y affecte des
ouvriers ; chaque ouvrier consulte son planning personnel sur tablette ou téléphone.

## ⚠️ Piège PHP (IMPORTANT)
Le `php` du PATH Windows est en **8.1** (trop vieux pour Laravel 13, qui exige **PHP >= 8.3**).
La version installée sous WAMP est **8.4.24** :
- Backend : utiliser **`backend\artisan.bat <cmd>`** (wrapper qui sélectionne le PHP 8.4/8.3
  le plus récent), ou le chemin direct `D:\wamp64\bin\php\php8.4.24\php.exe`.
- Composer/tests : les lancer avec PHP 8.4 (ex. `$env:Path = 'D:\wamp64\bin\php\php8.4.24;' + $env:Path`).

## Démarrer
- **`dev.bat`** (racine) lance le backend (**:8002**) + le frontend (**:5175**, hot-reload).
  **WAMP (MySQL) doit tourner.** Base : `app_planningchantier`.
- Comptes de démo (mot de passe `password`) :
  `admin@baseapp.test` (admin) · `chef@baseapp.test` (chef de chantier) · `ouvrier@baseapp.test` (ouvrier).
  Le seeder crée aussi 6 autres ouvriers, 5 chantiers et 3 semaines d'affectations.
- Réinitialiser les données de démo : `backend\artisan.bat migrate:fresh --seed`.

## Métier
- **Rôles** (`config/roles.php`) : `admin`, `chef` (planifie), `ouvrier` (consulte).
  `planners` = rôles autorisés à écrire (chantiers + planning) ; `assignable` = rôles
  qu'on peut placer sur un chantier (ouvrier + chef). `User::isPlanner()`, `User::assignable()`.
- **Chantier** (`chantiers`) : nom, client, adresse, ville, couleur (#rrggbb, affichée dans le
  calendrier), statut `planned|active|paused|done`, dates, notes. Soft delete.
- **Affectation** (`affectations` + pivot `affectation_user`) : un chantier sur un jour,
  créneau optionnel (`start_time`/`end_time`), note, équipe (`workers()`).
  Une journée peut contenir plusieurs affectations du même chantier (matin / après-midi).
- **Doublons** : un ouvrier affecté deux fois le même jour n'est pas bloqué par l'API ;
  le front le signale (badge « ! », mention « déjà sur … » dans le sélecteur).

## API planning (`routes/api.php`, sous `auth:sanctum`)
- `GET /chantiers` (tous), `GET /planning?from&to[&chantier_id&worker_id&mine]` (max 100 jours ;
  un non-planificateur ne reçoit que ses affectations), `GET /planning/{id}`.
- Planificateurs (`role:admin|chef`) : `POST/PUT/DELETE /chantiers`, `GET /workers`,
  `POST /planning`, `PUT /planning/{id}` (champs optionnels : `{date}` seul = déplacement),
  `DELETE /planning/{id}`, `POST /planning/copy-week {from, to, replace?}` (lundis).
- `GET /dashboard` renvoie `planning` (état du jour) pour les planificateurs.

## Front (`frontend/src`)
- Pages : `PlanningPage` (calendrier, état dans l'URL `?view=&d=&chantier=&ouvrier=`),
  `ChantiersPage` (cartes + formulaire), `MyPlanningPage` (`/mon-planning`, vue ouvrier),
  `DashboardPage` (état du jour). Accueil `/` → `HomeRedirect` selon le rôle.
- Calendrier : **FullCalendar 6** (même bibliothèque qu'ela-planning) dans
  `components/planning/PlanningCalendar.tsx` : vues `dayGridMonth` (Mois), `dayGridWeek` (Semaine,
  cartes empilées), `timeGridDay` (Jour, horaires), `listWeek` (Liste), `resourceTimelineWeek`
  (« Par ouvrier », plugin premium : clé `VITE_FC_LICENSE_KEY`, sinon clé d'évaluation non
  commerciale). Header FullCalendar masqué : la barre est `CalendarToolbar` (pilotage via ref
  `prev/next/today`). Sélection d'une plage → création, clic → modale, `eventDrop`/`eventResize`
  → `PUT /planning/{id}` (revert si erreur) ; en vue « Par ouvrier », changer de ligne réaffecte
  la personne (`worker_ids`). Événements construits dans `PlanningCalendar` (couleur du chantier
  en `backgroundColor`/`borderColor`, rendu `eventContent`), thème CSS `.pc-calendar` / `.pc-event`
  dans `index.css`. Autres composants : `AffectationCard` (tableau de bord), `AffectationModal`,
  `WorkerPicker`. `lib/dates.ts` : semaines lundi→dimanche, clés `YYYY-MM-DD`.
- Couleur d'un chantier : variable CSS `--chantier` + classes `.chantier-card` / `.chantier-dot`
  (`index.css`). Avatars : `components/ui/Avatar.tsx` (couleur du compte ou dérivée du nom).
- Hooks : `useChantiers` / `useOpenChantiers`, `usePlanning` (+ create/update/delete/copyWeek),
  `useWorkers`. Navigation et rôles planificateurs : `lib/navigation.ts` (`PLANNER_ROLES`).

## Stack
- **Backend** : Laravel 13, PHP 8.3+, Sanctum (auth par token), spatie/laravel-permission
  (rôles), spatie/laravel-activitylog (audit), Pest (tests), Pint (format), Telescope (dev).
- **Frontend** : React 19, Vite, TypeScript, TailwindCSS v4, TanStack Query,
  react-hook-form + zod, axios, react-router-dom.
- **DB** : MySQL (WAMP en local).

## Conventions (héritées de baseapp)
- Validation → Form Requests ; sorties → API Resources ; listes paginées `?search=&sort=&dir=&per_page=`.
- Accès → middleware `admin`, `role:`, `module:<clé>`. Modèles → soft deletes + `LogsActivity`.
- Front : données via hooks TanStack Query (jamais de `fetch` dans les pages), formulaires
  react-hook-form + zod, kit `components/ui`, `toast()`, thème `--color-primary` (Configuration).
- Générateur d'entité : `backend\artisan.bat make:crud Nom --fields="…" --front` (repères
  `// make:crud` dans `routes/api.php`, `App.tsx`, `lib/navigation.ts` — ne pas les supprimer).

## Qualité
- Tests : `backend\artisan.bat test` (Pest, SQLite en mémoire). Helpers : `actingAsAdmin()`,
  `actingAsRole('chef')`, `actingAsUser()` (= rôle par défaut `ouvrier`), `ensureRoles()`.
- Format PHP : `composer pint`. Front : `npm run lint` et `npm run build` (dans `frontend/`).

## Base de données
- Schéma **uniquement via migrations**. phpMyAdmin : http://localhost/phpmyadmin (`root`, sans mot de passe).

## Ne jamais committer
`.env`, `vendor/`, `node_modules/`, `frontend/dist/`, `storage/*`, `backend/public/storage`.

## Déploiement
Voir `DEPLOY.md` (Infomaniak mutualisé : doc root → `backend/public`, build front en
local, `migrate --force` en prod, `storage:link`, cron `schedule:run`).
