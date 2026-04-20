#!/usr/bin/env node
// Regenerates the `name` and `description` fields for every SamuraiZERO entry in
// samuraimetadata.json according to the Budokai naming refresh spec.
//
// Rules applied:
//   A) Separators unified → CamelCase only (no '-', no '·').
//   B) Legacy 'Ii' suffix corrected → 'II' where appropriate (dropped in favor of tier-based Ω/α).
//   C) Tier suffix: Tenka Musō → Ω, Kensei → α, others → (no suffix).
//   D) Names reflect dominant trait by priority: weapon > mask > helmet > head.
//   E) Adrian skin prefix: Albino_Skin → "Pale", AlienSkin → "Xeno", #1,Zero → none (default).
//   F) Description gets a per-tier flavor line + "SamuraiZERO by HalfxTiger".
//
// The global #N suffix in each name is preserved so the collection index stays readable.

const fs = require("node:fs");
const path = require("node:path");

const SRC = path.resolve(__dirname, "../public/labmetadata/samuraimetadata.json");
const OUT = SRC; // in-place update
const BACKUP = SRC + ".backup";

// ─── Trait → name mappings ───────────────────────────────────────────────

const WEAPON_NAMES = {
    "Shuriken_Right": "ShurikenRain",
    "Shuriken-Left": "ShurikenRain",
    "Shuriken_Body": "ShurikenStorm",
    "Slash": "SlashArc",
    "Double-Slash": "TwinSlash",
    "Kama": "KamaTide",
    "Ninja-Kama": "KamaShade",
    "Sai": "SaiMirage",
    "Ninja-Sai": "SaiEdge",
    "Nunchaku": "NunchakuFlow",
    "Ninja-Nunchaku": "NunchakuStrike",
    "Wakizashi": "WakiShade",
    "Wakizashi-Kopie": "WakiShade",
    "Ninja-Wakizashi": "WakiVeil",
    "Katana": "KatanaSong",
    "Bo": "BoSentinel",
    "Tanto": "TantoSteel",
    "Fan-Nippon": "FanNippon",
    "Fan-Stick_Nippon": "FanStick",
    "Ninja-Smoke": "SmokeVeil",
};

const MASK_NAMES = {
    "Oni-Mask-Red": "OniVeil",
    "Oni-Mask-Pink": "OniVeil",
    "Oni-Mask-Green": "OniVeil",
    "Oni-Mask-Black": "OniVeil",
    "Oni-Mask-Gold": "OniVeil",
    "Oni-Mask-White": "OniVeil",
    "Hannya-Mask-Red": "HannyaGlow",
    "Hannya-Mask-Black": "HannyaGlow",
    "Hannya-Mask-Gold": "HannyaGlow",
    "Hannya-Mask-White": "HannyaGlow",
    "Tengu-Mask-Red": "TenguWing",
    "Tengu-Mask-White": "TenguWing",
    "Tengu-Mask-Black": "TenguWing",
    "Samurai-Mask-Red": "HelmSong",
    "Samurai-Mask-Black": "HelmSong",
    "Samurai-Mask-Gold": "HelmSong",
    "Samurai-Mask-White": "HelmSong",
    "Mouthguard-Gold": "JawGuard",
    "Mouthguard-Silver": "JawGuard",
    "Mouthguard-Red": "JawGuard",
    "Panda-Mask": "PandaZen",
    "Kizune-Mask": "KitsuneMask",
    "Tiger-Mask": "TigerRoar",
    "White-Tiger-Mask": "WhiteFang",
};

// Helmet only considered when no weapon & no mask
const HELMET_NAMES = {
    "Samurai-Helmet-Black": "KabutoCrest",
    "Samurai-Helmet-Red": "KabutoCrest",
    "Samurai-Helmet-Gold": "KabutoCrest",
    "Samurai-Helmet-White": "KabutoCrest",
    "Samurai-Helmet-Pink": "KabutoCrest",
    "Samurai-Helmet-Wiide-Black": "KabutoWide",
    "Samurai-Helmet-Wiide-Red": "KabutoWide",
    "Samurai-Helmet-Wiide-White": "KabutoWide",
    "Samurai-Helmet-Wiide-Gold": "KabutoWide",
    "Samurai-Helmet-Wide-Black": "KabutoWide",
    "Samurai-Helmet-Wide-Red": "KabutoWide",
    "Samurai-Helmet-Wide-Gold": "KabutoWide",
};

// Fallback head-based naming
const HEAD_NAMES = {
    "Chonmage": "TopKnot",
    "Chonmage-Up": "TopknotHigh",
    "Chonmage-Up-White": "SilverTopHigh",
    "Chonmage-Down": "TopknotLow",
    "Chonmage-Down-White": "TopknotDown",
    "Chonmage-Down-Black": "TopknotDown",
    "Chonmage-White": "SilverKnot",
    "Chonmage-Black": "ShadowKnot",
    "Samurai-Top-Knot": "SamuraiKnot",
    "Samurai-Top-Knot-Gold": "GildedKnot",
    "Samurai-Shaved-Top": "ShavenCrown",
    "Samurai-Shaved-Top-White": "SilverShaven",
    "Samurai-Wip": "KnotWhip",
    "Long-Hair-White": "SilverMane",
    "Master": "RoninMane",
    "Master-White": "SilverRonin",
    "Headband-Red": "CrimsonBand",
    "Headband-Black": "NightBand",
    "Headband-White": "IvoryBand",  // avoid collision with "Pale" skin prefix
    "Headband-Gold": "GoldBand",
    "Ninja-Headband": "HachimakiFlux",
    "Ninja-Headband-Red": "HachimakiFlux",
    "Ninja-Headband-Black": "HachimakiFlux",
    "Straw-Hat": "KasaDrift",
    "Straw-Hat-Down": "KasaLow",
    "Straw-Hat-Big": "KasaWide",
    "Straw-Hat-Wide": "KasaWide",
    "Head-Slice": "BladeMark",
    "Decapitation": "Headless",
};

