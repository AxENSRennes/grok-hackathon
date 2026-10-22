# Sidequest Live

Prototype de jeu collectif pour animer un hackathon : les participants rejoignent une salle par QR code, choisissent un pseudo et un personnage, puis utilisent leur téléphone comme télécommande. Les positions finales déterminent les réponses aux questions.

Projet open source du Grok Bot Community Engineering London Hackathon, 22 octobre 2026. [Code public](https://github.com/AxENSRennes/grok-hackathon) · [Instance de démonstration](https://play.colvenalabs.com).

L'instance demande un compte organisateur préconfiguré pour créer une salle ; les participants rejoignent ensuite par QR sans inscription. Pour lancer votre propre événement, suivre les instructions ci-dessous. Le projet est encore un prototype ; les intégrations Grok/Cognee et les sprites définitifs restent à connecter.

## Démarrer

Node.js 22.13 ou supérieur (24 recommandé), npm.

```sh
npm ci
npm run dev
```

Configurer `HOST_EMAILS` dans `.env` et provisionner un compte organisateur avec `npm run auth:create-host` (mot de passe fourni via stdin, au moins 12 caractères). En production, `BETTER_AUTH_SECRET`, `HOST_EMAILS` et une `PUBLIC_URL` HTTPS sont obligatoires. Les inscriptions organisateur sont fermées au public.

Ouvrir **http://localhost:5173/** et se connecter comme organisateur : la salle et son QR sont créés automatiquement. Le grand écran ne montre que le jeu et le QR. Les téléphones peuvent rejoindre la machine sur le même réseau avec le QR (adresse locale détectée automatiquement). Si le Wi-Fi isole ses clients, utiliser un hébergement HTTPS public.

- `/?room=CODE` : jeu et QR ; sans code, une nouvelle salle est créée automatiquement.
- `/host` et `/screen?room=CODE` : anciens liens compatibles, même écran épuré.
- `/play?room=CODE` : pseudo, personnage/accessoire et télécommande tactile.
- Clavier de test : flèches / WASD / ZQSD, espace pour sauter (hors champs de texte).

## Ce qui fonctionne

- Aucun plafond de joueurs imposé par le produit. Les tests utilisent 50 ou 60 connexions comme points de mesure, pas comme limite ; la capacité réelle dépend de la machine et du réseau.
- Simulation serveur à 60 pas/seconde ; synchronisation autour de 30 mises à jour/seconde ; affichage Phaser lissé indépendamment.
- Mouvements normalisés, collisions à poids égal, impulsions limitées, bornes de carte.
- Saut visuel : la position au sol et les collisions restent inchangées.
- Les commandes cessent après 450 ms sans heartbeat ; elles sont relâchées quand le téléphone perd le focus.
- Better Auth : session anonyme automatique pour jouer sans compte ; email/mot de passe pour les organisateurs. Reconnexion liée à la session signée : le personnage est conservé 90 secondes après déconnexion. La salle vide expire après 15 minutes.
- QCM à 2–4 zones ou échelle à 5 bandes, apparition des zones, délai 10–180 secondes, arrêt et pause pilotables via l’API. Aucun formulaire de manches dans l’interface.
- Les poussées restent actives pendant le vote. Les résultats figent les positions. Les joueurs hors zone sont comptés séparément ; les déconnectés ne votent pas.
- Bulles de 80 caractères affichées quatre secondes ; délai minimal de 2,5 secondes entre messages ; coupure globale possible via l’API.
- Résultats agrégés sauvegardés en JSONL dans `data/rounds.jsonl`, export JSON via l’API protégée. Les mouvements et le chat ne sont pas persistés.

Les sprites actuels sont des repères temporaires dessinés dans le code. Les dix références graphiques sont dans `design/character-palettes-2026-10-22/index.html` ; elles ne sont pas encore intégrées comme sprites animés.

## Vérifier

```sh
npm run check
```

Cette commande vérifie les types et cinq tests unitaires ciblés dans un budget global de 15 secondes. Si le budget expire, elle s'arrête en échec (code 124), sans annoncer une validation. `npm test` lance uniquement ces tests avec le même plafond. Pas d'objectif de couverture ni de tests qui recopient l'implémentation.

Les parcours E2E se vérifient manuellement avec browser use pour les changements concernés : ouvrir le jeu, rejoindre par QR/lien, choisir son avatar, déplacer/sauter/envoyer un message, vérifier le grand écran et la reconnexion. Pas de suite E2E automatisée par défaut.

Le build est réservé aux livraisons et changements de compilation. `npm run test:load` reste disponible explicitement pour les changements réseau/physique ; il nécessite un serveur lancé et est hors du contrôle rapide. Il connecte par défaut 50 joueurs, un écran et un organisateur (un échantillon, aucune limite produit), et vérifie déplacements, bornes, reprise d'identité, autorisations et résultats. Un test local ne mesure pas la latence réelle du Wi-Fi de l'événement.

## Règles de conception

[AGENTS.md](AGENTS.md) contient les consignes du projet et de vérification ; [DESIGN.md](DESIGN.md) conserve les choix visuels. Le cœur d'[anti-slop](docs/anti-slop/README.md) est intégré localement et appliqué pendant le travail d'interface. Aucun plugin global ni dépendance d'exécution n'est ajouté.

## Production

```sh
npm run build
NODE_ENV=production npm start
```

Un seul service Node sert le client compilé et les WebSockets sur `PORT` (2567 par défaut). Le serveur doit rester actif, derrière un proxy HTTPS acceptant les WebSockets. Une instance suffit pour ce prototype ; ne pas répartir une même salle sur plusieurs processus sans présence/driver partagés.

Dockerfile fourni. Monter un volume sur `/app/data` pour conserver les résultats. Les salles actives restent en mémoire et ne survivent pas à un redémarrage du serveur.

Voir `.env.example` pour la configuration. `ALLOWED_ORIGINS` autorise les origines HTTP d’authentification et WebSocket ; `DATA_DIR` conserve `auth.sqlite` et les résultats. La clé organisateur est stockée dans le sessionStorage de l'onglet créateur ; elle n'est jamais incluse dans le QR. Les commandes requièrent aussi une session Better Auth organisateur valide. Aucun formulaire de manches n'est exposé dans l'interface.

L'auto-hébergement et la procédure de mise à jour sont documentés dans [deploy/PUBLIC.md](deploy/PUBLIC.md). Pour le test réseau authentifié, fournir `TEST_HOST_EMAIL` et `TEST_HOST_PASSWORD` via un fichier d’environnement privé. Il vérifie aussi les inscriptions fermées, le refus des invités à la régie, et la révocation des commandes après déconnexion organisateur.

## Préparer Grok / Cognee / Supabase

Le jeu n'appelle actuellement aucun service IA ou base de données externe. Better Auth utilise SQLite sur le serveur. Les crédits des services externes ne sont pas consommés.

Le point de commande pour un futur adaptateur Grok est déjà utilisable, avec validation côté serveur :

```http
POST /api/rooms/:roomId/commands
Content-Type: application/json
x-host-key: <clé privée de l'organisateur>
Cookie: <session Better Auth organisateur>

{"action":"start","question":{"text":"Quel atelier ?","mode":"choice","labels":["Agents","Robotique"],"duration":30}}
```

Actions : `start`, `finish`, `lobby`, `pause` (`paused`) et `chat` (`enabled`). Ne pas exposer la clé organisateur ni le cookie aux joueurs ou dans une URL. Les schémas et types sont dans `src/shared/protocol.ts`. L'export protégé est `GET /api/rooms/:roomId/results` avec la même session et le même header. Un futur adaptateur Grok devra passer par une frontière serveur autorisée.

Cognee pourra enrichir les questions avec le contexte et les résultats passés ; Supabase pourra remplacer le stockage local des manches. Ces intégrations restent à connecter et ne participent pas à la simulation physique.

## Licence

Code sous [MIT](LICENSE), conformément à la [consigne open source du hackathon](https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon#tracks) : dépôt public avec licence MIT, Apache-2.0 ou AGPL-3.0. Les planches générées servent à choisir la direction graphique ; aucune ressource de franchise n'est incluse dans le jeu. Les règles anti-slop conservent leur propre notice MIT dans `docs/anti-slop/LICENSE`.
