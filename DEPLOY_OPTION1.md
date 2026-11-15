# Publication du site — Option 1 (Auto-hébergement Windows + Cloudflare Tunnel)

Ce guide explique comment mettre **JOCURI • TIMECODE** en ligne en HTTPS depuis votre PC Windows, sans payer d'hébergement vidéo et sans ouvrir de port sur votre box Internet.

---

## 1. Configurer le mot de passe administrateur

1. Copiez `.env.example` vers `.env.local` à la racine du projet :
   ```powershell
   Copy-Item .env.example .env.local
   ```
2. Modifiez `.env.local` et renseignez :
   - `ADMIN_PASSWORD` : un mot de passe robuste.
   - `AUTH_SECRET` : une longue phrase secrète aléatoire.

> Dès que `ADMIN_PASSWORD` est défini :
> - La page d'accueil `/` (recherche, vignettes et lecture vidéo) reste **publique**.
> - `/configure`, `/admin`, `/api/admin/*` et l'ajout/suppression de tags exigent une connexion via `/login`.

---

## 2. Installer Cloudflare Tunnel (`cloudflared`)

Dans PowerShell :

```powershell
winget install Cloudflare.cloudflared
```

*(Fermez puis rouvrez PowerShell après l'installation pour que la commande `cloudflared` soit reconnue.)*

---

## 3. Lancer le site en ligne (test immédiat en 2 terminaux)

**Terminal 1 — Serveur Next.js en production :**
```powershell
.\scripts\start-prod.ps1 -Rebuild
```

**Terminal 2 — Tunnel HTTPS public :**
```powershell
.\scripts\start-tunnel.ps1
```

Cloudflare affiche immédiatement une URL publique en `https://....trycloudflare.com` que vous pouvez partager.

---

## 4. Option : URL permanente avec votre propre nom de domaine

Si vous possédez un nom de domaine géré sur Cloudflare (gratuit avec un compte Cloudflare) :

1. Connectez `cloudflared` à votre compte :
   ```powershell
   cloudflared tunnel login
   ```
2. Créez un tunnel nommé :
   ```powershell
   cloudflared tunnel create jocuri-video
   ```
3. Associez un sous-domaine (ex. `videos.votre-domaine.com`) :
   ```powershell
   cloudflared tunnel route dns jocuri-video videos.votre-domaine.com
   ```
4. Créez `%USERPROFILE%\.cloudflared\config.yml` :
   ```yaml
   tunnel: jocuri-video
   credentials-file: C:\Users\<VOTRE_UTILISATEUR>\.cloudflared\<UUID_TUNNEL>.json

   ingress:
     - hostname: videos.votre-domaine.com
       service: http://127.0.0.1:3000
     - service: http_status:404
   ```
5. Lancez ensuite le tunnel permanent avec :
   ```powershell
   .\scripts\start-tunnel.ps1 -TunnelName jocuri-video
   ```
