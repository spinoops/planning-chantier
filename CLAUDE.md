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
  `robin@baseapp.test` (Robin Braun, patron : admin + chef) · `davison@baseapp.test` (gestionnaire, bureau) ·
  `leo@`, `etienne@`, `david@baseapp.test` (ouvriers). Ce sont les vrais employés (Robin Braun, Davison Da Silva Setubal, Léo Lançon,
  Étienne Armand, David Batista Setubal), chacun dans une équipe individuelle à la couleur de son
  ancien calendrier Apple (réf. `_construction/*.pdf`). Le seeder ajoute des chantiers (clients)
  et deux semaines d'affectations en demi-journées.
- Réinitialiser les données de démo : `backend\artisan.bat migrate:fresh --seed`.

## Métier
- **Rôles** (`config/roles.php`, lignes `roles` spatie créées par migration / seeder / `ensureRoles()`) :
  `admin` (comptes, rôles, configuration + planifie), `gestionnaire` (bureau : prépare les chantiers,
  planifie, valide heures et absences — Davison), `chef` (patron / chef de chantier : planifie, passages),
  `ouvrier` (consulte, pointe). **Un compte peut cumuler plusieurs rôles** (Robin = admin + chef) : la page
  Équipe & comptes propose des cases à cocher avec la description de chaque rôle (`descriptions`,
  renvoyées par `GET /roles`). `planners` = admin + gestionnaire + chef (écriture chantiers / planning,
  miroir `PLANNER_ROLES` dans `lib/navigation.ts`) ; `assignable` = ouvrier + chef + gestionnaire.
  `User::isPlanner()`, `User::assignable()`. Ajouter un rôle = config + migration `Role::findOrCreate`.
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
- **Passage** : `affectation_user.role` = `worker` (équipe) ou `visit` (patron / chef qui passe) ;
  `Affectation::people()` (tout, pivot role), `workers()`, `visitors()`, `syncPeople($workers, $visitors)`.
  Un visiteur voit l'affectation dans « Mon planning » mais ne compte pas dans les doublons.
