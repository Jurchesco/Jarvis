#!/usr/bin/env node
/**
 * Polish display names for ExerciseDB-style English names.
 * Structure-aware: Movement + equipment + position (PL gym convention).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "../src/exercisesLibrary.data.json");

/** Exact overrides (EN lowercase → PL). */
const EXACT = {
  plank: "Deska",
  "side plank": "Deska boczna",
  "pull-up": "Podciąganie",
  "pull up": "Podciąganie",
  "chin-up": "Podciąganie podchwytem",
  "chin up": "Podciąganie podchwytem",
  "push-up": "Pompka",
  "push up": "Pompka",
  "muscle up": "Muscle-up",
  "muscle-up": "Muscle-up",
  burpee: "Burpee",
  "jumping jack": "Pająk",
  "mountain climber": "Mountain climber",
  "russian twist": "Russian twist",
  "hip thrust": "Wypychanie bioder (hip thrust)",
  "face pull": "Face pull",
  "barbell bench press": "Wyciskanie sztangi na ławce płaskiej",
  "barbell incline bench press": "Wyciskanie sztangi na ławce skośnej",
  "barbell decline bench press": "Wyciskanie sztangi na ławce skos ujemny",
  "dumbbell bench press": "Wyciskanie hantli na ławce płaskiej",
  "dumbbell incline bench press": "Wyciskanie hantli na ławce skośnej",
  "barbell full squat": "Przysiad ze sztangą",
  "barbell squat": "Przysiad ze sztangą",
  "barbell front squat": "Przysiad przedni ze sztangą",
  "barbell deadlift": "Martwy ciąg",
  "barbell romanian deadlift": "Martwy ciąg rumuński",
  "dumbbell lateral raise": "Unoszenie hantli bokiem",
  "cable lateral raise": "Unoszenie bokiem na wyciągu",
  "cable seated row": "Wiosłowanie siedząc na wyciągu",
  "dumbbell biceps curl": "Uginanie ramion z hantlami",
  "barbell curl": "Uginanie ramion ze sztangą",
  "barbell shrug": "Szrugsy ze sztangą",
  "leg press": "Wypychanie nogami",
  "leg curl": "Uginanie nóg",
  "leg extension": "Wyprost nóg",
  "lat pulldown": "Ściąganie drążka wyciągu",
  "air bike": "Air bike",
};

const EQUIPMENT = [
  ["ez barbell", "sztangą EZ"],
  ["olympic barbell", "sztangą olimpijską"],
  ["trap bar", "sztangą hex"],
  ["smith machine", "maszyną Smitha"],
  ["leverage machine", "maszyną dźwigniową"],
  ["resistance band", "gumą oporową"],
  ["medicine ball", "piłką lekarską"],
  ["stability ball", "piłką stabilizacyjną"],
  ["bosu ball", "BOSU"],
  ["body weight", "masą ciała"],
  ["dumbbell", "hantlami"],
  ["barbell", "sztangą"],
  ["cable", "wyciągiem"],
  ["kettlebell", "kettlebell"],
  ["band", "gumą"],
  ["lever", "maszyną dźwigniową"],
  ["smith", "maszyną Smitha"],
  ["sled", "saniami"],
  ["rope", "liną"],
  ["roller", "rollerem"],
  ["wheel", "kółkiem"],
  ["tire", "oponą"],
  ["assisted", null], // handled as prefix flag
];