// ─── Rules ───────────────────────────────────────────────────────────────

const SKIN_PREFIX = {
    "#1,Zero": "",          // default lineage, no prefix
    "Albino_Skin": "Pale",
    "AlienSkin": "Xeno",
};

function tierSuffix(tierRaw) {
    // Raw tier value is like "Tenka Musō (天下無双) / Peerless Under Heaven"
    if (tierRaw.startsWith("Tenka Musō")) return "Ω";
    if (tierRaw.startsWith("Kensei")) return "α";
    return "";
}

const TIER_FLAVOR = {
    "Tenka Musō": "Peerless under heaven. A warrior that divides eras.",
    "Kensei": "Sword sage. Steel as scripture.",
    "Hatamoto": "Banner guard. Honor in every move.",
    "Samurai": "Retainer. Sworn to the code.",
    "Musha": "Warrior. Rising through battle.",
    "Kami no Kago": "Blessed by kami. Fortune is a weapon.",
    "Heishi": "Soldier. Loyal to the last breath.",
    "Ashigaru": "Foot soldier. The spine of every army.",
};

function flavorFromTier(tierRaw) {
    for (const [key, line] of Object.entries(TIER_FLAVOR)) {
        if (tierRaw.startsWith(key)) return line;
    }
    return null;
}

// ─── Fallback generator for any trait value we didn't pre-map ────────────

function camelFromRawTrait(raw) {
    // e.g. "Tengu-Mask-Red" → "TenguMaskRed"
    if (!raw) return null;
    return raw
        .replace(/[_·.]/g, "-")
        .split("-")
        .map((part) => part.replace(/[^\w]/g, ""))
        .filter((part) => part.length > 0)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join("");
}

function baseName(attrs) {
    const get = (type) => attrs.find((a) => a.trait_type === type)?.value;
    const weapon = get("WEAPON");
    const mask = get("Mask");
    const head = get("Head");
    const armour = get("Armour");

    if (weapon && WEAPON_NAMES[weapon]) return WEAPON_NAMES[weapon];
    if (weapon) return camelFromRawTrait(weapon) || "BladeWalker";

    if (mask && MASK_NAMES[mask]) return MASK_NAMES[mask];
    if (mask) return camelFromRawTrait(mask) + "Veil";

    if (head && HELMET_NAMES[head]) return HELMET_NAMES[head];
    if (head && head.startsWith("Samurai-Helmet")) return "KabutoCrest";

    if (head && HEAD_NAMES[head]) return HEAD_NAMES[head];
    if (head) return camelFromRawTrait(head);

    if (armour) return "SteelOath";
    return "ZeroSamurai";
}

// ─── Main transform ──────────────────────────────────────────────────────

function regenEntry(entry) {
    const attrs = entry.attributes;
    const get = (type) => attrs.find((a) => a.trait_type === type)?.value;
    const adrian = get("Adrian") ?? "#1,Zero";
    const tierRaw = String(get("Senryoku Tier (戦力位)") ?? "");

    const prefix = SKIN_PREFIX[adrian] ?? "";
    const core = baseName(attrs);
    const suffix = tierSuffix(tierRaw);

    // Preserve original #N index from the existing name
    const indexMatch = /#(\d+)/.exec(entry.name ?? "");
    const idx = indexMatch ? indexMatch[1] : "";
    const numberPart = idx ? ` #${idx}` : "";

    const newName = `${prefix}${core}${suffix}${numberPart}`;

    const flavor = flavorFromTier(tierRaw);
    const newDescription = flavor
        ? `${flavor} SamuraiZERO by HalfxTiger.`
        : "SamuraiZERO by HalfxTiger";

    return {...entry, name: newName, description: newDescription};
}

function main() {
    const raw = fs.readFileSync(SRC, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data.collection)) throw new Error("collection[] missing");

    fs.writeFileSync(BACKUP, raw);
    console.log(`backup written: ${BACKUP}`);

    const stats = {prefixes: {}, suffixes: {}, bases: {}, total: 0};
    const newCollection = data.collection.map((entry) => {
        const updated = regenEntry(entry);
        stats.total++;
        const p = SKIN_PREFIX[entry.attributes.find((a) => a.trait_type === "Adrian")?.value] ?? "";
        stats.prefixes[p || "(none)"] = (stats.prefixes[p || "(none)"] || 0) + 1;
        const s = tierSuffix(String(entry.attributes.find((a) => a.trait_type === "Senryoku Tier (戦力位)")?.value ?? ""));
        stats.suffixes[s || "(none)"] = (stats.suffixes[s || "(none)"] || 0) + 1;
        const core = updated.name.replace(p, "").replace(s, "").replace(/\s*#\d+\s*$/, "");
        stats.bases[core] = (stats.bases[core] || 0) + 1;
        return updated;
    });

    // Uniqueness sanity check
    const names = newCollection.map((e) => e.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length > 0) throw new Error(`Name collisions: ${[...new Set(dupes)].slice(0, 10).join(", ")}`);

    data.collection = newCollection;
    fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
    console.log(`rewrote ${stats.total} entries → ${OUT}`);
    console.log(`prefix split:`, stats.prefixes);
    console.log(`suffix split:`, stats.suffixes);
    console.log(`unique base names: ${Object.keys(stats.bases).length}`);
    console.log(`top bases:`, Object.entries(stats.bases).sort((a, b) => b[1] - a[1]).slice(0, 8));
}

main();
