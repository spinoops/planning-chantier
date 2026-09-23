# Planning Chantier — planification des ouvriers sur les chantiers

Application dérivée du template **baseapp** : une **API REST Laravel 13** (Sanctum) et un
**front React (Vite + TypeScript + TailwindCSS)** servi séparément.

- **Chef de chantier / admin** : calendrier type agenda (mois, semaine, liste), création
  d'une affectation par clic, déplacement par glisser-déposer, copie de la semaine
  précédente, filtres par chantier et par ouvrier, signalement des doublons.
- **Ouvrier** (tablette / téléphone) : page « Mon planning » avec ses chantiers du jour et
  de la semaine, horaires, adresse (itinéraire), collègues et consignes.
- **Chantiers** : fiches (client, adresse, couleur, statut, dates) ; **Équipe** : comptes
  avec métier, téléphone et couleur d'avatar.

Ports de dev : API `:8002`, front `:5175` (voir `backend/.env` et `frontend/.env`).
Comptes de démo (mot de passe `password`) : `admin@baseapp.test`, `chef@baseapp.test`, `ouvrier@baseapp.test`.

## Stack

| CÃ´tÃ©      | Techno                                                                                  |
|-----------|-----------------------------------------------------------------------------------------|
| Backend   | Laravel 13, PHP 8.3+, Sanctum, spatie/permission, spatie/activitylog, Pest, Telescope (dev), MySQL |
| Frontend  | React 19, Vite, TypeScript, TailwindCSS v4, TanStack Query, react-hook-form + zod, axios, react-router |

```
app-planningchantier/
âââ backend/    # API Laravel (http://localhost:8002)
âââ frontend/   # SPA React (http://localhost:5175)
âââ dev.bat     # lance les deux serveurs de dev
âââ new-project.ps1   # dÃ©rive un nouveau projet Ã  partir du template
```

## Ce que le socle fournit

**CÃ´tÃ© utilisateur**
- Connexion par token, mot de passe oubliÃ© / rÃ©initialisation par email.
- **Profil** : modifier son nom/email, changer son mot de passe (les autres appareils sont dÃ©connectÃ©s).
- **Tableau de bord** avec indicateurs (comptes, invitations, inscriptions par mois, activitÃ© rÃ©cente).

**CÃ´tÃ© administration**
- **Utilisateurs** : liste paginÃ©e, recherche, filtre par rÃ´le, tri, **corbeille** (soft delete) et restauration ; rÃ´les avec libellÃ©s (`config/roles.php`).
- **Invitations** : lien d'inscription Ã  usage unique, expirable, envoyÃ© par email (module).
- **Journal d'activitÃ©** : qui a fait quoi et quand (crÃ©ations, modifications, suppressions, connexions), filtrable.
- **Configuration** : nom, logo (tÃ©lÃ©versement), couleur principale appliquÃ©e Ã  toute l'interface ; **modules** activables ; **sauvegardes** de la base (dump compressÃ©, rotation, tÃ©lÃ©chargement, cron quotidien).