- **Heures pointées** (`time_entries`) : par employé, liées à une affectation (ou chantier libre),
  `start/end/break_minutes/comment`, statut `draft → submitted → validated` (verrouillé pour
  l'employé, un planificateur rouvre). `minutes()` = fin − début − pause. `GET /heures/summary` :
  planifié vs pointé par personne, pointé par chantier.
- **Absences** (`absences`) : `vacances|maladie|ecole|autre`, période ; `Absence::absentUserIds($date)`.
  Le front grise les absents (sélecteur) et les affiche en fond du calendrier.
- **Imprévus** (`signalements`) : message court d'un employé au bureau (`absence|fin_anticipee|materiel|autre`),
  `read_at` quand traité ; compteur dans le tableau de bord.
- **Photos** (`affectation_photos`) : disque `public`, dossier `affectations/{id}` (lien `storage:link`).
- **Récurrence** : `POST /planning` avec `repeat_until` + `repeat_days` (ISO, défaut lun–ven, 90 jours max)
  crée une affectation par jour ; réponse `{ data: première, created: n }`.
- **Équipes temporaires** : `equipes.expires_at` ; `GET /equipes` ne renvoie que les actives (`?all=1` pour tout).
- **Préparation du chantier (workflow en 7 étapes)** : `clients` (nom, contact, téléphone, e-mail, adresse ;
  `chantiers.client_id`, le champ texte `client` reste le nom affiché), `sous_traitants` + pivot
  `chantier_sous_traitant` (note, `planned_date`), et sur `chantiers` : `estimated_hours`, `mesures`,
  `materiel` (json `[{label, qty, unit, done}]`), devis (`quote_status` none|to_prepare|sent|accepted|refused,
  `quote_amount`, `quote_sent_at`, `quote_accepted_at`), reprise des mesures (`remeasure_needed`, `remeasured_at`),
  `planning_hours` (estimation pour le planning). `Chantier::steps()` dérive les 7 étapes
  (creation, devis, mesures, estimation, planning, heures, facturation ; état done|todo|pending|skipped|refused)
  renvoyées par `ChantierResource` quand `sousTraitants` est chargé (`GET /chantiers/{id}`).
  `GET /chantiers/{id}/recap[?from&to]` = récapitulatif pour la facturation (heures pointées par personne et
  statut, planifié, estimation, devis, affectations, pointages) ; `/recap.csv` = export CSV (`;`, BOM).
- **Réglages planning** (`Setting::defaults()`) : `planning_morning_*`, `planning_afternoon_*` (boutons
  Matin / Après-midi / Journée) et `planning_notify_after` : après cette heure, créer / modifier /
  supprimer une affectation d'aujourd'hui ou de demain envoie `PlanningChangedNotification` (mail) aux
  autres planificateurs (`AffectationObserver`, anti-rafale 10 min par jour et par auteur).

## API planning (`routes/api.php`, sous `auth:sanctum`)
- `GET /chantiers` (tous), `GET /planning?from&to[&chantier_id&worker_id&mine]` (max 100 jours ;
  un non-planificateur ne reçoit que ses affectations), `GET /planning/{id}`.
- `GET /equipes` (tous, avec membres) ; `GET /planning` accepte aussi `&equipe_id=`.
- Planificateurs (`role:admin|chef`) : `POST/PUT/DELETE /chantiers`, `POST/PUT/DELETE /equipes`, `GET /workers`,
  `POST /planning`, `PUT /planning/{id}` (champs optionnels : `{date}` seul = déplacement),
  `DELETE /planning/{id}`, `POST /planning/copy-week {from, to, replace?}` (lundis).
- `GET /dashboard` renvoie `planning` (état du jour) pour les planificateurs.
- `GET /clients`, `GET /clients/{id}`, `GET /sous-traitants` (tous) ; planificateurs : `apiResource` clients et
  sous-traitants, `GET /chantiers?client_id=`, `GET /chantiers/{id}/recap` et `/recap.csv`.

## Front (`frontend/src`)
- Pages : `PlanningPage` (colonne équipes + calendrier, état dans l'URL `?view=&d=&chantier=`),
  `ChantiersPage` (cartes **entièrement cliquables** vers la fiche ; actions = icônes rondes : crayon en
  verre, corbeille dans un rond rouge — demande explicite), `EquipesPage` (équipes + membres),
  `MyPlanningPage` (`/mon-planning`, vue ouvrier), `DashboardPage`. Accueil `/` → `HomeRedirect` selon le
  rôle (planificateurs → `/dashboard`).
- **Menu** (`lib/navigation.ts`) : court, une pilule par domaine avec sous-menus (`children`) :
  Tableau de bord · Planning · Chantiers (Tous les chantiers, Clients) · Équipe (Équipes, Heures,
  Absences) · Mon planning · Administration. `NavDropdown` dans `AppLayout` (`<details>`, fermeture au
  clic / Échap / clic dehors) ; le tiroir mobile aplatit les groupes avec un en-tête.
- **Tableau de bord** (planificateurs) : tuiles d'action rapide (`Tile` : Nouveau chantier →
  `QuickChantierModal` puis redirection vers la fiche ; Sur le terrain ; Heures à valider ; Imprévus ;
  Absences), « Chantiers du jour » (affectations du jour regroupées par chantier, créneaux, avatars,
  boutons Fiche / Planning), Disponibles, « La semaine en un coup d'œil » (barres), Imprévus, Heures par
  chantier, Absences. Plus d'« Activité récente » ni de statistiques de comptes (demande explicite).
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
- **Un calendrier par chantier** (demande explicite, à la manière d'Apple Calendrier) : les cartes
  prennent la **couleur du chantier** (plus celle de l'équipe) et montrent les **personnes affectées**
  (avatar + prénom ; prénoms masqués sous 150 px par container query). `ChantierSidebar` liste les
  chantiers ouverts (+ ceux qui ont encore des affectations) avec une case colorée afficher / masquer
  (double-clic = seul ; persisté `planning_hidden_chantiers`). `?chantier=ID` dans l'URL = ce chantier
  seul tant qu'on n'a pas touché aux cases (dérivé, pas d'effet setState). Vue « Par chantier »
  (`site`, timeline une ligne par chantier, prénoms dans les cartes ; changer de ligne envoie
  `chantier_id`). **Pas de carte en double** : à la création, si le même chantier a déjà une affectation
  sur ce jour et ce créneau exact, `AffectationModal` ajoute les personnes à cette carte (`PUT` avec
  `worker_ids` fusionnés) au lieu d'en créer une seconde ; le seeder crée lui aussi une seule affectation
  par chantier et créneau (plusieurs équipes → `equipe_id` vide, membres réunis). La vue Semaine reste `timeGridWeek` : l'utilisateur a refusé les colonnes par équipe
  (`resourceTimeGridWeek`, commit annulé) — ne pas y revenir.
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
  qui pré-coche ses membres, boutons Matin / Après-midi / Journée depuis les réglages, répétition,
  passage, étape, photos, dernier chantier mémorisé, Ctrl+Entrée), `WorkerPicker` (`busy`, `absent`),
  `TimeEntryModal` (pointage), `SignalementModal` (imprévu), `PhotoGallery`, `ui/AddressInput`
  (propositions d'adresses geo.admin.ch, saisie libre hors ligne). `lib/dates.ts` : semaines
  lundi→dimanche, clés `YYYY-MM-DD`, `timesOverlap`. `lib/format.ts` : `formatMinutes`.
- Pages ajoutées : `MyPlanningPage` (pointer, photos, imprévu, récap et envoi des heures de la semaine),
  `HeuresPage` (`/heures` : synthèse, validation / réouverture en lot, correction), `AbsencesPage`,
  `PrintWeekPage` (`/planning/print?d=&equipe=` : une page A4 par équipe, styles `@media print`).
  Vue par défaut du planning : « Semaine ».
- Workflow chantier : `ChantierDetailPage` (`/chantiers/:id`) = frise des 7 étapes (`c.steps`) + onglets
  « Fiche de préparation » (client via `ClientSelect`, adresse, estimation, mesures, remarques, checklist matériel,
  sous-traitants, devis, reprise des mesures, estimation planning) et « Récapitulatif facturation » (période,
  cartes de synthèse, heures par personne, détail des pointages, bouton « Exporter CSV » via `downloadRecapCsv`).
  `ClientsPage` (`/clients`, CRUD). `ClientSelect` (liste + « + » création rapide) utilisé dans `ChantiersPage`,
  `QuickChantierModal` et la fiche. `ChantierSheetModal` = fiche en lecture seule pour les employés (bouton
  « Fiche » dans `MyPlanningPage` et lien dans `AffectationModal`). Hooks : `useClients`, `useSousTraitants`,
  `useChantier(id)`, `useChantierRecap`. `AddressInput` ne lance la recherche qu'après une frappe de l'utilisateur
  (pas lors d'un `reset` du formulaire).
- **Hors ligne léger** : `public/sw.js` (coquille + lectures d'API « réseau d'abord, cache sinon »,
  enregistré en production dans `main.tsx`), `public/manifest.webmanifest` (installable, démarre sur
  `/mon-planning`), `lib/offlineQueue.ts` (pointages / imprévus saisis sans réseau mis en file dans
  `localStorage`, envoyés à l'événement `online`). Hooks : `useTimeEntries`, `useAbsences`,
  `useSignalements`, `usePhotos`.
- Couleur d'un chantier : variable CSS `--chantier` + classes `.chantier-card` / `.chantier-dot`
  (`index.css`). Avatars : `components/ui/Avatar.tsx` (couleur du compte ou dérivée du nom).
- Hooks : `useChantiers` / `useOpenChantiers`, `usePlanning` (+ create/update/delete/copyWeek),
  `useWorkers`. Navigation et rôles planificateurs : `lib/navigation.ts` (`PLANNER_ROLES`).

## Design (style Apple — « Liquid Glass », macOS Tahoe / iOS 26)
- **Règle absolue (retour utilisateur)** : jamais de liseré coloré sur **un seul côté** d'un élément aux
  coins arrondis (`border-left-width` + `border-radius`, barre verticale à côté d'un texte…). Les couleurs
  passent par un **fond teinté uniforme**, un point / avatar coloré ou une pastille. Pas de bordures grises
  opaques non plus : les panneaux sont en verre.
- **Verre liquide** (`index.css`) : fond d'écran fixe `body::before` (halos dérivés de `--color-primary`),
  classes `.glass` (barres, menus), `.glass-panel` (cartes, colonnes, calendrier), `.glass-strong` (modales,
  connexion), `.glass-pill` (boutons secondaires, pilules), `.gloss` (reflet des boutons pleins). Toutes =
  blanc translucide + `backdrop-filter` + reflet `inset 0 1px` + ombre douce, **sans bordure**. Boutons et
  contrôles segmentés en **capsules** (`rounded-full`). FullCalendar sur fond transparent, cartes d'événement
  teintées (`tint(color, 24)`, `borderColor: 'transparent'`), aujourd'hui en rouge.
- **Identité Top Stores** : logo `frontend/public/logo.svg` (variante pour fonds clairs : « STORES » en gris
  foncé, dérivée de `D:\wamp64\www	op-stores\_construction\Logotype\logo-blanc.svg`, copié tel quel en
  `logo-blanc.svg` pour les fonds sombres), favicon = emblème rond. `DEFAULT_LOGO` (`branding.ts`) est
  affiché dans la barre et à la connexion sauf si `app_logo_url` est renseigné en Configuration. Couleur
  principale par défaut = **rouge du logo `#e30917`** (le fond d'écran en dérive, en version adoucie).
- Demande initiale : « design style macOS, iOS, Apple ». Tout part des jetons dans
  `frontend/src/index.css` (`@theme`) : police système Apple avec repli **Inter** (chargée dans
  `index.html` pour Windows), **gris neutres iOS** (`--color-gray-*` remappés : fond `#f5f5f7`, séparateurs
  `#e5e5ea`, texte `#1c1c1e`), couleur principale par défaut (`branding.ts`,
  `Setting::defaults()`, seeder, manifest ; voir « Identité Top Stores »), couleurs système `--color-sys-*` (+ variantes `-soft` / `-deep`
  pour les pastilles), rayons plus ronds (`--radius-*`, cartes 18 px, modales 22 px), ombres douces.
- Kit `components/ui` : boutons pleins ou « teintés gris » sans bordure (`active:scale`), champs teintés qui
  passent au blanc avec halo au focus (`FIELD_CLASS`, `LABEL_CLASS`), cartes à liseré fin, modales avec
  animation `pc-pop` (feuille iOS sur mobile), toasts sombres translucides, interrupteur iOS vert,
  tableaux sans capitales. Barre d'application en verre dépoli (`.glass`), navigation en pilules.
- Calendrier : hairlines, **aujourd'hui en rouge** (pastille du jour, ligne « maintenant ») comme Apple
  Calendrier, contrôle segmenté macOS pour les vues (`CalendarToolbar`).
- **Planning pleine largeur** : `AppLayout` retire la largeur maximale pour les routes de
  `FULL_WIDTH_PREFIXES` (`/planning`) — demande explicite ; les autres pages restent centrées (`max-w-7xl`).

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
