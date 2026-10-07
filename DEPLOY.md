# Déploiement (Infomaniak mutualisé)

Mise en production de **Planning Chantier** sur **https://planning.top-stores.ch**
(domaine à confirmer), avec la même méthode que ProTime-Cuttat et StepWork : code par
Git, déploiement automatique par GitHub Actions. Le §5 est le runbook de la première
mise en ligne.

## Principe clé

- Le **code** (dont les migrations) voyage par **Git**.
- Le **schéma** de la base se reconstruit avec `php artisan migrate --force`.
- Les **données** ne sont **jamais** copiées entre local et prod : la base locale est
  une base de démo, la production démarre vide (rôles seulement) et se remplit en ligne.

## Prérequis (offre mutualisée payante)

- SSH, Composer, Git : disponibles. PHP **8.4** (site **et** ligne de commande, voir §5.C),
  extensions `gmp` ou `bcmath` (notifications push) : présentes chez Infomaniak.
- **Pas de Node.js en prod** → le front est buildé sur GitHub et envoyé par l'Action.
- Le **dossier cible (doc root)** du domaine pointe sur **`backend/public`**
  (jamais la racine du projet).
- **HTTPS** obligatoire (certificat Let's Encrypt du Manager) : les notifications push et
  l'installation sur l'écran d'accueil des téléphones en dépendent.

## Architecture : un seul domaine

Interface React et API vivent sur le **même domaine** : doc root `backend/public`, API
sous `/api/...`, build Vite (`frontend/dist/*`) copié dans `backend/public/`.
`routes/web.php` renvoie `index.html` pour toute URL hors `/api` (routage côté client) ;
`public/.htaccess` envoie le reste à Laravel et transmet l'en-tête `Authorization`.
Le front appelle l'API en relatif (`lib/api.ts` : sans `VITE_API_URL`, adresse relative
en production). Avantages : un certificat, pas de CORS, service worker et push sur le
même domaine.

## 1. À chaque déploiement (le geste répété)

```bash
git add . && git commit -m "…" && git push
```

C'est tout : l'Action du §2 fait le reste. Ce qu'elle exécute, pour mémoire (et pour un
déploiement manuel en SSH si GitHub est indisponible, voir aussi §6) :

```bash
cd ~/apps/planning-chantier-top-stores
git pull
composer install --no-dev --optimize-autoloader --working-dir=backend
php backend/artisan backup:run                      # sauvegarde avant le schéma
php backend/artisan migrate --force                  # ajoute / modifie les tables, garde les données
php backend/artisan db:seed --class=RolesSeeder --force
php backend/artisan storage:link                     # photos des chantiers (une fois suffit)
php backend/artisan optimize
# + build du front (frontend/dist/*) envoyé dans backend/public/
```

## 2. Déploiement automatique (GitHub Action)

`.github/workflows/deploy.yml` exécute le §1 à chaque `push` sur `master`.
`.github/workflows/ci.yml` lance les tests (Pest SQLite + MySQL, Pint, ESLint, build) sur
toutes les autres branches et avant chaque déploiement.

Déroulé (`deploy.yml`) :

1. **Tests d'abord** : la CI doit passer, sinon rien n'est déployé.
2. Build du front sur GitHub (API relative).
3. Mode maintenance (`artisan down`), puis le serveur passe **exactement** au commit testé
   (`git merge --ff-only <sha>`).
4. `composer install`, puis **sauvegarde** (`backup:run`) : si elle échoue, retour
   automatique au commit précédent et arrêt (le schéma n'est pas touché).
5. Migrations, rôles, lien `storage`, fin de maintenance.
6. Envoi du front : nouveaux fichiers d'abord, `sw.js` puis `index.html` en dernier (pas de
   page blanche) ; les anciens fichiers du front sont gardés 7 jours puis supprimés.
7. Caches (`artisan optimize`) et contrôle de `/api/health` (vérifie aussi la base) et `/login`.

