/* =========================================================
   Watchall : comptes utilisateurs
   - Les mots de passe ne sont jamais gardés : seulement une empreinte
     scrypt (avec un sel unique), impossible à retransformer en mot de passe.
   - La connexion donne un jeton aléatoire ; le serveur garde seulement
     l'empreinte du jeton, pas le jeton lui-même.
   - Chaque compte garde ses données perso (liste, notes, prix, réglages).
   - On s'inscrit avec son courriel. Le courriel n'apparaît jamais dans le nom
     de la case de stockage : on y met seulement son empreinte.
   - Les anciens comptes créés avec un nom d'utilisateur marchent encore.
   Tout passe par POST /.netlify/functions/compte?action=…
   ========================================================= */
import { getStore } from "@netlify/blobs";
import { scrypt, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const JOUR = 86400000;
const DUREE_SESSION = 180 * JOUR;       // reste connecté 6 mois sur un appareil
const MAX_SESSIONS = 10;                // appareils connectés en même temps
const MAX_DONNEES = 1_500_000;          // taille max des données perso d'un compte
const ECHECS_AVANT_BLOCAGE = 8;
const DUREE_BLOCAGE = 15 * 60 * 1000;   // 15 minutes après trop d'essais ratés

const reponse = (statut, corps) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const pause = ms => new Promise(r => setTimeout(r, ms));
const empreinte = t => createHash("sha256").update(t).digest("hex");
const egal = (a, b) => {
  const x = createHash("sha256").update(String(a)).digest(), y = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(x, y);
};

// Courriel : forme simple « quelquechose@domaine.ext », 254 caractères max, en minuscules
const courrielOk = v => {
  if (typeof v !== "string") return null;
  const c = v.trim().toLowerCase();
  return c.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(c) ? c : null;
};
// Ancien format (comptes créés avant le courriel) : nom d'utilisateur de 3 à 30 caractères
const ancienIdOk = v => typeof v === "string" && /^[a-z0-9._-]{3,30}$/.test(v.trim().toLowerCase()) ? v.trim().toLowerCase() : null;
// Où est rangé le compte : empreinte du courriel, ou ancien nom d'utilisateur
const idDuCourriel = c => "e_" + createHash("sha256").update(c).digest("hex").slice(0, 40);
const idDeConnexion = v => { const c = courrielOk(v); return c ? idDuCourriel(c) : ancienIdOk(v); };
const motDePasseOk = v => typeof v === "string" && v.length >= 8 && v.length <= 200;
const nomOk = v => typeof v === "string" && v.trim().length >= 1 && v.trim().length <= 30 ? v.trim().replace(/[<>]/g, "") : null;

async function hacher(motDePasse, sel = randomBytes(16).toString("hex")) {
  const h = await scryptAsync(motDePasse.normalize("NFKC"), sel, 64, { N: 16384, r: 8, p: 1 });
  return { sel, hash: h.toString("hex") };
}
async function verifier(motDePasse, compte) {
  const { hash } = await hacher(motDePasse, compte.sel);
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(compte.hash, "hex"));
}

const cleCompte = id => "compte/" + id;
const cleSession = h => "session/" + h;

async function ouvrirSession(store, compte) {
  const jeton = randomBytes(32).toString("hex");
  const h = empreinte(jeton);
  await store.setJSON(cleSession(h), { id: compte.id, expire: Date.now() + DUREE_SESSION });
  // On garde la liste des appareils connectés (les plus vieux sont déconnectés au-delà de 10)
  compte.sessions = [h, ...(compte.sessions || [])];
  for (const vieille of compte.sessions.slice(MAX_SESSIONS)) await store.delete(cleSession(vieille));
  compte.sessions = compte.sessions.slice(0, MAX_SESSIONS);
  return jeton;
}
async function fermerSessions(store, compte, garder = null) {
  for (const h of compte.sessions || []) if (h !== garder) await store.delete(cleSession(h));
  compte.sessions = garder ? [garder] : [];
}

// Le compte qui correspond au jeton envoyé (en-tête Authorization: Bearer …)
async function compteDuJeton(store, req) {
  const m = (req.headers.get("authorization") || "").match(/^Bearer ([a-f0-9]{64})$/);
  if (!m) return null;
  const h = empreinte(m[1]);
  const session = await store.get(cleSession(h), { type: "json" });
  if (!session || session.expire < Date.now()) return null;
  const compte = await store.get(cleCompte(session.id), { type: "json" });
  if (!compte || !(compte.sessions || []).includes(h)) return null;
  return { compte, h };
}
const profil = c => ({ identifiant: c.courriel || c.id, nom: c.nom, majLe: c.majLe || 0, donnees: c.donnees || null });