/** Movement phrases → Polish noun (longest first). */
const MOVEMENTS = [
  ["romanian deadlift", "martwy ciąg rumuński"],
  ["stiff leg deadlift", "martwy ciąg na prostych nogach"],
  ["sumo deadlift", "martwy ciąg sumo"],
  ["deadlift", "martwy ciąg"],
  ["bench press", "wyciskanie na ławce"],
  ["incline bench press", "wyciskanie na ławce skośnej"],
  ["decline bench press", "wyciskanie na ławce (skos ujemny)"],
  ["military press", "wyciskanie żołnierskie"],
  ["shoulder press", "wyciskanie nad głowę"],
  ["overhead press", "wyciskanie nad głowę"],
  ["chest press", "wyciskanie klatki"],
  ["push press", "push press"],
  ["front squat", "przysiad przedni"],
  ["back squat", "przysiad"],
  ["split squat", "przysiad bułgarski"],
  ["goblet squat", "przysiad goblet"],
  ["full squat", "przysiad"],
  ["squat", "przysiad"],
  ["lateral raise", "unoszenie bokiem"],
  ["front raise", "unoszenie przodem"],
  ["calf raise", "wspięcia na palce"],
  ["leg raise", "unoszenie nóg"],
  ["knee raise", "unoszenie kolan"],
  ["hammer curl", "uginanie młotkowe"],
  ["preacher curl", "uginanie na modlitewniku"],
  ["concentration curl", "uginanie koncentracyjne"],
  ["biceps curl", "uginanie bicepsa"],
  ["curl", "uginanie"],
  ["triceps extension", "prostowanie tricepsa"],
  ["skull crusher", "wyciskanie francuskie"],
  ["french press", "wyciskanie francuskie"],
  ["kickback", "kickback tricepsa"],
  ["upright row", "podciąganie wzdłuż tułowia"],
  ["seated row", "wiosłowanie siedząc"],
  ["bent over row", "wiosłowanie w opadzie"],
  ["t bar row", "wiosłowanie T-bar"],
  ["t-bar row", "wiosłowanie T-bar"],
  ["inverted row", "wiosłowanie odwrócone"],
  ["row", "wiosłowanie"],
  ["lat pulldown", "ściąganie drążka"],
  ["pulldown", "ściąganie"],
  ["pullover", "pullover"],
  ["chest fly", "rozpiętki"],
  ["cable fly", "rozpiętki"],
  ["fly", "rozpiętki"],
  ["leg press", "wypychanie nogami"],
  ["leg curl", "uginanie nóg"],
  ["leg extension", "wyprost nóg"],
  ["hip thrust", "wypychanie bioder"],
  ["glute bridge", "mostek biodrowy"],
  ["face pull", "face pull"],
  ["shrug", "szrugsy"],
  ["lunge", "wykroki"],
  ["lunges", "wykroki"],
  ["step up", "wchodzenie na podest"],
  ["step-up", "wchodzenie na podest"],
  ["box jump", "skok na skrzynię"],
  ["push-up", "pompka"],
  ["push up", "pompka"],
  ["pull-up", "podciąganie"],
  ["pull up", "podciąganie"],
  ["chin-up", "podciąganie podchwytem"],
  ["chin up", "podciąganie podchwytem"],
  ["dip", "dip"],
  ["crunch", "crunch"],
  ["sit-up", "brzuszki"],
  ["sit up", "brzuszki"],
  ["plank", "deska"],
  ["stretch", "rozciąganie"],
  ["extension", "prostowanie"],
  ["press", "wyciskanie"],
  ["raise", "unoszenie"],
  ["twist", "skrętoskłony"],
  ["swing", "swing"],
  ["carry", "noszenie"],
  ["walk", "spacer"],
  ["run", "bieg"],
  ["jump", "skok"],
  ["hyperextension", "prostowanie tułowia"],
  ["back extension", "prostowanie tułowia"],
  ["good morning", "good morning"],
  ["clean and jerk", "podrzut"],
  ["power clean", "podrzut siłowy"],
  ["snatch", "rwanie"],
  ["farmer walk", "spacer farmera"],
  ["farmers walk", "spacer farmera"],
  ["wrist curl", "uginanie nadgarstków"],
  ["ab wheel", "kółko do brzucha"],
  ["side bend", "skłony bokiem"],
  ["pullover", "pullover"],
  ["circles", "krążenia"],
  ["rotation", "rotacja"],
  ["abduction", "odwodzenie"],
  ["adduction", "przywodzenie"],
];

const MODIFIERS = {
  seated: "siedząc",
  standing: "stojąc",
  lying: "leżąc",
  prone: "na brzuchu",
  supine: "na plecach",
  kneeling: "klęcząc",
  hanging: "w zwisie",
  incline: "skos dodatni",
  decline: "skos ujemny",
  flat: "płaska",
  reverse: "odwrotne",
  alternate: "naprzemiennie",
  alternating: "naprzemiennie",
  single: "jednostronne",
  one: "jednostronne",
  "close-grip": "wąski chwyt",
  "wide-grip": "szeroki chwyt",
  "close grip": "wąski chwyt",
  "wide grip": "szeroki chwyt",
  "neutral grip": "chwyt młotkowy",
  overhead: "nad głową",
  "behind neck": "za karkiem",
  "behind head": "za głową",
  bent: "zgięte",
  straight: "proste",
  assisted: "z pomocą",
  weighted: "z obciążeniem",
  lateral: "boczne",
  front: "przód",
  rear: "tył",
  upper: "górne",
  lower: "dolne",
  inner: "wewnętrzne",
  outer: "zewnętrzne",
  high: "wysokie",
  low: "niskie",
  full: "pełne",
  half: "pół",
  parallel: "równoległe",
  vertical: "pionowe",
  horizontal: "poziome",
};

function titlePl(s) {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return t;
  return t.charAt(0).toLocaleUpperCase("pl-PL") + t.slice(1);
}