Le déploiement ne touche ni la base (sauf migrations et rôles), ni `storage/` (photos,
sauvegardes), ni le `.env`.

### Secrets et variables du dépôt

Dépôt GitHub → **Settings → Secrets and variables → Actions**.

| Secret               | Valeur                                                                   |
|----------------------|--------------------------------------------------------------------------|
| `DEPLOY_HOST`        | hôte SSH de l'hébergement (Manager Infomaniak → SSH)                     |
| `DEPLOY_USER`        | utilisateur SSH                                                          |
| `DEPLOY_SSH_KEY`     | clé privée dont la clé publique est dans `~/.ssh/authorized_keys` du serveur (lignes BEGIN/END comprises) |
| `DEPLOY_KNOWN_HOSTS` | (recommandé) sortie de `ssh-keyscan -H <hôte>`, vérifiée une fois à la main |
| `VITE_FC_LICENSE_KEY`| (facultatif) licence commerciale FullCalendar Scheduler, sinon clé d'évaluation non commerciale |

| Variable     | Valeur (défaut)                              |
|--------------|----------------------------------------------|
| `APP_DOMAIN` | `planning.top-stores.ch` — **à régler** si le domaine diffère |
| `APP_PATH`   | `apps/planning-chantier-top-stores` (dossier du clone, relatif au home SSH) |

**Même hébergement que ProTime / StepWork ?** Reprendre exactement les valeurs
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (et `DEPLOY_KNOWN_HOSTS`) du dépôt
`protime-cuttat` : la clé `~/.ssh/github-actions` du serveur est déjà autorisée.
**Autre hébergement ?** Créer la clé sur ce serveur :

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github-actions -N ""
cat ~/.ssh/github-actions.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/github-actions          # ← clé PRIVÉE, à copier dans le secret DEPLOY_SSH_KEY
```

### Revenir à la version précédente

```bash
cd ~/apps/planning-chantier-top-stores
git log --oneline -5                      # repérer le commit à rétablir
php backend/artisan down
git reset --hard <commit>                 # code précédent
composer install --no-dev --optimize-autoloader --working-dir=backend
# seulement si la version fautive avait ajouté des migrations :
php backend/artisan migrate:rollback --step=<nombre de migrations ajoutées>
php backend/artisan optimize && php backend/artisan up
```

Puis relancer le workflow *Deploy* (onglet Actions → Run workflow) sur ce commit, ou
pousser un correctif sur `master`, pour renvoyer le front correspondant.

## 3. Rappels sécurité

- `APP_DEBUG=false` et `APP_ENV=production` en prod.
- Ne jamais committer le `.env` réel (exclu par les `.gitignore`).
- **Aucun compte de démo en production** : en `APP_ENV=production`, `DatabaseSeeder` ne crée
  que les rôles. Premier compte : `php backend/artisan planning:admin <email>` (§5.F).
- Telescope ne se charge qu'en local (voir `AppServiceProvider`).
- Les clés VAPID (push) sont générées **une seule fois** sur le serveur et ne changent plus.

## 4. Sauvegardes et tâche planifiée

Sauvegarde de la base par `php artisan backup:run` → `backend/storage/app/backups/`
(`backup-<date>.sql.gz`, `BACKUP_KEEP` dernières gardées). Faite **à chaque déploiement**
et **une fois par jour** par la tâche planifiée ci-dessous. Si `mysqldump` n'est pas
disponible, le service bascule tout seul sur un export en PHP. Les photos des chantiers
(`backend/storage/app/public`) ne sont pas dans ces sauvegardes : garder aussi les
sauvegardes Infomaniak et, de temps en temps, rapatrier une copie (`scp`).

Restaurer la base :

```bash
cd ~/apps/planning-chantier-top-stores/backend
php artisan down
gunzip -c storage/app/backups/backup-<date>.sql.gz | mysql -h <DB_HOST> -u <DB_USERNAME> -p <DB_DATABASE>
php artisan up
```

### Tâche planifiée (une fois)

Le planificateur d'Infomaniak appelle une **URL**. Elle lance `planning:cron` :
**rappels push** « Dans 1 h : chantier X », **sauvegarde** si la dernière a plus de 20 h,
ménage des connexions expirées.

1. Sur le serveur, générer un jeton secret et le mettre dans `backend/.env` :

   ```bash
   php -r 'echo bin2hex(random_bytes(24)), PHP_EOL;'
   # backend/.env :  CRON_TOKEN=<le jeton affiché>
   cd ~/apps/planning-chantier-top-stores && php backend/artisan config:cache
   ```

2. Manager Infomaniak → **Planificateur de tâches** → *Planifier une tâche* :
   - URL : `https://planning.top-stores.ch/api/cron/run/<le jeton>`
   - Fréquence : **toutes les 5 minutes** (au plus toutes les 15 minutes).
     Les rappels partent au plus tôt 20 minutes avant l'heure choisie par l'employé
     (`CRON_REMIND_GRACE=20`) : avec un appel toutes les 15 minutes, « 1 h avant »
     arrive entre 40 et 60 minutes avant le début du chantier.