export default async (req) => {
  if (req.method !== "POST") return reponse(405, { erreur: "methode" });
  const store = getStore({ name: "watchall-comptes", consistency: "strong" });
  const action = new URL(req.url).searchParams.get("action") || "";
  const brut = await req.text();
  if (brut.length > MAX_DONNEES + 10_000) return reponse(413, { erreur: "trop_gros" });
  let d = {};
  try { d = brut ? JSON.parse(brut) : {}; } catch { return reponse(400, { erreur: "illisible" }); }
  if (!d || typeof d !== "object") return reponse(400, { erreur: "illisible" });

  // ---------- Créer un compte ----------
  if (action === "inscription") {
    const courriel = courrielOk(d.identifiant), nom = nomOk(d.nom);
    if (!courriel) return reponse(400, { erreur: "courriel_invalide" });
    const id = idDuCourriel(courriel);
    if (!nom) return reponse(400, { erreur: "nom_invalide" });
    if (!motDePasseOk(d.motDePasse)) return reponse(400, { erreur: "mot_de_passe_court" });
    if (await store.get(cleCompte(id), { type: "json" })) return reponse(409, { erreur: "courriel_pris" });
    const { sel, hash } = await hacher(d.motDePasse);
    const compte = { id, courriel, nom, sel, hash, creeLe: Date.now(), majLe: 0, donnees: null, sessions: [], echecs: 0, bloqueJusqua: 0 };
    const jeton = await ouvrirSession(store, compte);
    await store.setJSON(cleCompte(id), compte);
    return reponse(200, { jeton, ...profil(compte) });
  }

  // ---------- Se connecter ----------
  if (action === "connexion") {
    const id = idDeConnexion(d.identifiant);
    const compte = id && await store.get(cleCompte(id), { type: "json" });
    if (compte && compte.bloqueJusqua > Date.now()) return reponse(429, { erreur: "trop_d_essais" });
    const ok = compte && typeof d.motDePasse === "string" && await verifier(d.motDePasse, compte);
    if (!ok) {
      if (compte) {
        compte.echecs = (compte.echecs || 0) + 1;
        if (compte.echecs >= ECHECS_AVANT_BLOCAGE) { compte.bloqueJusqua = Date.now() + DUREE_BLOCAGE; compte.echecs = 0; }
        await store.setJSON(cleCompte(id), compte);
      }
      await pause(800); // même réponse et même délai que le compte existe ou non
      return reponse(401, { erreur: "identifiants_incorrects" });
    }
    compte.echecs = 0; compte.bloqueJusqua = 0;
    const jeton = await ouvrirSession(store, compte);
    await store.setJSON(cleCompte(id), compte);
    return reponse(200, { jeton, ...profil(compte) });
  }

  // ---------- Le propriétaire réinitialise le mot de passe d'un ami ----------
  if (action === "reinitialiser") {
    const admin = process.env.WATCHALL_ADMIN || "";
    if (!admin || !egal(req.headers.get("x-watchall-proprio") || "", admin)) { await pause(800); return reponse(401, { erreur: "refuse" }); }
    const id = idDeConnexion(d.identifiant);
    const compte = id && await store.get(cleCompte(id), { type: "json" });
    if (!compte) return reponse(404, { erreur: "compte_introuvable" });
    if (!motDePasseOk(d.nouveau)) return reponse(400, { erreur: "mot_de_passe_court" });
    Object.assign(compte, await hacher(d.nouveau), { echecs: 0, bloqueJusqua: 0 });
    await fermerSessions(store, compte);
    await store.setJSON(cleCompte(id), compte);
    return reponse(200, { ok: true });
  }

  // ---------- Tout le reste demande d'être connecté ----------
  const trouve = await compteDuJeton(store, req);
  if (!trouve) return reponse(401, { erreur: "non_connecte" });
  const { compte, h } = trouve;

  if (action === "moi") return reponse(200, profil(compte));

  if (action === "sauver") {
    if (!d.donnees || typeof d.donnees !== "object") return reponse(400, { erreur: "invalide" });
    const texte = JSON.stringify(d.donnees);
    if (texte.length > MAX_DONNEES) return reponse(413, { erreur: "trop_gros" });
    // Un autre appareil a enregistré entre-temps : on renvoie sa version
    if (Number(d.base) !== (compte.majLe || 0)) return reponse(409, { erreur: "conflit", ...profil(compte) });
    compte.donnees = d.donnees;
    compte.majLe = Date.now();
    await store.setJSON(cleCompte(compte.id), compte);
    return reponse(200, { ok: true, majLe: compte.majLe });
  }

  if (action === "profil") {
    const nom = nomOk(d.nom);
    if (!nom) return reponse(400, { erreur: "nom_invalide" });
    compte.nom = nom;
    await store.setJSON(cleCompte(compte.id), compte);
    return reponse(200, { ok: true, nom });
  }

  if (action === "mot-de-passe") {
    if (!(await verifier(String(d.ancien || ""), compte))) { await pause(800); return reponse(403, { erreur: "ancien_incorrect" }); }
    if (!motDePasseOk(d.nouveau)) return reponse(400, { erreur: "mot_de_passe_court" });
    Object.assign(compte, await hacher(d.nouveau));
    await fermerSessions(store, compte, h); // les autres appareils devront se reconnecter
    await store.setJSON(cleCompte(compte.id), compte);
    return reponse(200, { ok: true });
  }

  if (action === "deconnexion") {
    await store.delete(cleSession(h));
    compte.sessions = (compte.sessions || []).filter(x => x !== h);
    await store.setJSON(cleCompte(compte.id), compte);
    return reponse(200, { ok: true });
  }

  if (action === "supprimer") {
    if (!(await verifier(String(d.motDePasse || ""), compte))) { await pause(800); return reponse(403, { erreur: "ancien_incorrect" }); }
    await fermerSessions(store, compte);
    await store.delete(cleCompte(compte.id));
    return reponse(200, { ok: true });
  }

  return reponse(400, { erreur: "action_inconnue" });
};
