/* =========================================================
   Watchall : la configuration partagée (logos, cadrages, liens…)
   - GET  : tout le monde peut la lire.
   - POST : seulement le propriétaire, avec son mot de passe
            (variable d'environnement WATCHALL_ADMIN sur Netlify).
   Elle est gardée dans Netlify Blobs : pas besoin de remettre le
   site en ligne quand une image change.
   ========================================================= */
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

const TAILLE_MAX = 4_000_000;          // taille max de toute la configuration
const IMAGE_MAX = 1_500_000;           // taille max d'une image (même limite que la page)
const reponse = (statut, corps) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

// Compare le mot de passe sans laisser deviner sa longueur ou ses lettres
function motDePasseOk(req) {
  const attendu = process.env.WATCHALL_ADMIN || "";
  const recu = req.headers.get("x-watchall-proprio") || "";
  if (!attendu || !recu) return false;
  const a = createHash("sha256").update(attendu).digest();
  const b = createHash("sha256").update(recu).digest();
  return timingSafeEqual(a, b);
}

const texte = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
const nombre = (v, min, max, defaut) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut;
};
const ajustement = v => ["auto", "remplir", "entiere"].includes(v) ? v : "auto";
const cadrage = c => ({
  ajustement: ajustement(c && c.ajustement),
  ajusteManuel: !!(c && c.ajusteManuel === true),
  zoom: nombre(c && c.zoom, 1, 3, 1),
  posX: nombre(c && c.posX, 0, 100, 50),
  posY: nombre(c && c.posY, 0, 100, 50)
});
const urlOk = u => { const t = texte(u, 500); return /^https?:\/\/[^\s"<>]+$/i.test(t) ? t : ""; };
const appOk = u => {
  const t = texte(u, 200);
  if (!/^[a-z][a-z0-9+.-]*:\/\/\S*$/i.test(t) || /^(javascript|data|vbscript|file|https?):/i.test(t)) return "";
  return t;
};
const imageOk = i => typeof i === "string" && i.length < IMAGE_MAX &&
  /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(i) ? i : "";

// On ne garde que les champs connus, nettoyés (rien d'autre n'entre dans la configuration)
function nettoyer(d) {
  if (!d || !Array.isArray(d.services) || !d.services.length || d.services.length > 30) return null;
  const services = [];
  const ids = new Set();
  for (const s of d.services) {
    const id = texte(s && s.id, 60);
    const nom = texte(s && s.nom, 40);
    if (!id || !nom || ids.has(id)) return null;
    ids.add(id);
    services.push({
      id, nom,
      url: urlOk(s.url),
      app: appOk(s.app),
      couleur: /^#[0-9a-f]{6}$/i.test(s.couleur) ? s.couleur : "#888888",
      image: imageOk(s.image),
      ...cadrage(s),
      tel: cadrage(s.tel)
    });
  }
  return { version: 3, publieLe: Date.now(), services };
}

export default async (req) => {
  const store = getStore({ name: "watchall", consistency: "strong" });

  if (req.method === "GET") {
    const config = await store.get("config", { type: "json" });
    return config ? reponse(200, config) : reponse(404, { erreur: "aucune_configuration" });
  }
  if (req.method !== "POST") return reponse(405, { erreur: "methode" });
  if (!process.env.WATCHALL_ADMIN) return reponse(503, { erreur: "mot_de_passe_absent" });
  if (!motDePasseOk(req)) {
    await new Promise(r => setTimeout(r, 800)); // ralentit ceux qui essaient de deviner
    return reponse(401, { erreur: "refuse" });
  }
  if (new URL(req.url).searchParams.get("action") === "verifier") return reponse(200, { ok: true });

  const brut = await req.text();
  if (brut.length > TAILLE_MAX) return reponse(413, { erreur: "trop_gros" });
  let donnees;
  try { donnees = JSON.parse(brut); } catch { return reponse(400, { erreur: "illisible" }); }
  const config = nettoyer(donnees);
  if (!config) return reponse(400, { erreur: "invalide" });
  await store.setJSON("config", config);
  return reponse(200, { ok: true, publieLe: config.publieLe });
};
