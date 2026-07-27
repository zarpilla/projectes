/* eslint-disable no-console */
/**
 * Standalone tests for buildEstimatedForecastByYear (no test runner needed).
 *
 * Run:  node tests/buildEstimatedForecastByYear.test.js
 *
 * Why standalone? The Strapi project currently has no test runner. Using only
 * the Node built-in `assert` module keeps the dependency footprint at zero.
 *
 * These tests exercise the economic forecast ("prevista") helper that drives
 * the "RESUM PREVISIÓ" table in PrevisioTable.vue. The forecast must mirror
 * ProjectForm's "Ingressos previstos" / "Despeses pr. factures" /
 * "Despeses pr. prorrata": planned lines (paid or not), dated by
 * date_estimate_document || date, plus prevista periodification, and with the
 * VAT prorrata computed from the year-specific deductible_vat_pct.
 */

const assert = require("assert");
const {
  buildEstimatedForecastByYear,
} = require("../api/project/services/projectFinancials");

let passed = 0;
let failed = 0;

const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL ${name}`);
    console.error(e && e.stack ? e.stack : e);
  }
};

const approx = (a, b, eps = 1e-9) =>
  Math.abs(a - b) < eps ||
  assert.fail(`expected ${a} ≈ ${b} (diff ${Math.abs(a - b)})`);

// A minimal project factory that only carries the fields the forecast helper
// reads: project_phases (with incomes/expenses + expense_type) and the
// periodification component. `date_start` is used only as a year fallback.
const project = (id, overrides = {}) => ({
  id,
  name: `Project ${id}`,
  date_start: "2025-01-01",
  project_phases: [],
  periodification: [],
  ...overrides,
});

const phase = (incomes = [], expenses = []) => ({ incomes, expenses });

const income = (quantity, amount, date, date_estimate_document) => ({
  quantity,
  amount,
  date,
  date_estimate_document,
  income_type: { name: "Venda" },
  paid: false,
});

// vat_pct defaults to 21 inside the engine; pass expense_type to override.
const expense = (
  quantity,
  amount,
  date,
  date_estimate_document,
  expense_type = { name: "Subministrament", vat_pct: 21 }
) => ({
  quantity,
  amount,
  date,
  date_estimate_document,
  expense_type,
  paid: false,
});

const periodification = (year, incomes, expenses, real_incomes = 0, real_expenses = 0) => ({
  year: String(year),
  incomes,
  expenses,
  real_incomes,
  real_expenses,
});

// Build the deductible map the way the controllers do:
//   prorrata ratio = (100 - deductible_vat_pct) / 100
// so deductible_vat_pct = 100 means the expense is 100% deductible and the
// non-deductible VAT (prorrata) is zero.
const vatMap = (entries) => new Map(entries.map(([y, pct]) => [String(y), pct]));

console.log("buildEstimatedForecastByYear");

test("returns empty object for no projects", () => {
  assert.deepStrictEqual(buildEstimatedForecastByYear([], vatMap([]), 100), {});
  assert.deepStrictEqual(
    buildEstimatedForecastByYear(null, vatMap([]), 100),
    {}
  );
});

test("sums planned income lines (paid or not) by previsió year", () => {
  const p = project(1, {
    project_phases: [
      phase(
        [
          // Two lines in 2025 (one paid, one unpaid — both must count).
          income(2, 100, "2025-01-01"),
          income(1, 50, "2025-06-01"),
          // A 2026 line.
          income(3, 10, "2026-03-01"),
        ],
        []
      ),
    ],
  });
  const out = buildEstimatedForecastByYear([p], vatMap([]), 100);

  approx(out["2025"].forecast_incomes, 2 * 100 + 1 * 50);
  approx(out["2025"].forecast_expenses, 0);
  approx(out["2025"].forecast_expenses_vat, 0);
  approx(out["2026"].forecast_incomes, 3 * 10);
});

test("dates lines by date_estimate_document || date (the previsió date)", () => {
  // Line declared for 2026 but with previsió date in 2025 -> counts in 2025.
  const p = project(1, {
    project_phases: [
      phase(
        [income(1, 100, "2026-01-01", "2025-09-01")],
        [expense(1, 200, "2026-01-01", "2025-09-01")]
      ),
    ],
  });
  const out = buildEstimatedForecastByYear([p], vatMap([["2025", 100]]), 100);

  approx(out["2025"].forecast_incomes, 100);
  approx(out["2025"].forecast_expenses, 200);
  // 100% deductible => no non-deductible VAT prorrata.
  approx(out["2025"].forecast_expenses_vat, 0);
  assert.strictEqual(out["2026"], undefined);
});

test("computes VAT prorrata from the year-specific deductible_vat_pct", () => {
  // 1000 base, 21% VAT => 210 VAT. With 80% deductible, the non-deductible
  // prorrata is 20% of 210 = 42.
  const p = project(1, {
    project_phases: [
      phase([], [expense(1, 1000, "2025-01-01", "2025-01-01")]),
    ],
  });
  const out = buildEstimatedForecastByYear([p], vatMap([["2025", 80]]), 100);

  approx(out["2025"].forecast_expenses, 1000); // base ("factures")
  approx(out["2025"].forecast_expenses_vat, 42); // prorrata
  approx(out["2025"].forecast_incomes, 0);
});

test("falls back to global deductible_vat_pct when the year is missing", () => {
  // No entry for 2025 in the map; fallback = 80.
  const p = project(1, {
    project_phases: [
      phase([], [expense(1, 1000, "2025-01-01", "2025-01-01")]),
    ],
  });
  const out = buildEstimatedForecastByYear([p], vatMap([]), 80);

  // prorrata = (100 - 80)/100 * 1000 * 21 / 100 = 42
  approx(out["2025"].forecast_expenses_vat, 42);
});

test("aggregates across multiple projects and keeps expenses positive", () => {
  const p1 = project(1, {
    project_phases: [
      phase([], [expense(1, 1000, "2025-01-01", "2025-01-01")]),
    ],
  });
  const p2 = project(2, {
    project_phases: [
      phase([income(5, 20, "2025-02-01")], []),
    ],
  });
  const out = buildEstimatedForecastByYear(
    [p1, p2],
    vatMap([["2025", 100]]),
    100
  );

  // expenses stay POSITIVE (form convention); the frontend negates for display.
  approx(out["2025"].forecast_incomes, 100);
  approx(out["2025"].forecast_expenses, 1000);
});

test("periodification=no ignores periodification entirely", () => {
  const p = project(1, {
    project_phases: [
      phase([income(1, 100, "2025-01-01")], [
        expense(1, 200, "2025-01-01", "2025-01-01"),
      ]),
    ],
    periodification: [
      // Both prevista and real values present; both must be ignored.
      periodification(2025, 300, 500, 700, 900),
    ],
  });
  // Default mode is "no", and passing it explicitly must match.
  const outExplicit = buildEstimatedForecastByYear(
    [p],
    vatMap([["2025", 100]]),
    100,
    "no"
  );
  const outDefault = buildEstimatedForecastByYear([p], vatMap([["2025", 100]]), 100);

  for (const out of [outExplicit, outDefault]) {
    approx(out["2025"].forecast_incomes, 100); // only the planned line
    approx(out["2025"].forecast_expenses, 200);
    approx(out["2025"].forecast_expenses_vat, 0);
  }
});

test("periodification=prevista layers pp.incomes / pp.expenses", () => {
  const p = project(1, {
    project_phases: [
      phase([income(1, 100, "2025-01-01")], [
        expense(1, 200, "2025-01-01", "2025-01-01"),
      ]),
    ],
    periodification: [
      // +300 income, +500 expense for the prevista dimension of 2025.
      // Real values (700/900) must be ignored in this mode.
      periodification(2025, 300, 500, 700, 900),
    ],
  });
  const out = buildEstimatedForecastByYear(
    [p],
    vatMap([["2025", 100]]),
    100,
    "prevista"
  );

  approx(out["2025"].forecast_incomes, 100 + 300);
  approx(out["2025"].forecast_expenses, 200 + 500);
  approx(out["2025"].forecast_expenses_vat, 0); // 100% deductible
});

test("periodification=real layers pp.real_incomes / pp.real_expenses", () => {
  const p = project(1, {
    project_phases: [
      phase([income(1, 100, "2025-01-01")], [
        expense(1, 200, "2025-01-01", "2025-01-01"),
      ]),
    ],
    periodification: [
      // Prevista values (300/500) must be ignored in "real" mode.
      periodification(2025, 300, 500, 700, 900),
    ],
  });
  const out = buildEstimatedForecastByYear(
    [p],
    vatMap([["2025", 100]]),
    100,
    "real"
  );

  approx(out["2025"].forecast_incomes, 100 + 700);
  approx(out["2025"].forecast_expenses, 200 + 900);
  approx(out["2025"].forecast_expenses_vat, 0);
});

test("periodification is dated 31/12 of its year, not the line date", () => {
  // A 2025 prevista periodification must land in 2025 even though December
  // 31st is the row date — it must never leak into 2026.
  const p = project(1, {
    periodification: [periodification(2025, 0, 1000)],
  });
  const out = buildEstimatedForecastByYear(
    [p],
    vatMap([["2025", 100]]),
    100,
    "prevista"
  );

  approx(out["2025"].forecast_expenses, 1000);
  assert.strictEqual(out["2026"], undefined);
});

console.log("");
console.log(`  ${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