function translateName(enRaw) {
  let en = enRaw.toLowerCase().trim();
  en = en.replace(/\((male|female|men|women)\)/g, "").trim();
  en = en.replace(/\s+/g, " ");

  if (EXACT[en]) return EXACT[en];

  let assisted = false;
  if (en.startsWith("assisted ")) {
    assisted = true;
    en = en.slice("assisted ".length);
  }

  let equipmentPl = null;
  for (const [eqEn, eqPl] of EQUIPMENT) {
    if (en.startsWith(eqEn + " ")) {
      en = en.slice(eqEn.length + 1);
      equipmentPl = eqPl;
      break;
    }
    if (en === eqEn) {
      en = "";
      equipmentPl = eqPl;
      break;
    }
  }

  // Find movement (longest match anywhere, prefer end)
  let movementPl = null;
  let rest = en;
  const movSorted = [...MOVEMENTS].sort((a, b) => b[0].length - a[0].length);
  for (const [mEn, mPl] of movSorted) {
    if (rest.endsWith(mEn)) {
      movementPl = mPl;
      rest = rest.slice(0, rest.length - mEn.length).trim();
      break;
    }
    if (rest.includes(mEn)) {
      movementPl = mPl;
      rest = rest.replace(mEn, " ").replace(/\s+/g, " ").trim();
      break;
    }
  }

  // Remaining tokens as modifiers
  const modParts = [];
  let leftover = rest;
  const modKeys = Object.keys(MODIFIERS).sort((a, b) => b.length - a.length);
  for (const key of modKeys) {
    if (leftover.includes(key)) {
      modParts.push(MODIFIERS[key]);
      leftover = leftover.split(key).join(" ").replace(/\s+/g, " ").trim();
    }
  }

  // leftover English words — keep sparingly
  const keep = leftover
    .split(/[^a-z0-9+/°]+/)
    .filter(Boolean)
    .filter((w) => !["the", "a", "an", "of", "and", "on", "to", "with", "for"].includes(w));

  const bits = [];
  if (movementPl) bits.push(movementPl);
  else if (keep.length) bits.push(keep.join(" "));
  if (equipmentPl) {
    bits.push(equipmentPl.startsWith("masą") ? `z ${equipmentPl}` : `z ${equipmentPl}`);
  }
  if (modParts.length) bits.push(`(${modParts.join(", ")})`);
  if (movementPl && keep.length) {
    // translate leftover body-part English when possible
    const BODY = {
      chest: "klatka",
      back: "plecy",
      calves: "łydki",
      glutes: "pośladki",
      quads: "uda",
      hamstring: "tył uda",
      hamstrings: "tył uda",
      knee: "kolano",
      knees: "kolana",
      leg: "noga",
      legs: "nogi",
      arm: "ramię",
      arms: "ramiona",
      shoulder: "bark",
      shoulders: "barki",
      hip: "biodro",
      hips: "biodra",
      ankle: "kostka",
      side: "bok",
      adductor: "przywodziciele",
      abductor: "odwodziciele",
      pectoralis: "piersiowy",
      major: "",
      rectus: "",
      femoris: "",
      gluteus: "pośladkowy",
      piriformis: "gruszkowaty",
      throw: "",
      down: "",
      with: "",
      motion: "",
      russian: "",
      tap: "dotyk",
      power: "",
      point: "",
      lift: "unoszenie",
      fly: "rozpiętki",
      cross: "cross",
      body: "ciało",
      toe: "palce stóp",
      touch: "dotyk",
      heel: "pięta",
      touchers: "dotykanie",
      circular: "okrężne",
      apart: "rozstawione",
      basic: "podstawowe",
      all: "",
      fours: "czworak",
      squad: "",
      archer: "łucznik",
      air: "air",
      bike: "bike",
      bridge: "mostek",
      mountain: "mountain",
      climber: "climber",
      crab: "krab",
      bear: "niedźwiedź",
      crawl: "crawl",
      back: "plecy",
      forth: "w przód",
      step: "krok",
      balance: "równowaga",
      board: "deska",
      battling: "battle",
      ropes: "liny",
      butter: "",
      yoga: "joga",
      pose: "pozycja",
      hands: "ręce",
      stabilization: "stabilizacja",
    };
    const translated = keep
      .map((w) => (BODY[w] !== undefined ? BODY[w] : w))
      .filter(Boolean);
    if (translated.length) bits.push(translated.join(" "));
  }

  if (assisted) bits.push("(z pomocą)");

  let out = bits.join(" ").replace(/\s+/g, " ").trim();
  out = out
    .replace(/\bz z\b/g, "z")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+,/g, ",")
    .replace(/,\s*\)/g, ")")
    .replace(/\s+/g, " ")
    .trim();

  if (!out) out = enRaw;
  return titlePl(out);
}

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const samples = [];
for (const row of data) {
  row.nPl = translateName(row.n);
  if (samples.length < 30) samples.push(`${row.n} → ${row.nPl}`);
}
fs.writeFileSync(dataPath, JSON.stringify(data));
console.log("count", data.length);
console.log(samples.join("\n"));
const picks = [
  "barbell bench press",
  "dumbbell lateral raise",
  "cable seated row",
  "pull-up",
  "plank",
  "barbell full squat",
  "dumbbell biceps curl",
  "assisted hanging knee raise",
  "leg press",
];
for (const n of picks) {
  const r = data.find((e) => e.n === n);
  console.log("CHECK", n, "=>", r?.nPl);
}