**CÃ´tÃ© dÃ©veloppeur**
- `php artisan make:crud` : gÃ©nÃ¨re une entitÃ© complÃ¨te (modÃ¨le, migration, factory, Resource, Requests, contrÃ´leur paginÃ©, test Pest, routes) et, avec `--front`, le hook, la page React, la route et l'entrÃ©e de menu.
- Kit UI React (`src/components/ui`) : Button, Input, Select, Textarea, Checkbox, Toggle, Modal, ConfirmDialog, DataTable, Pagination, SearchInput, Card, PageHeader, Badge, StatCard, EmptyState, Spinner, Toast.
- Helpers : `lib/errors.ts` (erreurs API â formulaires), `lib/format.ts` (dates, nombres, montants), `lib/roles.ts`, `hooks/useListParams.ts` (page/recherche/tri dans l'URL).
- API : erreurs JSON uniformes (401/403/404/422), modules avec middleware `module:<clÃ©>`, `Gate::before` pour les admins, health check avec Ã©tat de la base.

## PrÃ©requis

- PHP **8.3+** (CLI) â sous WAMP, voir la note plus bas
- Composer 2
- Node **20+** et npm
- MySQL (fourni par WAMP)

## Installation

### 1. Backend

```bash
cd backend
composer install
copy .env.example .env          # (cp sous Linux/Mac)
artisan.bat key:generate        # ou: php artisan key:generate (PHP 8.3+)
```

CrÃ©er la base puis migrer/seed :

```bash
# CrÃ©e la base 'baseapp' (utf8mb4)
mysql -u root -e "CREATE DATABASE IF NOT EXISTS baseapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

artisan.bat migrate --seed
artisan.bat storage:link        # uploads (logo) servis via /storage
artisan.bat serve               # http://localhost:8000
```

> Ajuste `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` dans `backend/.env` si besoin.

### 2. Frontend

```bash
cd frontend
npm install
copy .env.example .env          # VITE_API_URL=http://localhost:8000, VITE_PORT=5173
npm run dev                     # http://localhost:5173
```

### Raccourci

`dev.bat` (racine) lance les deux serveurs dans deux fenÃªtres, avec les ports lus dans les `.env`.

## Comptes de dÃ©monstration

CrÃ©Ã©s par le seeder :

- **Admin** : `admin@baseapp.test` / `password`
- **Utilisateur** : `user@baseapp.test` / `password`

## Ajouter une entitÃ© mÃ©tier

```bash
cd backend
artisan.bat make:crud Facture --fields="numero:string,montant:decimal,echeance:date?,payee:boolean,notes:text?" --admin --front
artisan.bat migrate
artisan.bat test --filter=Facture
```

- Types de champs : `string`, `text`, `integer`, `decimal`, `boolean`, `date`, `datetime`, `foreign` (`client_id:foreign`). Un `?` final rend le champ nullable.
- `--admin` rÃ©serve les routes aux administrateurs ; sans, tout utilisateur connectÃ© y accÃ¨de.
- `--front` gÃ©nÃ¨re `hooks/useFactures.ts`, `pages/FacturesPage.tsx`, le type TS, la route dans `App.tsx` et l'entrÃ©e de menu dans `lib/navigation.ts`.
- `--plural=Chevaux --label="Cheval"` pour les pluriels irrÃ©guliers ; `--force` pour Ã©craser.

Les fichiers sont insÃ©rÃ©s aux repÃ¨res `// make:crud` prÃ©sents dans `routes/api.php`, `App.tsx` et `lib/navigation.ts` : ne les supprime pas.

## Endpoints API

| MÃ©thode | URL | Auth | Description |
|---------|-----|------|-------------|
| GET  | `/api/health` | public | Ãtat de l'API et de la base |
| GET  | `/api/settings` | public | IdentitÃ© de l'app, modules actifs |
| POST | `/api/login` Â· `/api/logout` Â· `/api/logout-all` | public / Bearer | Connexion, dÃ©connexion (courante / tous appareils) |
| POST | `/api/forgot-password` Â· `/api/reset-password` | public | Mot de passe oubliÃ© |
| GET/POST | `/api/register/{token}` | public (module) | Inscription sur invitation |
| GET  | `/api/user` | Bearer | Utilisateur authentifiÃ© (rÃ´les, permissions) |
| PUT  | `/api/profile` Â· `/api/profile/password` | Bearer | Profil, changement de mot de passe |
| GET  | `/api/dashboard` | Bearer | Indicateurs (selon le rÃ´le) |
| GET/POST/DELETE | `/api/invitations` | Bearer (module) | Invitations |
| CRUD | `/api/users` Â· `POST /api/users/{id}/restore` | admin | Utilisateurs (`?search=&role=&trashed=1&sort=&dir=&per_page=`) |
| GET  | `/api/roles` | admin | RÃ´les et libellÃ©s |
| PUT  | `/api/settings` Â· `GET/PUT /api/modules` Â· `POST /api/uploads` | admin | Configuration |
| GET  | `/api/activity` | admin | Journal d'activitÃ© (`?search=&event=&subject_type=`) |
| GET/POST/DELETE | `/api/backups` Â· `GET /api/backups/{name}/download` | admin (module) | Sauvegardes |

Le front stocke le token dans `localStorage` et l'envoie via `Authorization: Bearer <token>`
(voir `frontend/src/lib/api.ts`). Toute erreur sous `/api/*` est renvoyÃ©e en JSON `{ message, errors? }`.

## Modules et rÃ´les

- **Modules** (`backend/config/modules.php`) : fonctions activables depuis Configuration. ProtÃ¨ge une route avec le middleware `module:<clÃ©>` ; cÃ´tÃ© front, `ModuleGate` et l'attribut `module` dans `lib/navigation.ts`.
- **RÃ´les** (`backend/config/roles.php`) : clÃ© â libellÃ©. Le seeder les crÃ©e ; l'API et les formulaires les listent. CÃ´tÃ© front : `RoleRoute`, `useAuth().hasRole()` / `.can()`.
- **Invitations** (`backend/config/invitations.php`) : `INVITATION_WHO_CAN_INVITE=admin|everyone`, validitÃ©, quota.

## Tests et qualitÃ©

```bash
cd backend
artisan.bat test            # Pest, SQLite en mÃ©moire â ne touche jamais MySQL
composer pint               # format PHP (avec PHP 8.3+)

cd frontend
npm run lint
npm run build
```

## Telescope (debug, local uniquement)

Accessible sur http://localhost:8000/telescope en environnement `local`.
Le paquet est en dÃ©pendance `--dev` et n'est chargÃ© qu'en local (voir
`app/Providers/AppServiceProvider.php`).

## DÃ©marrer un nouveau projet Ã  partir de cette base

```powershell
.\new-project.ps1 -Name caisse-resto -ApiPort 8001 -FrontPort 5174
```

Le script copie le template, installe les dÃ©pendances, prÃ©pare les `.env`
(nom, base, ports), crÃ©e la base, migre + seed, crÃ©e le lien `storage` et
initialise un dÃ©pÃ´t git. Des ports diffÃ©rents par projet permettent de lancer
plusieurs projets en mÃªme temps.

## DÃ©ploiement

Voir [DEPLOY.md](DEPLOY.md) (hÃ©bergement mutualisÃ© Infomaniak).

## Note WAMP â PHP 8.4 en ligne de commande

WAMP permet plusieurs versions de PHP, mais le `php` du terminal dÃ©pend du `PATH`
Windows (souvent figÃ© sur une ancienne version). `backend\artisan.bat` sÃ©lectionne
automatiquement le PHP 8.4/8.3 de WAMP. Pour Composer et les tests :

- soit ajouter `D:\wamp64\bin\php\php8.4.x` **avant** l'ancienne entrÃ©e dans le `PATH`
  systÃ¨me (puis rouvrir le terminal) ;
- soit prÃ©fixer ponctuellement : `$env:Path = 'D:\wamp64\bin\php\php8.4.24;' + $env:Path`.
