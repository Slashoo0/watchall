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
- Tester en local avec `netlify dev`.

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
