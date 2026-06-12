# TalkPro Connect V4 + V5 Premium

Développeur officiel : **Jehovani Nsanguluja**

Cette V2 ajoute une base plus professionnelle :

- Compte administrateur par défaut
- Rôles : admin, modérateur, utilisateur
- Tableau de bord administrateur
- Gestion des utilisateurs
- Blocage / déblocage
- Suppression logique des utilisateurs
- Statistiques : utilisateurs, messages, demandes, groupes
- Demandes de contact
- Messagerie privée temps réel avec Socket.io
- Groupes de discussion
- Annonces administrateur
- Images et messages vocaux
- Interface moderne type WhatsApp
- Section “À propos du développeur”
- Déploiement Render + MongoDB Atlas

## Identifiants administrateur par défaut

Après le premier lancement du serveur, un compte admin est créé automatiquement :

```text
Email : admin@talkpro.com
Mot de passe : Admin@2026
```

Change ce mot de passe dès que possible dans une vraie mise en ligne.

## Installation locale

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Puis ouvre :

```text
http://localhost:5000
```

## Configuration `.env`

```env
PORT=5000
MONGO_URI=mongodb+srv://UTILISATEUR:MOTDEPASSE@cluster0.xxxxx.mongodb.net/talkpro_v2
JWT_SECRET=mettez_un_secret_tres_long
CLIENT_URL=http://localhost:5000
ADMIN_EMAIL=admin@talkpro.com
ADMIN_PASSWORD=Admin@2026
ADMIN_NAME=Jehovani Nsanguluja
```

## Déploiement sur Render

1. Crée un compte Render.
2. Crée un Web Service.
3. Connecte ton dépôt GitHub.
4. Root Directory : `server`
5. Build Command : `npm install`
6. Start Command : `npm start`
7. Ajoute les variables d’environnement.
8. Mets `CLIENT_URL` avec ton URL Render finale.

## MongoDB Atlas

Créer une base gratuite sur MongoDB Atlas et utiliser l’URL dans `MONGO_URI`.

## Remarque sur les appels audio/vidéo

Cette V2 contient des boutons et signaux d’appel via Socket.io.
Pour de vrais appels audio/vidéo complets, il faut ajouter WebRTC avec serveur STUN/TURN.



## Nouveautés V3.1

- ✓ message envoyé
- ✓✓ message livré
- ✓✓ bleu lorsque le message est lu
- Indication “est en train d’écrire...”
- Dernière connexion affichée dans la liste des contacts
- Mise à jour du statut en ligne/hors ligne en temps réel
- ZIP nettoyé : `node_modules` et `.env` ne sont pas inclus

## Mise à jour depuis ta V2 qui fonctionne

1. Décompresse ce dossier V3.1.
2. Copie ton ancien fichier `.env` dans `server/.env`.
3. Ouvre le terminal dans le dossier `server`.
4. Lance :

```bash
npm install
npm run dev
```

5. Ouvre :

```text
http://localhost:5000
```

Ton compte admin reste :

```text
admin@talkpro.com
Admin@2026
```


## Nouveautés V3.2

- Appel vocal WebRTC réel entre deux contacts acceptés
- Appel vidéo WebRTC réel entre deux contacts acceptés
- Sonnerie visuelle avec accepter/refuser
- Bouton terminer l’appel
- Couper / réactiver le micro
- Couper / réactiver la caméra
- Historique des appels
- Signalisation WebRTC via Socket.io
- Serveur STUN public Google pour les tests locaux

## Important pour les tests

Les appels WebRTC fonctionnent mieux :
- sur `localhost` en local ;
- ou sur un site HTTPS en ligne.

Pour une production sérieuse, ajoute un serveur TURN, par exemple Coturn, Twilio Network Traversal ou Metered TURN.


## Nouveautés V4

- Notifications navigateur pour nouveaux messages et appels
- Partage de fichiers : PDF, Word, Excel, PowerPoint, ZIP, TXT
- Mode sombre / mode clair
- Galerie médias par discussion ou groupe
- Profil utilisateur avancé : nom, photo, téléphone, bio, statut
- Modification du mot de passe
- Dashboard admin enrichi : appels, appels du jour, messages du jour

## Nouveautés V5

- Application installable comme PWA sur téléphone et ordinateur
- Icône TalkPro
- Manifest PWA
- Service worker basique
- Préparation pour APK Android via PWABuilder ou Capacitor

## Installation

1. Décompresse ce ZIP.
2. Copie ton ancien fichier `.env` dans :

```text
server/.env
```

3. Ouvre CMD dans le dossier `server`.
4. Lance :

```cmd
npm install
npm run dev
```

5. Ouvre :

```text
http://localhost:5000
```

## Transformer en APK Android

Option simple :

1. Mets l’application en ligne sur Render.
2. Va sur https://www.pwabuilder.com
3. Entre l’URL publique de TalkPro.
4. Génère le package Android.

Option avancée :

- Utiliser Capacitor.
- Ajouter icône, splash screen et notifications natives.

## Production

Pour une vraie mise en ligne :

- Backend : Render, Railway ou VPS
- Base de données : MongoDB Atlas
- Domaine : talkproconnect.com
- HTTPS obligatoire pour WebRTC, notifications et PWA
- Serveur TURN recommandé pour appels fiables


## V5.1 Mobile Pro

Cette version ajoute une interface mobile optimisée :

- Interface type WhatsApp mobile
- Liste des contacts plein écran
- Discussion plein écran
- Bouton retour mobile
- Barre de message adaptée au clavier téléphone
- Appels audio/vidéo plein écran
- Galerie, profil et admin adaptés mobile
- Support iPhone avec safe-area
- Support Android/PWA amélioré

Après modification, envoyer sur GitHub puis Render redéploiera automatiquement.