3. Tester : ouvrir l'URL dans le navigateur → `{"status":"ok", …}`. Sans jeton ou avec un
   mauvais jeton, l'adresse répond 404.

Sur un serveur avec un vrai cron, `php backend/artisan schedule:run` chaque minute fait
la même chose (`routes/console.php`).

---

## 5. Première mise en ligne

| | Valeur |
|---|---|
| Domaine | `https://planning.top-stores.ch` (interface + API) — à confirmer |
| Dépôt Git | `https://github.com/spinoops/planning-chantier` (privé, branche `master`) |
| Dossier sur le serveur | `~/apps/planning-chantier-top-stores` (clone du dépôt) |
| Doc root | `apps/planning-chantier-top-stores/backend/public` |
| Base MySQL | créée dans le Manager (hôte `xxxxx.myd.infomaniak.com`, nom, utilisateur, mot de passe) |
| PHP | 8.4 (site **et** ligne de commande) |

### A. En local : dépôt GitHub

1. Sur https://github.com/new : dépôt **`planning-chantier`**, **privé**, sans README ni
   `.gitignore` (le projet a les siens).
2. Le projet est déjà un dépôt Git (branche `master`). Contrôler qu'aucun secret n'est suivi,
   puis brancher GitHub et envoyer :

```powershell
cd D:\wamp64\www\app-planningchantier
git status
git ls-files | Select-String "\.env$"       # ne doit RIEN afficher
git remote add origin https://github.com/spinoops/planning-chantier.git
git push -u origin master
```

   Ce premier push lance l'Action « Deploy (Infomaniak) » : la CI tourne, puis le déploiement
   **échoue** tant que le serveur et les secrets ne sont pas prêts (étapes B à E). C'est
   normal, on le relancera.

### B. Manager Infomaniak

- **Base de données** : créer la base et son utilisateur, noter les accès.
- **Adresse d'envoi** : `noreply@top-stores.ch` et son mot de passe (mot de passe oublié,
  invitations, alertes de planning).
- **Site `planning.top-stores.ch`** : version PHP **8.4**, doc root
  **`apps/planning-chantier-top-stores/backend/public`**, certificat SSL activé.

### C. Sur le serveur (SSH), une seule fois

**Version de PHP en ligne de commande** : `php -v` doit afficher **8.4**. Sinon, la régler
dans le Manager (version PHP utilisée en SSH) ; ProTime et StepWork tournent aussi en 8.4.

**Accès au dépôt privé** : GitHub refuse le mot de passe, et une même *deploy key* ne peut
servir qu'à un dépôt (celles de ProTime et StepWork sont prises). On crée une clé dédiée,
avec un alias :

