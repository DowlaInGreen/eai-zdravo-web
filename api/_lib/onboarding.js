// Onboarding validation (pure, no DB). One validator per step 1..6.
// Returns { ok, data, errors, warnings }. Error messages are Croatian (shown in UI).

const GOALS = ['save_money', 'less_time', 'more_protein', 'portion_control', 'kid_friendly'];
const TRAINING_GOALS = ['gain_weight', 'build_muscle', 'conditioning', 'lose_weight'];
const PLAN_STATUS = ['has_plan', 'has_trainer', 'needs_ideas', 'online_challenges', 'wants_trainer_referral'];
const TRAINER_MODES = ['online', 'in_person'];
const PROGRAMS = ['survivor', 'old_school', 'modern', 'protein_150'];
const DIETS = ['vegan', 'vegetarian', 'un_diet', 'keto', 'high_protein', 'low_fat', 'gluten_free', 'lactose_free'];
const ALLERGENS = ['gluten', 'milk', 'eggs', 'fish', 'crustaceans', 'molluscs', 'peanuts', 'tree_nuts',
  'soy', 'sesame', 'celery', 'mustard', 'lupin', 'sulphites'];

function intOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function subset(list, allowed) {
  if (!Array.isArray(list)) return null;
  const uniq = [...new Set(list.map(String))];
  return uniq.every((x) => allowed.includes(x)) ? uniq : null;
}

function step1(input, ctx) {
  const errors = {};
  const consent = input.consent === true;
  if (input.skip === true || !consent) {
    // bez privole (ili preskočeno) ne spremamo nijedan zdravstveni podatak
    return { ok: true, data: { consent: false, birth_year: null, height_cm: null, weight_kg: null }, errors, warnings: [] };
  }
  const year = ctx.currentYear;
  const by = intOrNull(input.birth_year);
  const h = intOrNull(input.height_cm);
  const w = intOrNull(input.weight_kg);
  if (by !== null && (!Number.isInteger(by) || by < 1920 || by > year - 14)) errors.birth_year = `Godište između 1920. i ${year - 14}.`;
  if (h !== null && (!Number.isInteger(h) || h < 120 || h > 230)) errors.height_cm = 'Visina između 120 i 230 cm.';
  if (w !== null && (Number.isNaN(w) || w < 30 || w > 250)) errors.weight_kg = 'Težina između 30 i 250 kg.';
  const data = { consent: true, birth_year: by, height_cm: h, weight_kg: w === null ? null : Math.round(w * 10) / 10 };
  return { ok: Object.keys(errors).length === 0, data, errors, warnings: [] };
}

function step2(input) {
  const goals = subset(input.goals || [], GOALS);
  if (!goals) return { ok: false, data: null, errors: { goals: 'Nepoznat cilj.' }, warnings: [] };
  if (goals.length > 2) return { ok: false, data: null, errors: { goals: 'Odaberi najviše 2.' }, warnings: [] };
  return { ok: true, data: { goals }, errors: {}, warnings: [] };
}

function step3(input) {
  if (typeof input.trains !== 'boolean') return { ok: false, data: null, errors: { trains: 'Odaberi Da ili Ne.' }, warnings: [] };
  if (!input.trains) return { ok: true, data: { trains: false, training_goal: null, plan_status: [], trainer_mode: null }, errors: {}, warnings: [] };
  const errors = {};
  if (!TRAINING_GOALS.includes(input.training_goal)) errors.training_goal = 'Odaberi cilj treninga.';
  const ps = subset(input.plan_status || [], PLAN_STATUS);
  if (!ps) errors.plan_status = 'Nepoznata opcija.';
  let mode = null;
  if (ps && ps.includes('wants_trainer_referral')) {
    if (!TRAINER_MODES.includes(input.trainer_mode)) errors.trainer_mode = 'Odaberi Online ili Uživo.';
    else mode = input.trainer_mode;
  }
  return {
    ok: Object.keys(errors).length === 0,
    data: { trains: true, training_goal: input.training_goal, plan_status: ps || [], trainer_mode: mode },
    errors, warnings: [],
  };
}

function programWarnings(program, diets) {
  const w = [];
  const veg = diets.includes('vegan') || diets.includes('vegetarian');
  if (veg && (program === 'old_school' || program === 'protein_150')) w.push('veg_vs_program');
  if (diets.includes('keto') && program === 'survivor') w.push('keto_vs_survivor');
  return w;
}

function step4(input) {
  const errors = {};
  if (!PROGRAMS.includes(input.program)) errors.program = 'Odaberi program.';
  const diets = subset(input.diets || [], DIETS);
  if (!diets) errors.diets = 'Nepoznat način prehrane.';
  if (Object.keys(errors).length) return { ok: false, data: null, errors, warnings: [] };
  return { ok: true, data: { program: input.program, diets }, errors, warnings: programWarnings(input.program, diets) };
}

function step5(input) {
  if (input.none === true) return { ok: true, data: { allergens: [], dislikes: (input.dislikes || '').toString().trim().slice(0, 200) || null }, errors: {}, warnings: [] };
  const allergens = subset(input.allergens || [], ALLERGENS);
  const dislikes = (input.dislikes || '').toString().trim();
  const errors = {};
  if (!allergens) errors.allergens = 'Nepoznat alergen.';
  if (dislikes.length > 200) errors.dislikes = 'Najviše 200 znakova.';
  return { ok: Object.keys(errors).length === 0, data: { allergens: allergens || [], dislikes: dislikes || null }, errors, warnings: [] };
}

function step6(input) {
  const a = intOrNull(input.adults);
  const c = intOrNull(input.children);
  const errors = {};
  if (!Number.isInteger(a) || a < 1 || a > 8) errors.adults = 'Odraslih od 1 do 8.';
  if (!Number.isInteger(c) || c < 0 || c > 8) errors.children = 'Djece od 0 do 8.';
  return { ok: Object.keys(errors).length === 0, data: { adults: a, children: c }, errors, warnings: [] };
}

const VALIDATORS = { 1: step1, 2: step2, 3: step3, 4: step4, 5: step5, 6: step6 };

function validateStep(step, input, ctx = { currentYear: new Date().getFullYear() }) {
  const fn = VALIDATORS[step];
  if (!fn) return { ok: false, data: null, errors: { step: 'Nepoznat korak.' }, warnings: [] };
  return fn(input && typeof input === 'object' ? input : {}, ctx);
}

// Dijete = pola porcije (trajno pravilo projekta). Udjeli troška po članu.
function householdShares(adults, children) {
  const portions = adults + 0.5 * children;
  return {
    portions,
    adultShare: portions ? 1 / portions : 0,
    childShare: portions ? 0.5 / portions : 0,
  };
}

module.exports = {
  validateStep, householdShares, programWarnings,
  GOALS, TRAINING_GOALS, PLAN_STATUS, TRAINER_MODES, PROGRAMS, DIETS, ALLERGENS,
};
