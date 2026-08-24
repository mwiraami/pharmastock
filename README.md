
## Backend en cours d'intégration

Le socle backend de la phase suivante se trouve dans `backend/` : schéma Prisma multi-tenant, inscription transactionnelle, connexion JWT, refresh token, RBAC, validation Zod, dashboard, produits, entrées/sorties de stock et ventes FEFO protégés par `pharmacyId`.

Commandes :

```powershell
docker compose up -d postgres
Copy-Item .env.example .env
npm.cmd install --prefix backend
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run backend:dev
```

Le frontend utilise maintenant l'API pour l'inscription, la connexion et le module Produits lorsque le backend est disponible, avec repli IndexedDB hors connexion. Les écrans lots, stock, caisse et rapports doivent encore être migrés vers les routes transactionnelles backend.
# PharmaStock — application PWA hors connexion

Cette première version fonctionne sans serveur ni connexion Internet après son premier chargement. Elle utilise **IndexedDB** pour conserver la pharmacie, les produits, les ventes et les mouvements de stock sur l'appareil.

## Lancer localement

Utilisez un serveur HTTP statique (le service worker ne fonctionne pas via l'ouverture directe du fichier) :

```powershell
npm.cmd run start
```

Puis ouvrez l'adresse affichée. Dans Chrome ou Edge, utilisez « Installer l'application » pour l'utiliser comme application installée.

## Fonctionnalités actuelles

- assistant de création de pharmacie et administrateur ;
- connexion locale avec mot de passe hashé côté navigateur et session par onglet ;
- déconnexion et navigation réduite selon le rôle de l'utilisateur ;
- catalogue produits, seuil minimal et date d'expiration ;
- ventes locales avec blocage du stock négatif et des articles expirés ;
- décrément de stock et journal des mouvements ;
- tableau de bord et rapports de ventes ;
- cache applicatif PWA et persistance IndexedDB hors connexion.

## Limites de cette version

Cette version reste une application locale : elle ne fournit pas encore l'API Node/Express, PostgreSQL/Prisma, les refresh tokens JWT, ni l'isolation multi-pharmacies côté serveur. Ces éléments sont indispensables avant un déploiement multi-utilisateur en production.

## Suite recommandée

La prochaine phase consiste à extraire les modèles métier dans PostgreSQL/Prisma et à faire passer les écritures critiques (réception, sortie, inventaire et vente FEFO) dans des transactions backend. IndexedDB pourra ensuite servir de cache hors connexion, avec une file de synchronisation contrôlée côté serveur.