```bash
ssh-keygen -t ed25519 -C "infomaniak-planning" -f ~/.ssh/planning_github -N ""
cat ~/.ssh/planning_github.pub
#   → coller sur GitHub : dépôt planning-chantier → Settings → Deploy keys → Add deploy key
#     (lecture seule suffit)

cat >> ~/.ssh/config <<'EOF'
Host github-planning
  HostName github.com
  User git
  IdentityFile ~/.ssh/planning_github
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
```

**Clone, dépendances, configuration** : le dossier `~/apps/planning-chantier-top-stores` (créé par le
Manager avec le site) doit être **vide** pour le clone. Vérifier avec `ls -A` ; s'il ne
contient que la page par défaut d'Infomaniak, la supprimer d'abord.

```bash
mkdir -p ~/apps/planning-chantier-top-stores && cd ~/apps/planning-chantier-top-stores
ls -A
git clone git@github-planning:spinoops/planning-chantier.git .
composer install --no-dev --optimize-autoloader --working-dir=backend

cp backend/.env.production.example backend/.env
php backend/artisan key:generate --force
php backend/artisan webpush:vapid            # clés des notifications push, UNE SEULE FOIS
nano backend/.env
#   APP_URL / FRONTEND_URL / SANCTUM_STATEFUL_DOMAINS = le vrai domaine
#   DB_HOST / DB_DATABASE / DB_USERNAME / DB_PASSWORD (Manager)
#   MAIL_USERNAME=noreply@top-stores.ch   MAIL_PASSWORD=…
#   VAPID_SUBJECT="mailto:noreply@top-stores.ch"
#   CRON_TOKEN=… (voir §4)

php backend/artisan migrate --force
php backend/artisan db:seed --class=RolesSeeder --force
php backend/artisan storage:link
php backend/artisan optimize
chmod -R u+rwX backend/storage backend/bootstrap/cache
```

### D. Secrets GitHub

Voir §2 : `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (+ `DEPLOY_KNOWN_HOSTS`), et la
variable `APP_DOMAIN` si le domaine n'est pas `planning.top-stores.ch`.

### E. Premier déploiement complet

GitHub → dépôt → **Actions** → « Deploy (Infomaniak) » → **Run workflow**. Cette exécution
envoie le front dans `backend/public`. Tout vert = en ligne.

### F. Vérifications et premier compte

1. `https://planning.top-stores.ch/api/health` répond `{"status":"ok", …}`.
2. `https://planning.top-stores.ch` affiche la page de connexion.
3. Créer ton compte admin et recevoir le lien (vérifie aussi l'envoi d'e-mails) :

```bash
cd ~/apps/planning-chantier-top-stores
php backend/artisan planning:admin login@step-one.ch --name="Step One"
```

4. Cliquer le lien reçu, définir le mot de passe, se connecter.
5. **Administration → Équipe & comptes** : créer Robin (Administrateur + Chef de chantier),
   Davison (Gestionnaire), Léo, Étienne et David (Ouvriers), avec leur vraie adresse ; chacun
   définit son mot de passe par « Mot de passe oublié ? » (ou par invitation).
6. **Configuration** : nom de l'app, logo, couleur. Puis équipes, clients et chantiers.
7. Tâche planifiée (§4), puis sur un téléphone : ouvrir le site, « Ajouter à l'écran
   d'accueil », Mon profil → Alertes → activer et « Envoyer une alerte de test ».

### G. Ensuite

Le §1 à chaque mise à jour (`git push`). Le PC reste l'environnement de développement :
sa base est une base de démo, ne pas y saisir de données réelles.

## 6. Secours sans GitHub

`.\release.ps1` (en local) produit `release\planning-<date>.zip` : le dossier `backend/`
avec ses dépendances de production et le front déjà copié dans `public/`. Le décompresser
dans `~/apps/planning-chantier-top-stores/backend` (sans écraser `.env` ni `storage/`), puis lancer les
commandes artisan du §1.
