# Guide de mise en ligne TalkPro Connect V4/V5

## 1. Préparer GitHub

1. Crée un dépôt GitHub.
2. Envoie tout le projet dans le dépôt.
3. Ne mets jamais ton fichier `.env` sur GitHub.

## 2. Déployer sur Render

1. Va sur https://render.com
2. New + → Web Service
3. Connecte GitHub
4. Root Directory :

```text
server
```

5. Build Command :

```bash
npm install
```

6. Start Command :

```bash
npm start
```

7. Variables d’environnement :

```env
PORT=10000
MONGO_URI=ton_lien_mongodb
JWT_SECRET=un_secret_long
CLIENT_URL=https://ton-app.onrender.com
ADMIN_EMAIL=admin@talkpro.com
ADMIN_PASSWORD=Admin@2026
ADMIN_NAME=Jehovani Nsanguluja
```

## 3. Domaine personnalisé

Dans Render → Settings → Custom Domains, ajoute :

```text
talkproconnect.com
www.talkproconnect.com
```

Puis configure les DNS chez ton fournisseur de domaine.

## 4. Installer comme application mobile

Une fois le site en HTTPS :

- Android Chrome : menu ⋮ → Ajouter à l’écran d’accueil
- Ou utiliser PWABuilder pour générer un APK.

## 5. Important pour appels WebRTC

Pour les appels hors réseau local, ajoute un serveur TURN.

Exemples :
- Coturn
- Metered TURN
- Twilio Network Traversal
