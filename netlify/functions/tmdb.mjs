// =========================================================
//  Fonction serveur Watchall : relais vers l'API TMDB
// ---------------------------------------------------------
//  Le site appelle /.netlify/functions/tmdb?chemin=/discover/movie&...
//  Cette fonction roule chez Netlify (pas dans le navigateur) :
//  elle ajoute la clé TMDB, qui reste cachée dans les réglages
//  du projet Netlify (variable d'environnement TMDB_TOKEN).
//  La clé n'est jamais dans le code du site ni sur GitHub.
// =========================================================

const API_TMDB = "https://api.themoviedb.org/3";

// Seules les recherches dont Watchall a besoin sont permises.
// Comme ça, personne ne peut se servir de ta clé pour autre chose.
const CHEMINS_PERMIS = /^\/(configuration|watch\/providers\/(movie|tv)|search\/multi|discover\/(movie|tv)|(movie|tv)\/\d{1,9}(\/recommendations)?)$/;

// Réponse JSON avec le bon code
const repondre = (statut, corps, extra = {}) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });

export default async (req) => {
  if (req.method !== "GET") return repondre(405, { erreur: "methode_refusee" });

  const cle = (process.env.TMDB_TOKEN || "").trim();
  if (!cle) return repondre(503, { erreur: "cle_absente" }); // la variable n'est pas encore réglée dans Netlify

  const entree = new URL(req.url);
  const chemin = entree.searchParams.get("chemin") || "";
  if (!CHEMINS_PERMIS.test(chemin)) return repondre(400, { erreur: "chemin_refuse" });

  // On recopie les paramètres de recherche (sauf « chemin » et toute clé envoyée par le navigateur)
  const sortie = new URL(API_TMDB + chemin);
  for (const [k, v] of entree.searchParams) {
    if (k === "chemin" || k === "api_key") continue;
    if (sortie.searchParams.size >= 30 || v.length > 300) return repondre(400, { erreur: "parametres_refuses" });
    sortie.searchParams.set(k, v);
  }

  // Jeton d'accès en lecture (commence par eyJ) dans l'en-tête, sinon clé API classique
  const entetes = { accept: "application/json" };
  if (cle.startsWith("eyJ")) entetes.Authorization = "Bearer " + cle;
  else sortie.searchParams.set("api_key", cle);

  let r;
  try {
    r = await fetch(sortie, { headers: entetes, signal: AbortSignal.timeout(8000) });
  } catch (e) {
    return repondre(502, { erreur: "tmdb_injoignable" });
  }
  const texte = await r.text();
  // Les listes de plateformes changent rarement : on les garde en cache 1 jour, le reste 10 minutes
  const duree = /^\/(configuration|watch\/providers)/.test(chemin) ? 86400 : 600;
  return new Response(texte, {
    status: r.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": r.ok ? `public, max-age=${duree}` : "no-store"
    }
  });
};
