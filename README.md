# CHRONOFRAME — Video Timestamp Manager

Application web au style cinématique permettant d'indexer une arborescence locale de vidéos, d'annoter des vidéos et des **timestamps précis** par mots-clés, et de lancer instantanément la lecture à la seconde recherchée.

## Fonctionnalités principales

- **Mode Utilisation (`/#search`)** : Recherche temps réel par mots-clés et projection immédiate de la vidéo au timecode exact via streaming HTTP `206 Partial Content` (`Range`), avec repères visuels sur la timeline.
- **Mode Configure (`/configure`)** : Navigation par arborescence de sous-dossiers, gestion des tags globaux d'une vidéo et capture en un clic du timestamp courant (`MM:SS.d`) pour y associer des mots-clés et notes de scène.
- **Mode Admin (`/admin`)** : Configuration et explorateur visuel du répertoire racine des vidéos, scan récursif multi-niveaux (`.mp4`, `.webm`, `.mov`, `.mkv`, `.m4v`, `.ogg`, `.avi`).
- **Résilience aux déplacements & renommages (*Sparse SHA-256*)** : Empreinte binaire échantillonnée (`192 Ko` max + taille exacte, temps `O(1)`) permettant de relier automatiquement les tags et timestamps d'un fichier déplacé ou renommé (lors du scan ou en *Self-Healing* direct à la lecture).
- **Catalogue portable par dossier (`chronoframe.catalog.json`)** : Miroir JSON atomique enregistré automatiquement à la racine de chaque répertoire vidéo et rechargé de façon transparente lorsqu'on change de dossier dans le Mode Admin.

## Stack technique

- **Next.js 15 (App Router)** + **React 19** + **TypeScript**
- **Tailwind CSS v4** (direction artistique *Dark Screening Room*, grain 35mm SVG, `prefers-reduced-motion`)
- **GSAP (`ScrollTrigger` + `@gsap/react`)** & **Lenis Smooth Scroll** (animations GPU 60 FPS)
- **SQLite natif Node.js (`node:sqlite` en mode `WAL`)** + synchronisation JSON atomique

## Démarrage rapide

> Prérequis : **Node.js >= 22.5** (pour le module natif `node:sqlite`).

```bash
npm install
npm run dev
```

Ouvrez ensuite `http://localhost:3000` :
1. Rendez-vous sur `/admin` pour sélectionner votre dossier racine de vidéos et lancer l'indexation.
2. Annotez vos vidéos et timestamps sur `/configure`.
3. Recherchez vos séquences par mots-clés sur `/#search`.
