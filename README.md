# Watchall

Tableau de bord de mes plateformes de streaming : https://watchall-ca.netlify.app

- `index.html` : tout le site (HTML, CSS et JavaScript).
- `netlify/functions/tmdb.mjs` : fonction serveur qui fait les recherches de films sur TMDB pour le mode Découvrir. La clé TMDB n'est **pas** dans ce dépôt : elle est gardée dans Netlify, dans la variable d'environnement `TMDB_TOKEN`.
- `netlify.toml` : réglages de déploiement.

Données de films et affiches : TMDB. Ce produit utilise l'API TMDB, mais n'est ni approuvé ni certifié par TMDB.
