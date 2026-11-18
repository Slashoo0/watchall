# WatchAll : règles pour Claude

## Communication
- Toujours répondre en **français**, tutoyer William, parler simplement.
- Expliquer ce que tu fais et pourquoi, pour qu'il apprenne. Expliquer chaque étape **avant** de la faire.
- Dire les **limites d'une solution AVANT de la construire** (ce qu'elle ne fera pas, les risques, les coûts).
- **Vérifier son travail avant de répondre** : tester, relire, ne pas dire « c'est fait » sans l'avoir vérifié.

## Le projet
- Site en ligne : https://watchall-ca.netlify.app
- Code : https://github.com/Slashoo0/watchall (branche `main`)
- `index.html` : tout le front (HTML, CSS, JavaScript).
- `netlify/functions/` : fonctions serveur
  - `tmdb.mjs` : recherches de films sur TMDB (mode Découvrir)
  - `config.mjs` : configuration partagée
  - `compte.mjs` : comptes par courriel
- Stockage : **Netlify Blobs** pour les comptes et la config.
- `netlify.toml` : pas d'étape de construction, le site est publié depuis la racine.

### Carte de `index.html` (environ 4000 lignes)
Le fichier est découpé en parties repérées par des commentaires `/* ===== */` et `<!-- ===== -->`.
Chercher le titre (ex. `7. MA LISTE`) au lieu de lire tout le fichier.
- CSS en haut, puis le HTML : `EN-TÊTE`, sections `vue-accueil`, `vue-liste`, `vue-abonnements`, `vue-parametres`, palette de commandes, fenêtre modale, carte « Bon retour ».
- JavaScript, parties numérotées :
  1. Données de départ et stockage · 2. Capacités de la page · 3. Outils (format, dates, sécurité)
  4. Ouvrir un service · 5. Navigation entre les vues (#) · 6. Accueil · 7. Ma liste
  8. « Je sais pas quoi regarder » (moteur TMDB, mode « Dans ma liste ») · 9. Aide raccourcis
  10. Abonnements · 11. Paramètres · 12. Fenêtre modale · 13. Palette de commandes (Ctrl+K, « Où regarder »)
  14. Raccourcis et boutons généraux · 15. « Bon retour » · 16. Configuration partagée (mode propriétaire)
  16 b. Comptes · 17. Démarrage

## Tester en local (gratuit, à faire avant tout commit)
- Dans le dossier du projet : `netlify dev`, puis ouvrir http://localhost:8888
  (la section `[dev]` de `netlify.toml` évite que Netlify croie que le site utilise Hugo à cause de `config.json`).
- Si le port 8888 est déjà pris, un autre `netlify dev` tourne sûrement déjà (une autre session) : réutiliser celui-là.
- En local, les Netlify Blobs sont un **bac à sable vide**, séparé du vrai site : on peut créer des comptes de test sans risque, mais on ne voit pas les vrais comptes ni la vraie config (la fonction config répond 404 « aucune_configuration », c'est normal).
- `TMDB_TOKEN` et `WATCHALL_ADMIN` sont injectés depuis Netlify automatiquement.
- La fonction `tmdb` n'accepte que les chemins de sa liste blanche (`CHEMINS_PERMIS` dans `tmdb.mjs`).

## Façon de travailler
- **Une session Claude Code par sujet** (une fonctionnalité ou un bug), toujours ouverte dans ce dossier.
- Au début d'un sujet : expliquer à William le plan et les limites, **attendre son feu vert** avant de modifier les fichiers.
- Presque tout est dans `index.html` : **une seule session à la fois modifie ce fichier**. Avant de modifier, vérifier `git status` : s'il y a des changements non commités qui ne viennent pas de toi, une autre session travaille peut-être, alors demander à William avant de continuer.
- Quand le sujet marche : tester avec `netlify dev`, faire un commit local avec un message clair en français, puis mettre à jour la note Obsidian.
- Le push se fait seulement quand William le demande (voir plus bas).

## Mise en ligne et crédits Netlify (TRÈS IMPORTANT)
- Chaque push sur `main` déclenche une mise en ligne Netlify qui **coûte des crédits**.
- Les crédits sont presque épuisés **jusqu'au 14 décembre 2026**.
- **Ne JAMAIS faire `git push` sur `main` sans demander à William d'abord.**
- Avant le 14 décembre 2026, si on doit pousser : mettre **`[skip netlify]`** dans le message du commit (le dernier commit du push doit le contenir, sinon Netlify déploie quand même).
- **Regrouper les changements** avant une mise en ligne : plusieurs corrections dans un seul déploiement plutôt qu'un déploiement par petite correction.

## Secrets
- Variables d'environnement sur Netlify : `TMDB_TOKEN` et `WATCHALL_ADMIN`.
- **Ne jamais les écrire dans le code, dans un commit, ni les afficher** (pas de `netlify env:list` ou `env:get` qui les montrerait à l'écran).

## Fichiers à ne jamais supprimer
- `google6a1790d001c67c7a.html` : validation Google Search Console.

## Suivi
- Quand on avance, mettre à jour la note Obsidian :
  `C:\Users\willi\Documents\Memoire Claude\Mes notes\Business\WatchAll\WatchAll.md`
