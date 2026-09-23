# Déploiement (Infomaniak mutualisé)

Ce guide décrit la mise en production d'un projet dérivé de **baseapp** sur un
hébergement mutualisé Infomaniak.

## Principe clé

- Le **code** (dont les migrations) voyage par **Git**.
- Le **schéma** de la base se reconstruit avec `php artisan migrate --force`.
- Les **données** ne sont **jamais** copiées entre local et prod : chaque
  environnement a sa propre base.

## Prérequis (offre mutualisée payante)

- SSH, Composer, sélecteur de version PHP (**8.3+**), Git, cron : disponibles.
- **Pas de Node.js en prod** → on build le front **en local** et on envoie `frontend/dist/`.
- Le **dossier cible (doc root)** du domaine doit pointer sur **`backend/public`**
  (jamais la racine du projet).

## Architecture recommandée (2 sous-domaines)

| Domaine | Dossier cible | Contenu |
|---|---|---|
| `api.mon-domaine.tld` | `backend/public` | API Laravel |
| `mon-domaine.tld` | `frontend/dist` | SPA React (fichiers statiques) |

Le front étant une SPA avec routes (`/users`, `/register/xxx`…), le serveur du
front doit renvoyer `index.html` pour toute URL inconnue. Exemple `.htaccess`
à placer dans `frontend/dist/` :

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [L]
```

## 1. Première mise en ligne (une seule fois)

En SSH sur le serveur :

```bash
cd sites/api.mon-domaine.tld
git clone <url-du-depot> .
cd backend
composer install --no-dev --optimize-autoloader

cp .env.production.example .env   # puis compléter : APP_KEY, MySQL, APP_URL, FRONTEND_URL, MAIL_*
php artisan key:generate
php artisan migrate --seed --force
php artisan storage:link           # uploads (logo) servis via /storage
php artisan config:cache
php artisan route:cache
```

Variables à vérifier dans `backend/.env` :

- `APP_URL=https://api.mon-domaine.tld`, `FRONTEND_URL=https://mon-domaine.tld`
  (CORS + liens des emails : réinitialisation, invitations).
- `MAIL_*` : un vrai transport SMTP, sinon les invitations et le mot de passe
  oublié n'arrivent jamais (`MAIL_MAILER=log` en local).
- `INVITATION_WHO_CAN_INVITE`, `BACKUP_KEEP` selon le projet.

Puis, dans le **Manager Infomaniak** : régler le doc root du domaine sur
`backend/public` (et un sous-domaine sur `frontend/dist`).

Enfin, envoyer le front (voir §2, étape build + upload). Le front prod doit
être buildé avec `VITE_API_URL=https://api.mon-domaine.tld` dans `frontend/.env.production`.

## 2. À chaque déploiement (le geste répété)

**En local :**
```bash
npm --prefix frontend run build      # génère frontend/dist (lit frontend/.env.production)
git add . && git commit -m "…" && git push
```

**En prod (SSH) :**
```bash
git pull
cd backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force          # applique les migrations, garde les données
php artisan config:cache && php artisan route:cache
# envoyer frontend/dist vers le dossier du front (rsync / FTP)
```

> `migrate --force` **ajoute / modifie** les tables sans toucher aux données
> existantes. Ne jamais copier la base locale par-dessus la prod.

## 3. Tâches planifiées (cron)

Le socle planifie une **sauvegarde quotidienne** de la base (module « Sauvegardes »,
`routes/console.php`) et les invitations partent par la **file d'attente**
(`QUEUE_CONNECTION=database`). Ajouter dans le gestionnaire de tâches Infomaniak :

```bash
# Scheduler Laravel (toutes les minutes)
php /chemin/vers/backend/artisan schedule:run

# Worker de file d'attente (toutes les minutes, s'arrête quand la file est vide)
php /chemin/vers/backend/artisan queue:work --stop-when-empty
```

Sans worker, passer `QUEUE_CONNECTION=sync` pour envoyer les emails immédiatement.

Les sauvegardes sont écrites dans `backend/storage/app/private/backups` (dump PDO
100 % PHP si `mysqldump` est absent) et téléchargeables depuis Configuration → Sauvegardes.
Pense à les copier hors du serveur régulièrement.

## 4. Automatiser (plus tard)

Une **GitHub Action** peut exécuter le bloc « §2 côté prod » à chaque `push`
sur `main` (build front + SSH + `migrate --force` + envoi du `dist`). Voir
`.github/workflows/` pour le point de départ (CI déjà en place).

## Rappels sécurité

- `APP_DEBUG=false` et `APP_ENV=production` en prod.
- Ne jamais committer le `.env` réel.
- Telescope ne se charge qu'en local (voir `AppServiceProvider`).
- Le compte de démo `admin@baseapp.test` / `password` est créé par le seeder :
  **changer son mot de passe** (Mon profil) ou le supprimer après avoir créé le vrai admin.
