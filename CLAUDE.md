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
- Comptes de démo (mot de passe `password`) : `admin@baseapp.test` (admin) ·
  `robin@baseapp.test` (Robin Braun, chef : planifie) · `leo@`, `davison@`, `etienne@`, `david@baseapp.test`
  (ouvriers). Ce sont les vrais employés (Robin Braun, Davison Da Silva Setubal, Léo Lançon,
  Étienne Armand, David Batista Setubal), chacun dans une équipe individuelle à la couleur de son
  ancien calendrier Apple (réf. `_construction/*.pdf`). Le seeder ajoute des chantiers (clients)
  et deux semaines d'affectations en demi-journées.
- Réinitialiser les données de démo : `backend\artisan.bat migrate:fresh --seed`.

## Métier
- **Rôles** (`config/roles.php`) : `admin`, `chef` (planifie), `ouvrier` (consulte).
  `planners` = rôles autorisés à écrire (chantiers + planning) ; `assignable` = rôles
  qu'on peut placer sur un chantier (ouvrier + chef). `User::isPlanner()`, `User::assignable()`.
- **Équipe** (`equipes`) : nom, couleur, ordre ; un employé a **une** équipe au plus (`users.equipe_id`,
  `PUT /equipes/{id}` avec `member_ids` retire les membres de leur ancienne équipe). Le planning se
  fait par équipe : `affectations.equipe_id` + **copie des membres** dans `affectation_user` à la
  création (snapshot ; l'équipe peut être ajustée pour un jour). Changer l'`equipe_id` d'une
  affectation sans `worker_ids` remplace ses ouvriers par ceux de la nouvelle équipe.
  Couleur d'un événement = couleur de l'équipe (sinon celle du chantier).
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
- `GET /equipes` (tous, avec membres) ; `GET /planning` accepte aussi `&equipe_id=`.
- Planificateurs (`role:admin|chef`) : `POST/PUT/DELETE /chantiers`, `POST/PUT/DELETE /equipes`, `GET /workers`,
  `POST /planning`, `PUT /planning/{id}` (champs optionnels : `{date}` seul = déplacement),
  `DELETE /planning/{id}`, `POST /planning/copy-week {from, to, replace?}` (lundis).
- `GET /dashboard` renvoie `planning` (état du jour) pour les planificateurs.

## Front (`frontend/src`)
- Pages : `PlanningPage` (colonne équipes + calendrier, état dans l'URL `?view=&d=&chantier=`),
  `ChantiersPage` (cartes + formulaire), `EquipesPage` (équipes + membres), `MyPlanningPage`
  (`/mon-planning`, vue ouvrier), `DashboardPage` (état du jour). Accueil `/` → `HomeRedirect` selon le rôle.
- Calendrier : **FullCalendar 6** (même bibliothèque qu'ela-planning) dans
  `components/planning/PlanningCalendar.tsx`, maquette de référence = Apple Calendrier
  (`_construction/*.pdf`). Vues `dayGridMonth` (Mois), `timeGridWeek` (Semaine, grille horaire
  06:00–19:30, équipes côte à côte), `timeGridDay` (Jour), `listWeek` (Liste), `resourceTimelineWeek`
  (« Par équipe », une ligne par équipe, plugin premium : clé `VITE_FC_LICENSE_KEY`, sinon clé
  d'évaluation non commerciale). Header FullCalendar masqué : la barre est `CalendarToolbar`
  (pilotage via ref `prev/next/today`). Sélection d'une plage → création, clic → modale,
  `eventDrop`/`eventResize` → `PUT /planning/{id}` (revert si erreur) ; en vue « Par équipe »,
  changer de ligne envoie `equipe_id` (l'API remplace les ouvriers). Cartes : titre = chantier,
  adresse, horaire (rendu `eventContent`), couleur de l'équipe ; cartes étroites → titre seul
  (container query). Thème CSS `.pc-calendar` / `.pc-event` dans `index.css`.
- `TeamSidebar` : équipes avec case colorée (afficher / masquer, double-clic = seule ; persisté dans
  `localStorage` `planning_hidden_equipes`, filtrage côté client) **et glisser-déposer** :
  - **dnd-kit** (`@dnd-kit/core`) pour recomposer les équipes : personne → autre équipe (`PUT /equipes/{id}`
    avec `member_ids`), → « Sans équipe », → « Nouvelle équipe » (création nommée du prénom) ;
    équipe déposée sur une équipe = fusion des membres. Renommage / couleur / suppression inline (crayon).
  - **FullCalendar `ThirdPartyDraggable`** (même conteneur, `itemSelector: [data-fc-drag]`,
    `mirrorSelector: .dnd-mirror`, `create: false`) : déposer une équipe ou une personne sur le
    calendrier appelle `drop` de `PlanningCalendar` → modale de création pré-remplie (équipe ou
    personne, jour, créneau de 4 h depuis l'heure de dépôt). Ne pas remplacer par du HTML5 natif :
    FullCalendar 6 ne le reçoit pas.
  - **Dépôt sur une carte existante** : FullCalendar ne le gère pas, donc `PlanningCalendar` pose
    `data-affectation-id` sur chaque carte (`eventDidMount`), met en évidence la carte sous le pointeur
    pendant le glisser (`externalDragging` → classe `pc-event--drop-target`, via `elementsFromPoint`)
    et, dans `drop`, si une carte est sous le point de dépôt, appelle `onDropOnEvent` : la page ajoute
    les membres (`worker_ids` fusionnés ; une équipe déposée sur une affectation sans équipe lui est attribuée).
  - Modale d'affectation : bouton « + » à côté du chantier → `QuickChantierModal` (nom, adresse, ville,
    couleur ; statut `active`) puis sélection automatique du chantier créé. Palette partagée `lib/colors.ts`.
  Doublons = même personne sur deux créneaux qui se chevauchent (`timesOverlap` de `lib/dates.ts`).
- Autres composants : `AffectationCard` (tableau de bord), `AffectationModal` (sélecteur d'équipe
  qui pré-coche ses membres), `WorkerPicker`. `lib/dates.ts` : semaines lundi→dimanche, clés `YYYY-MM-DD`.
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
