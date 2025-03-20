"use strict";
const { sanitizeEntity } = require("strapi-utils");
const _ = require("lodash");
const sumBy = require("lodash/sumBy");
const moment = require("moment");
const { getDailyDedications, getFestives } = require("../services/project");

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const doProjectInfoCalculations = async (data, id) => {
  if (!id || !data) {
    return;
  }

  const dailyDedications = await getDailyDedications();
  const festives = await getFestives();

  const me = await strapi.query("me").findOne();
  const deductible_vat_pct =
    me.options && me.options.deductible_vat_pct
      ? me.options.deductible_vat_pct
      : 100.0;
  const deductible_ratio = (100.0 - deductible_vat_pct) / 100.0;

  data.total_incomes = 0;
  data.total_expenses = 0;
  data.total_expenses_hours = 0;
  data.total_estimated_hours = 0;
  data.estimated_balance = 0;
  data.total_estimated_expenses = 0;
  data.total_expenses_vat = 0;
  data.total_real_expenses_vat = 0;

  if (data.project_phases && data.project_phases.length) {
    const infoPhases = await calculateEstimatedTotals(
      data,
      data.project_phases,
      dailyDedications,
      festives,
      true
    );

    var allByYear1 = JSON.parse(JSON.stringify(infoPhases.totalsByYear));

    // console.log('allByYear1', allByYear1)

    data = infoPhases.data;
    data.total_expenses = infoPhases.total_expenses;
    data.total_incomes = infoPhases.total_incomes;
    data.total_estimated_hours = infoPhases.total_estimated_hours;
    data.total_estimated_hours_price = infoPhases.total_estimated_hours_price;
    // not assigned invoices
    data.total_real_incomes = infoPhases.total_real_incomes;
    data.total_real_expenses = infoPhases.total_real_expenses;
    data.total_expenses_vat =
      (isNaN(infoPhases.total_expenses_vat)
        ? 0
        : infoPhases.total_expenses_vat) * deductible_ratio;
    data.total_real_expenses_vat =
      infoPhases.total_real_expenses_vat * deductible_ratio;

    // data.total_expenses = data.total_expenses + data.total_expenses_vat

    // console.log("data.project_original_phases", data.project_original_phases);

    if (data.project_original_phases && data.project_original_phases.length) {
      const infoOriginalPhases = await calculateEstimatedTotals(
        data,
        data.project_original_phases,
        dailyDedications,
        festives,
        false
      );

      // console.log("infoOriginalPhases", infoOriginalPhases);

      var allByYear2 = JSON.parse(
        JSON.stringify(infoOriginalPhases.totalsByYear)
      );

      data = infoOriginalPhases.data;
      data.total_expenses = infoOriginalPhases.total_expenses;
      data.total_incomes = infoOriginalPhases.total_incomes;
      data.total_estimated_hours = infoOriginalPhases.total_estimated_hours;
      data.total_estimated_hours_price =
        infoOriginalPhases.total_estimated_hours_price;

      data.total_expenses_vat =
        infoOriginalPhases.total_expenses_vat * deductible_ratio;
    }
  } else {
    data.total_expenses = 0;
    data.total_incomes = 0;
    data.total_estimated_hours = 0;
    data.total_estimated_hours_price = 0;
    data.total_real_incomes = 0;
    data.total_real_expenses = 0;
  }

  if (!data.activities) {
    data.activities = await strapi
      .query("activity")
      .find({ project: id, _limit: -1 });
  }

  const activities = data.activities;

  data.total_real_hours = _.sumBy(activities, "hours");
  const activities_price = activities.map((a) => {
    return { cost: a.hours * a.cost_by_hour };
  });
  data.total_real_hours_price = _.sumBy(activities_price, "cost");

  const activitiesByYear = _(
    activities.map((a) => {
      return { ...a, year: getEstimateYear(a) };
    })
  )
    .groupBy("year")
    .map((rows, year) => {
      return {
        year: year,
        // total_incomes: 0.0,
        total_real_hours: _.sumBy(rows, "hours"),
        total_real_hours_price: _.sumBy(rows, (a) => a.hours * a.cost_by_hour),
      };
    });

  var allByYear3 = JSON.parse(JSON.stringify(activitiesByYear));

  let allByYearArray = _.concat(allByYear1, allByYear2, allByYear3);

  var allByYearArrayJSON = JSON.parse(JSON.stringify(allByYearArray));

  const allByYear = _(_.values(allByYearArrayJSON.filter((a) => a !== null)))
    .groupBy("year")
    .map((rows, year) => {
      return {
        year: year,
        total_incomes: sumBy(rows, (r) =>
          r.total_incomes !== undefined ? parseFloat(r.total_incomes) : 0.0
        ),
        total_expenses: sumBy(rows, (r) =>
          r.total_expenses !== undefined ? parseFloat(r.total_expenses) : 0.0
        ),
        total_expenses_vat: sumBy(rows, (r) =>
          r.total_expenses_vat !== undefined
            ? deductible_ratio * parseFloat(r.total_expenses_vat)
            : 0.0
        ),
        total_real_incomes: sumBy(rows, (r) =>
          r.total_real_incomes !== undefined
            ? parseFloat(r.total_real_incomes)
            : 0.0
        ),
        total_real_expenses: sumBy(rows, (r) =>
          r.total_real_expenses !== undefined
            ? parseFloat(r.total_real_expenses)
            : 0.0
        ),
        total_real_expenses_vat: sumBy(rows, (r) =>
          r.total_real_expenses_vat !== undefined
            ? deductible_ratio * parseFloat(r.total_real_expenses_vat)
            : 0.0
        ),
        total_estimated_hours: sumBy(rows, (r) =>
          r.total_estimated_hours !== undefined
            ? parseFloat(r.total_estimated_hours)
            : 0.0
        ),
        total_estimated_hours_price: sumBy(rows, (r) =>
          r.total_estimated_hours_price !== undefined
            ? parseFloat(r.total_estimated_hours_price)
            : 0.0
        ),
        total_real_hours: sumBy(rows, (r) =>
          r.total_real_hours !== undefined
            ? parseFloat(r.total_real_hours)
            : 0.0
        ),
        total_real_hours_price: sumBy(rows, (r) =>
          r.total_real_hours_price !== undefined
            ? parseFloat(r.total_real_hours_price)
            : 0.0
        ),
        total_real_incomes_expenses:
          _.sumBy(rows, (r) =>
            r.total_real_incomes !== undefined
              ? parseFloat(r.total_real_incomes)
              : 0.0
          ) -
          _.sumBy(rows, (r) =>
            r.total_real_expenses !== undefined
              ? parseFloat(r.total_real_expenses)
              : 0.0
          ) -
          _.sumBy(rows, (r) =>
            r.total_real_hours_price !== undefined
              ? parseFloat(r.total_real_hours_price)
              : 0.0
          ),
        incomes_expenses:
          (_.sumBy(rows, (r) =>
            r.total_incomes !== undefined ? parseFloat(r.total_incomes) : 0.0
          ) |
            0.0) -
          (_.sumBy(rows, (r) =>
            r.total_expenses !== undefined ? parseFloat(r.total_expenses) : 0.0
          ) |
            0.0) -
          (_.sumBy(rows, (r) =>
            r.total_estimated_hours_price !== undefined
              ? parseFloat(r.total_estimated_hours_price)
              : 0.0
          ) |
            0.0),
      };
    });
  const allByYearPeriodificated = JSON.parse(JSON.stringify(allByYear)).map(
    (y) => {
      return {
        ...y,
        total_real_incomes:
          y.total_real_incomes +
          (data.periodification &&
          data.periodification.find((p) => p.year === y.year)
            ? data.periodification.find((p) => p.year === y.year).real_incomes
            : 0),
        total_real_expenses:
          y.total_real_expenses +
          (data.periodification &&
          data.periodification.find((p) => p.year === y.year)
            ? data.periodification.find((p) => p.year === y.year).real_expenses
            : 0),
        total_incomes:
          (y.total_incomes ?? 0) +
          (data.periodification &&
          data.periodification.find((p) => p.year === y.year)
            ? data.periodification.find((p) => p.year === y.year).incomes
            : 0),
        total_expenses:
          (y.total_expenses ?? 0) +
          (data.periodification &&
          data.periodification.find((p) => p.year === y.year)
            ? data.periodification.find((p) => p.year === y.year).expenses
            : 0),
      };
    }
  );

  data.allByYear = JSON.parse(JSON.stringify(allByYearPeriodificated));

  data.total_real_incomes_expenses =
    data.total_real_incomes -
    data.total_real_expenses -
    data.total_real_hours_price;

  if (data.structural_expenses_pct && false) {
    data.total_expenses =
      data.total_expenses +
      (data.structural_expenses_pct / 100) * data.total_incomes;
    data.incomes_expenses =
      data.total_incomes -
      data.total_expenses -
      data.total_estimated_expenses -
      data.total_expenses_vat;
    data.total_real_expenses =
      data.total_real_expenses +
      (data.structural_expenses_pct / 100) * data.total_real_incomes;
    data.total_real_incomes_expenses =
      data.total_real_incomes -
      data.total_real_expenses -
      data.total_real_hours_price -
      data.total_real_expenses_vat;
  }

  if (data.structural_expenses === true) {
    const indirects = await strapi
      .query("project")
      .find({ structural_expenses_pct_gt: 0, published_at_null: false });
    const indirectIncomes = _.sumBy(
      indirects.map((i) => {
        return {
          indirect: (i.structural_expenses_pct / 100) * i.total_incomes,
        };
      }),
      "indirect"
    );
    const indirectIncomesReal = _.sumBy(
      indirects.map((i) => {
        return {
          indirect: (i.structural_expenses_pct / 100) * i.total_real_incomes,
        };
      }),
      "indirect"
    );
    data.total_incomes = data.total_incomes + indirectIncomes;
    data.incomes_expenses = data.incomes_expenses + indirectIncomes;
    data.total_real_incomes = data.total_real_incomes + indirectIncomesReal;
  }

  data.total_real_incomes_expenses =
    data.total_real_incomes -
    data.total_real_expenses -
    data.total_real_hours_price -
    data.total_real_expenses_vat;

  data.balance =
    data.total_incomes - data.total_expenses - data.total_expenses_hours;
  data.estimated_balance =
    data.total_incomes - data.total_expenses - data.total_estimated_expenses;
  data.incomes_expenses =
    data.total_incomes -
    data.total_expenses -
    data.total_estimated_hours_price -
    data.total_expenses_vat;

  if (!data.leader || !data.leader.id) {
    delete data.leader;
  }

  return data;
};

// const updateProjectInfo = async (id, updateEstimated) => {
//   const data = await strapi.query("project").findOne({ id });

//   const info = await doProjectInfoCalculations(data, id);

//   if (!updateEstimated) {
//     delete info.incomes;
//     delete info.expenses;
//     delete info.phases;
//     delete info.original_phases;
//   }

//   info._internal = true;
//   await strapi.query("project").update({ id: id }, info);

//   // var end = new Date() - start
//   // console.log("updateProjectInfo 4", end);

//   return { id };
// };

// const addToYear = (years, year, property, value) => {
//   if (!years[`y_${year}`]) {
//     years[`y_${year}`] = {};
//   }
//   if (!years[`y_${year}`][property]) {
//     years[`y_${year}`][property] = 0;
//   }
//   years[`y_${year}`][property] += value;
//   return years;
// };

const getEstimateYear = (item) => {
  if (item && item.date_estimate_document) {
    return item.date_estimate_document.substring(0, 4);
  }
  if (item && item.date) {
    return item.date.substring(0, 4);
  }
  return "9999";
};

const getRealYear = (item) => {
  if (item && item.emitted) {
    return item.emitted.substring(0, 4);
  }
  if (item && item.paid_date) {
    return item.paid_date.substring(0, 4);
  }
  if (item && item.date) {
    return item.date.substring(0, 4);
  }
  return "9999";
};

const calculateEstimatedTotals = async (
  data,
  phases,
  dailyDedications,
  festives,
  real // or estimated
) => {
  var total_estimated_hours = 0;
  var total_incomes = 0;
  var total_estimated_hours_price = 0;
  let total_expenses = 0;
  let total_expenses_vat = 0;

  let total_real_incomes = 0;
  let total_real_expenses = 0;
  let total_real_expenses_vat = 0;

  const years = {};

  const totalsByDay = [];
  const rowsByYear = [];

  if (phases && phases.length) {
    for (var i = 0; i < phases.length; i++) {
      const phase = phases[i];
      if (phase.incomes && phase.incomes.length) {
        for (var j = 0; j < phase.incomes.length; j++) {
          const subphase = phase.incomes[j];
          var subphase_estimated_hours = 0;

          // console.log('subphase', subphase)

          subphase.total_amount =
            (subphase.quantity ? subphase.quantity : 0) *
            (subphase.amount ? subphase.amount : 0);
          total_incomes +=
            (subphase.quantity ? subphase.quantity : 0) *
            (subphase.amount ? subphase.amount : 0);

          const ey = getEstimateYear(subphase);
          if (!real) {
            rowsByYear.push({ year: ey, total_incomes: subphase.total_amount });
          }

          if (subphase.estimated_hours) {
            for (var k = 0; k < subphase.estimated_hours.length; k++) {
              const hours = subphase.estimated_hours[k];
              hours.total_amount = 0;
              if (
                hours.from &&
                hours.to &&
                hours.users_permissions_user &&
                hours.users_permissions_user.id
              ) {
                let mdiff = 1;

                if (hours.quantity_type && hours.quantity_type === "month") {
                  mdiff = Math.round(
                    moment
                      .duration(
                        moment(hours.to, "YYYY-MM-DD").diff(
                          moment(hours.from, "YYYY-MM-DD")
                        )
                      )
                      .asDays()
                  );
                  for (let i = 0; i < mdiff; i++) {
                    const day = moment(hours.from, "YYYY-MM-DD").add(i, "days");

                    const festive = festives.find(
                      (f) =>
                        f.date === day.format("YYYY-MM-DD") &&
                        ((f.users_permissions_user &&
                          f.users_permissions_user.id ==
                            hours.users_permissions_user.id) ||
                          !f.users_permissions_user)
                    );

                    if (![0, 6].includes(day.day()) && !festive) {
                      const q = hours.quantity / 5 / 4.3;
                      subphase_estimated_hours += q;
                      total_estimated_hours += q;

                      const dd = dailyDedications.find(
                        (d) =>
                          d.users_permissions_user.id ===
                            hours.users_permissions_user.id &&
                          d.from <= day.format("YYYY-MM-DD") &&
                          d.to >= day.format("YYYY-MM-DD")
                      );
                      const costByHour =
                        dd && dd.costByHour ? dd.costByHour : 0;
                      hours.total_amount += q * costByHour;
                      total_estimated_hours_price += q * costByHour;

                      totalsByDay.push({
                        day,
                        q,
                        costByHour,
                        userId: hours.users_permissions_user.id,
                        project: data.id,
                        project_name: data.name,
                      });

                      if (!real) {
                        rowsByYear.push({
                          year: day.format("YYYY"),
                          total_estimated_hours: q,
                        });
                        rowsByYear.push({
                          year: day.format("YYYY"),
                          total_estimated_hours_price: q * costByHour,
                        });
                      }
                    }
                  }
                } else if (
                  hours.quantity_type &&
                  hours.quantity_type === "week"
                ) {
                  mdiff = Math.round(
                    moment
                      .duration(
                        moment(hours.to, "YYYY-MM-DD").diff(
                          moment(hours.from, "YYYY-MM-DD")
                        )
                      )
                      .asDays()
                  );
                  for (let i = 0; i < mdiff; i++) {
                    const day = moment(hours.from, "YYYY-MM-DD").add(i, "days");

                    const festive = festives.find(
                      (f) =>
                        f.date === day.format("YYYY-MM-DD") &&
                        ((f.users_permissions_user &&
                          f.users_permissions_user.id ==
                            hours.users_permissions_user.id) ||
                          !f.users_permissions_user)
                    );

                    if (![0, 6].includes(day.day()) && !festive) {
                      const q = hours.quantity / 5;
                      subphase_estimated_hours += q;
                      total_estimated_hours += q;

                      const dd = dailyDedications.find(
                        (d) =>
                          d.users_permissions_user.id ===
                            hours.users_permissions_user.id &&
                          d.from <= day.format("YYYY-MM-DD") &&
                          d.to >= day.format("YYYY-MM-DD")
                      );
                      const costByHour =
                        dd && dd.costByHour ? dd.costByHour : 0;
                      hours.total_amount += q * costByHour;
                      total_estimated_hours_price += q * costByHour;

                      totalsByDay.push({
                        day,
                        q,
                        costByHour,
                        userId: hours.users_permissions_user.id,
                        project: data.id,
                        project_name: data.name,
                      });

                      if (!real) {
                        rowsByYear.push({
                          year: day.format("YYYY"),
                          total_estimated_hours: q,
                        });
                        rowsByYear.push({
                          year: day.format("YYYY"),
                          total_estimated_hours_price: q * costByHour,
                        });
                      }
                    }
                  }
                } else {
                  subphase_estimated_hours += hours.quantity * mdiff;
                  total_estimated_hours += hours.quantity * mdiff;

                  const dd = dailyDedications.find(
                    (d) =>
                      d.users_permissions_user.id ===
                        hours.users_permissions_user.id &&
                      d.from <= hours.from &&
                      d.to >= hours.from
                  );
                  const costByHour = dd && dd.costByHour ? dd.costByHour : 0;

                  hours.total_amount =
                    (hours.quantity ? hours.quantity : 0) * mdiff * costByHour;
                  total_estimated_hours_price +=
                    (hours.quantity ? hours.quantity : 0) * mdiff * costByHour;

                  mdiff = Math.round(
                    moment
                      .duration(
                        moment(hours.to, "YYYY-MM-DD").diff(
                          moment(hours.from, "YYYY-MM-DD")
                        )
                      )
                      .asMonths()
                  );

                  for (let i = 0; i < mdiff; i++) {
                    const day = moment(hours.from, "YYYY-MM-DD").add(
                      i,
                      "month"
                    );

                    totalsByDay.push({
                      day: day,
                      q: hours.quantity / mdiff,
                      costByHour,
                      userId: hours.users_permissions_user.id,
                      project: data.id,
                      project_name: data.name,
                    });

                    if (!real) {
                      rowsByYear.push({
                        year: day.format("YYYY"),
                        total_estimated_hours: hours.quantity / mdiff,
                      });
                      rowsByYear.push({
                        year: day.format("YYYY"),
                        total_estimated_hours_price:
                          (hours.quantity / mdiff) * costByHour,
                      });
                    }
                  }
                }
              }
            }
            subphase.total_estimated_hours = subphase_estimated_hours;
          }
          if (subphase.paid) {
            total_real_incomes +=
              (subphase.quantity ? subphase.quantity : 0) *
              (subphase.amount ? subphase.amount : 0);
            if (real) {
              const realYear = getRealYear(
                subphase.income
                  ? subphase.income
                  : subphase.expense
                  ? subphase.expense
                  : subphase.invoice
              );

              rowsByYear.push({
                year: realYear,
                total_real_incomes:
                  (subphase.quantity ? subphase.quantity : 0) *
                  (subphase.amount ? subphase.amount : 0),
              });
            }
          }
        }
      }
      if (phase.expenses && phase.expenses.length) {
        for (var j = 0; j < phase.expenses.length; j++) {
          const expense = phase.expenses[j];

          expense.total_amount =
            (expense.quantity ? expense.quantity : 0) *
            (expense.amount ? expense.amount : 0);
          total_expenses +=
            (expense.quantity ? expense.quantity : 0) *
            (expense.amount ? expense.amount : 0);

          expense.total_expenses_vat =
            (expense.total_amount *
              (expense.expense_type && expense.expense_type.vat_pct
                ? expense.expense_type.vat_pct
                : 21)) /
            100.0;

          total_expenses_vat += expense.total_expenses_vat;

          if (!real) {
            const ey = getEstimateYear(expense);
            rowsByYear.push({
              year: ey,
              total_expenses: expense.total_amount,
              total_expenses_vat: expense.total_expenses_vat,
            });
          }

          if (expense.paid) {
            // console.log('expense', expense)

            total_real_expenses +=
              (expense.quantity ? expense.quantity : 0) *
              (expense.amount ? expense.amount : 0);

            // total_real_expenses_vat +=
            //   (expense.quantity ? expense.quantity : 0) *
            //   (expense.amount ? expense.amount : 0) *
            //   (expense.expense_type && expense.expense_type.vat_pct ? expense.expense_type.vat_pct : 21) / 100.0;

            // console.log('total_real_expenses_vat', total_real_expenses_vat)

            if (real) {
              const realYear = getRealYear(
                expense.invoice ? expense.invoice : expense.expense
              );
              rowsByYear.push({
                year: realYear,
                total_real_expenses:
                  (expense.quantity ? expense.quantity : 0) *
                  (expense.amount ? expense.amount : 0),
                total_real_expenses_vat: expense.invoice
                  ? expense.invoice.total_vat || 0
                  : expense.total_expenses_vat || 0,
              });
              total_real_expenses_vat += expense.invoice
                ? expense.invoice.total_vat || 0
                : expense.total_expenses_vat || 0;
            }
          }
        }
      }
    }
  }

  const totalsByYear = _(rowsByYear)
    .groupBy("year")
    .map((rows, year) => {
      return {
        year: year,
        total_expenses: _.sumBy(rows, "total_expenses"),
        total_expenses_vat: _.sumBy(rows, "total_expenses_vat"),
        total_incomes: _.sumBy(rows, "total_incomes"),
        total_estimated_hours: _.sumBy(rows, "total_estimated_hours"),
        total_estimated_hours_price: _.sumBy(
          rows,
          "total_estimated_hours_price"
        ),
        total_real_incomes: _.sumBy(rows, "total_real_incomes"),
        total_real_expenses: _.sumBy(rows, "total_real_expenses"),
        total_real_expenses_vat: _.sumBy(
          rows,
          (r) => r.total_real_expenses_vat || 0
        ),
      };
    });

  return {
    data,
    total_expenses,
    total_incomes,
    total_estimated_hours,
    total_estimated_hours_price,
    total_real_incomes,
    total_real_expenses,
    total_expenses_vat,
    total_real_expenses_vat,
    totalsByDay,
    totalsByYear,
  };
};

let projectsQueue = [];

module.exports = {
  async calculateProject(data, id) {
    return await doProjectInfoCalculations(data, id);
  },
  async calculateProject2(ctx) {
    const id = ctx.params.id;

    const dataPhases = await strapi
    .query("project")
    .findOne({ id: id }, [
      "project_phases",
      "project_phases.incomes",
      "project_phases.incomes.estimated_hours",
      "project_phases.incomes.income_type",
      "project_phases.incomes.estimated_hours.users_permissions_user",
      "project_phases.incomes.invoice",
      "project_phases.incomes.income",
      "project_phases.expenses",
      "project_phases.expenses.expense_type",
      "project_phases.expenses.invoice",
      "project_phases.expenses.expense",
      "project_original_phases",
      "project_original_phases.incomes",
      "project_original_phases.incomes.estimated_hours",
      "project_original_phases.incomes.income_type",
      "project_original_phases.incomes.estimated_hours.users_permissions_user",
      "project_original_phases.incomes.invoice",
      "project_original_phases.incomes.income",
      "project_original_phases.expenses",
      "project_original_phases.expenses.expense_type",
      "project_original_phases.expenses.invoice",
      "project_original_phases.expenses.expense",
    ]);

    const moreData = await doProjectInfoCalculations(dataPhases, id);
    return { allByYear: moreData.allByYear };
  },
  async reset() {
    // await strapi.query("project").delete({ _limit: -1 });
    // await strapi.query("activity").delete({ _limit: -1 });
    // await strapi.query("activity-type").delete({ _limit: -1 });
    // await strapi.query("daily-dedication").delete({ _limit: -1 });
    // await strapi.query("contacts").delete({ _limit: -1 });
    // await strapi.query("emitted-invoice").delete({ _limit: -1 });
    // await strapi.query("festive").delete({ _limit: -1, users_permissions_user_ne: null});
    // await strapi.query("kanban-view").delete({ _limit: -1 });
    // await strapi.query("payroll").delete({ _limit: -1 });
    // await strapi.query("quote").delete({ _limit: -1 });
    // await strapi.query("received-expense").delete({ _limit: -1 });
    // await strapi.query("received-income").delete({ _limit: -1 });
    // await strapi.query("received-invoice").delete({ _limit: -1 });
    // await strapi.query("project-scope").delete({ _limit: -1 });
    // await strapi.query("serie").delete({ _limit: -1 });
    // await strapi.query("task").delete({ _limit: -1 });
    // await strapi.query("time-counter").delete({ _limit: -1 });
    // await strapi.query("treasury").delete({ _limit: -1 });
    // //// await strapi.query("year").delete({ _limit: -1 });

    // const data = await strapi.db.connection.raw(`SELECT * from table`);

    // comment activity beforeDelete
    // delete users-permissions_user manually
    // to fill: year, festive

    return [];
  },
  // async updateDirtyProject(id) {
  //   const project = await strapi.query("project").findOne({ id: id });

  //   const data = await doProjectInfoCalculations(project, id);

  //   // data._internal = true;
  //   data.dirty = false;

  //   return data;
  // },
  async updateDirtyProjects() {
    const projectsQueue = await strapi
      .query("dirty-queue")
      .find({ entity: "project", _limit: -1 });

    const uniqueProjects = _.union(projectsQueue.map((p) => p.entityId));
    const ids = uniqueProjects.map((p) => p.id);

    if (uniqueProjects.length === 0) {
      await strapi.connections.default.raw("TRUNCATE TABLE dirty_queues;");
      return;
    }

    // console.log('filtered', filtered)

    let ok = true;

    for await (const project of uniqueProjects) {
      try {
        const data = await strapi
          .query("project")
          .findOne({ id: project }, [
            "project_phases",
            "project_phases.incomes",
            "project_phases.incomes.estimated_hours",
            "project_phases.incomes.income_type",
            "project_phases.incomes.estimated_hours.users_permissions_user",
            "project_phases.incomes.invoice",
            "project_phases.incomes.income",
            "project_phases.expenses",
            "project_phases.expenses.expense_type",
            "project_phases.expenses.invoice",
            "project_phases.expenses.expense",
            "project_original_phases",
            "project_original_phases.incomes",
            "project_original_phases.incomes.estimated_hours",
            "project_original_phases.incomes.income_type",
            "project_original_phases.incomes.estimated_hours.users_permissions_user",
            "project_original_phases.incomes.invoice",
            "project_original_phases.incomes.income",
            "project_original_phases.expenses",
            "project_original_phases.expenses.expense_type",
            "project_original_phases.expenses.invoice",
            "project_original_phases.expenses.expense",
          ]);

        // const info = await doProjectInfoCalculations(data, project);

        const projectDataToUpdate = {
          project_phases: data.project_phases,
          project_original_phases: data.project_original_phases,
          id: project,
        };

        await strapi
          .query("project")
          .update({ id: project }, projectDataToUpdate);
      } catch (e) {
        console.error(e);
        ok = false;
      }
    }

    // // delete from dirty-queue
    if (ok) {
      for await (const id of ids) {
        await strapi.query("dirty-queue").delete({ id: id });
      }
    }
  },
  async findWithBasicInfo(ctx) {
    // Calling the default core action
    let projects;

    // only published
    ctx.query.published_at_null = false;
    if (ctx.query._q) {
      projects = await strapi
        .query("project")
        .search(ctx.query, [
          "leader",
          "project_scope",
          "project_state",
          "clients",
          "activity_types",
          "global_activity_types",
        ]);
    } else {
      projects = await strapi
        .query("project")
        .find(ctx.query, [
          "leader",
          "project_scope",
          "project_state",
          "clients",
          "activity_types",
          "global_activity_types",
        ]);
    }

    // Removing some info
    const newArray = projects
      .map(
        ({
          phases,
          activities,
          emitted_invoices,
          received_invoices,
          tickets,
          diets,
          emitted_grants,
          received_grants,
          quotes,
          original_phases,
          incomes,
          expenses,
          strategies,
          estimated_hours,
          intercooperations,
          received_expenses,
          received_incomes,
          treasury_annotations,
          linked_emitted_invoices,
          linked_received_expenses,
          linked_received_incomes,
          linked_received_invoices,
          ...item
        }) => item
      )
      .map((p) => {
        return {
          ...p,
          clients: p.clients
            ? p.clients.map((c) => {
                return { id: c.id, name: c.name };
              })
            : null,
        };
      });

    return newArray.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models.project })
    );
  },

  async findNames(ctx) {
    // Calling the default core action
    let projects;

    // only published
    ctx.query.published_at_null = false;
    if (ctx.query._q) {
      projects = await strapi.query("project").search(ctx.query);
    } else {
      projects = await strapi.query("project").find(ctx.query, []);
    }

    // Removing some info
    const newArray = projects.map((p) => {
      return {
        id: p.id,
        name: p.name,
      };
    });

    return newArray.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models.project })
    );
  },

  async findWithPhases(ctx) {
    // Calling the default core action
    let projects;
    const { published_at_null, _limit, activities, ...where } = ctx.query;

    const project_state_in = where._where.project_state_in;

    const withRelated = [
      "project_original_phases",
      "project_original_phases.incomes",
      "project_original_phases.incomes.estimated_hours",
      "project_original_phases.incomes.estimated_hours.users_permissions_user"
    ]

    if (activities) {
      withRelated.push("activities");
    }

    if (ctx.query._q) {
      projects = await strapi
        .query("project")
        .model.fetchAll({ withRelated: ["project_original_phases"] });
    } else {
      projects = await strapi
        .query("project")
        .model.query((qb) => {
          qb.select("id", "name", "published_at")
          .where(
            "project_state",
            "in",
            project_state_in.split(",").map((s) => parseInt(s))
          );
        })
        .fetchAll({
          withRelated: withRelated
        });
    }

    return projects
      .map((entity) => sanitizeEntity(entity, { model: strapi.models.project }))
      .filter((p) => p.published_at !== "" && p.published_at !== null);
  },

  async findWithEconomicDetail(ctx) {
    // Calling the default core action

    // only published
    // ctx.query.published_at_null = false;

    const start = +new Date();

    const { query, paid, document } = ctx.query;
    // ctx.query = { _limit: -1 }

    const promises = [];

    //console.log('query', query, year)
    const year =
      ctx.query && ctx.query._where && ctx.query._where.year_eq
        ? ctx.query._where.year_eq
        : null;

    if (ctx.query._q) {
      promises.push(strapi.query("project").search(ctx.query));
    } else {
      promises.push(
        strapi
          .query("project")
          .find({ _limit: -1 }, [
            "project_state",
            "activities",
            "project_phases",
            "project_phases.incomes",
            "project_phases.incomes.estimated_hours",
            "project_phases.incomes.income_type",
            "project_phases.incomes.estimated_hours.users_permissions_user",
            "project_phases.incomes.invoice",
            "project_phases.incomes.income",
            "project_phases.expenses",
            "project_phases.expenses.expense_type",
            "project_phases.expenses.invoice",
            "project_phases.expenses.expense",
            "project_original_phases",
            "project_original_phases.incomes",
            "project_original_phases.incomes.estimated_hours",
            "project_original_phases.incomes.income_type",
            "project_original_phases.incomes.estimated_hours.users_permissions_user",
            "project_original_phases.incomes.invoice",
            "project_original_phases.incomes.income",
            "project_original_phases.expenses",
            "project_original_phases.expenses.expense_type",
            "project_original_phases.expenses.invoice",
            "project_original_phases.expenses.expense",
          ])
      );
    }

    promises.push(strapi.query("daily-dedication").find({ _limit: -1 }));

    promises.push(strapi.query("festive").find({ _limit: -1 }));

    const results = await Promise.all(promises);

    let projects = results[0];
    //const activities = results[1];
    const dailyDedications = results[1];
    const festives = results[2];

    projects = projects.filter((p) => p.published_at !== null);
    if (ctx.query && ctx.query._where && ctx.query._where.project_state_eq) {
      projects = projects.filter(
        (p) =>
          p.project_state &&
          p.project_state.id == ctx.query._where.project_state_eq
      );
    } else if (
      ctx.query &&
      ctx.query._where &&
      ctx.query._where.project_state_in
    ) {
      projects = projects.filter(
        (p) =>
          p.project_state &&
          ctx.query._where.project_state_in
            .split(",")
            .includes(p.project_state.id.toString())
      );
    }

    // console.log('projects', projects[0].activities ? projects[0].activities[0] : 0)
    const activities = [];
    projects.forEach((p) => {
      p.activities.forEach((a) => {
        if (!year || (a.date && a.date.substring(0, 4) === year.toString())) {
          activities.push(a);
        }
      });
    });

    var response = [];

    const activitiesPYM = activities
      .filter((a) => a.date && a.project)
      .map((a) => {
        return {
          ...a,
          pym: `${a.project}.${moment(a.date, "YYYY-MM-DD").year()}.${moment(
            a.date,
            "YYYY-MM-DD"
          ).month()}`,
        };
      });
    const groupedActivities = _(activitiesPYM)
      .groupBy("pym")
      .map((rows, id) => {
        return {
          projectId: parseInt(id.split(".")[0]),
          year: parseInt(id.split(".")[1]),
          month: parseInt(id.split(".")[2]) + 1,
          cost: _.sumBy(rows, (r) => r.hours * r.cost_by_hour),
          hours: _.sumBy(rows, "hours"),
        };
      });

    const groupedActivitiesObj = JSON.parse(JSON.stringify(groupedActivities));
    // console.log('activities', activities.length)
    // console.log('grouped', grouped)

    // const activities = await strapi.query("activity").find({ _limit: -1 });
    const noPhaseInfo = { phase: "-", subphase: "-" };

    const me = await strapi.query("me").findOne();
    const deductible_vat_pct =
      me.options && me.options.deductible_vat_pct
        ? me.options.deductible_vat_pct
        : 100.0;
    const deductible_ratio = (100.0 - deductible_vat_pct) / 100.0;

    for (var i = 0; i < projects.length; i++) {
      const p = projects[i];
      const projectInfo = {
        id: p.id,
        project_name: p.name,
        project_scope:
          p.project_scope && p.project_scope.id ? p.project_scope.name : "",
        project_state:
          p.project_state && p.project_state.id ? p.project_state.name : "",
        project_type:
          p.project_type && p.project_type.id ? p.project_type.name : "",
        project_leader: p.leader && p.leader.id ? p.leader.username : "",
        mother: p.mother && p.mother.id ? p.mother.name : p.name,
        structural_expenses: p.structural_expenses,
        grantable: p.grantable ? 1 : 0,
      };

      for (var j = 0; j < p.project_phases.length; j++) {
        const ph = p.project_phases[j];
        for (var k = 0; k < ph.incomes.length; k++) {
          const sph = ph.incomes[k];
          const phaseInfo = { phase: ph.name, subphase: sph.concept };

          if (sph.quantity && sph.amount) {
            const document = sph.income || sph.invoice;
            const date =
              sph.paid && document
                ? document.emitted
                : sph.date_estimate_document;
            response.push({
              ...projectInfo,
              ...phaseInfo,
              type: "income",
              paid: sph.paid,
              date: date,
              income_esti: 0,
              income_real: sph.paid ? sph.quantity * sph.amount : 0,
              year: moment(date, "YYYY-MM-DD").format("YYYY"),
              month: moment(date, "YYYY-MM-DD").format("MM"),
              row_type:
                sph.income_type && sph.income_type.name
                  ? sph.income_type.name
                  : "",
              document,
            });
          }
        }

        for (var k = 0; k < ph.expenses.length; k++) {
          const sph = ph.expenses[k];
          const phaseInfo = { phase: ph.name, subphase: sph.concept };
          if (sph.quantity && sph.amount) {
            const document = sph.expense || sph.invoice;
            const date =
              sph.paid && document
                ? document.emitted
                : sph.date_estimate_document;
            response.push({
              ...projectInfo,
              ...phaseInfo,
              type: "expense",
              paid: sph.paid,
              expense_esti: 0,
              expense_real: sph.paid ? -1 * sph.quantity * sph.amount : 0,
              expense_real_vat:
                sph.paid && document
                  ? -1 * document.total_vat * deductible_ratio
                  : 0,
              date,
              year: moment(date, "YYYY-MM-DD").format("YYYY"),
              month: moment(date, "YYYY-MM-DD").format("MM"),
              row_type:
                sph.expense_type && sph.expense_type.name
                  ? sph.expense_type.name
                  : "",
              document,
            });
          }
        }
      }

      for (var j = 0; j < p.project_original_phases.length; j++) {
        const ph = p.project_original_phases[j];
        for (var k = 0; k < ph.incomes.length; k++) {
          const sph = ph.incomes[k];
          const phaseInfo = { phase: ph.name, subphase: sph.concept };
          if (sph.quantity && sph.amount) {
            const document = sph.income || sph.invoice;
            const date = sph.date_estimate_document || sph.date;
            response.push({
              ...projectInfo,
              ...phaseInfo,
              type: "income",
              // paid: sph.paid,
              date: date,
              income_esti: sph.quantity * sph.amount,
              income_real: 0,
              year: moment(date, "YYYY-MM-DD").format("YYYY"),
              month: moment(date, "YYYY-MM-DD").format("MM"),
              row_type:
                sph.income_type && sph.income_type.name
                  ? sph.income_type.name
                  : "",
              document,
            });
          }
        }
        for (var k = 0; k < ph.expenses.length; k++) {
          const sph = ph.expenses[k];
          const phaseInfo = { phase: ph.name, subphase: sph.concept };
          if (sph.quantity && sph.amount) {
            const document = sph.expense || sph.invoice;
            const date = sph.date_estimate_document || sph.date;
            response.push({
              ...projectInfo,
              ...phaseInfo,
              type: "expense",
              // paid: sph.paid,
              expense_esti: -1 * Math.abs(sph.quantity * sph.amount),
              expense_esti_vat:
                (-1 *
                  deductible_ratio *
                  Math.abs(sph.quantity * sph.amount) *
                  (sph.expense_type && sph.expense_type.vat_pct
                    ? sph.expense_type.vat_pct
                    : 21)) /
                100.0,
              expense_real: 0,
              date: sph.date,
              year: moment(date, "YYYY-MM-DD").format("YYYY"),
              month: moment(date, "YYYY-MM-DD").format("MM"),
              row_type:
                sph.expense_type && sph.expense_type.name
                  ? sph.expense_type.name
                  : "",
              document,
            });
          }
        }
      }

      if (p.periodification && p.periodification.length) {
        for (var j = 0; j < p.periodification.length; j++) {
          const pp = p.periodification[j];

          response.push({
            ...projectInfo,
            ...noPhaseInfo,
            type: "income",
            income_esti: pp.incomes,
            income_real: pp.real_incomes,
            date: `${pp.year}-12-31`,
            year: pp.year.toString(),
            month: "12",
            row_type: "Periodificació",
          });

          response.push({
            ...projectInfo,
            ...noPhaseInfo,
            type: "expense",
            expense_esti: pp.expenses,
            expense_real: pp.real_expenses,
            date: `${pp.year}-12-31`,
            year: pp.year.toString(),
            month: "12",
            row_type: "Periodificació",
          });
        }
      }

      const projectActivities = groupedActivitiesObj.filter(
        (a) => a.projectId === projectInfo.id
      );

      for (var j = 0; j < projectActivities.length; j++) {
        const pa = projectActivities[j];
        response.push({
          ...projectInfo,
          ...noPhaseInfo,
          type: "real_hours",
          date: "",
          total_estimated_hours_price: 0,
          total_real_hours_price: -1 * (pa.cost || 0),
          total_real_hours: pa.hours || 0,
          year: pa.year.toString().padStart(4, "0"),
          month: pa.month.toString().padStart(2, "0"),
          row_type: "",
          // document: "0",
        });
      }

      const { totalsByDay } = await calculateEstimatedTotals(
        { id: projectInfo.id, name: projectInfo.project_name },
        p.project_original_phases,
        dailyDedications,
        festives
      );

      const totalsByDayPYM = totalsByDay.map((a) => {
        return {
          ...a,
          ym: `${moment(a.day, "YYYY-MM-DD").year()}.${moment(
            a.day,
            "YYYY-MM-DD"
          ).month()}`,
        };
      });
      const groupedTotalsByDay = _(totalsByDayPYM)
        .groupBy("ym")
        .map((rows, id) => {
          return {
            year: parseInt(id.split(".")[0]),
            month: parseInt(id.split(".")[1]) + 1,
            cost: _.sumBy(rows, (r) => r.q * r.costByHour),
            q: _.sumBy(rows, (r) => r.q),
          };
        });

      const groupedTotalsByDayObj = JSON.parse(
        JSON.stringify(groupedTotalsByDay)
      );
      for (var j = 0; j < groupedTotalsByDayObj.length; j++) {
        const g = groupedTotalsByDayObj[j];

        response.push({
          ...projectInfo,
          ...noPhaseInfo,
          type: "estimated_hours",
          date: "",
          total_estimated_hours_price: -1 * (g.cost || 0),
          total_estimated_hours: g.q || 0,
          total_real_hours_price: 0,
          year: g.year.toString(),
          month: g.month.toString().padStart(2, "0"),
          row_type: "",
          // document: "0",
        });
      }
    }

    if (year) {
      response = response.filter((r) => r.year === year);
    }

    if (ctx.query && ctx.query._where && ctx.query._where.year_eq) {
      response = response.filter(
        (r) => r.year.toString() === ctx.query._where.year_eq.toString()
      );
    }

    if (paid != null) {
      response = response.filter((r) => r.paid === (paid === "true"));
    }

    // Removing some info
    // const newArray = projects.map(({ phases, activities, emitted_invoices, received_invoices, tickets, diets, emitted_grants, received_grants, quotes, original_phases, incomes, expenses, strategies, estimated_hours, intercooperations, clients, received_expenses, received_incomes, ...item }) => item)
    return _.sortBy(response, ["year", "month", "name"]);
  },

  async findEstimatedTotalsByDay(ctx) {
    ctx.query.published_at_null = false;
    const { year, ...query } = ctx.query;

    const promises = [];
    if (query._q) {
      promises.push(strapi.query("project").search(query));
    } else {
      promises.push(strapi.query("project").find(query));
    }

    promises.push(strapi.query("daily-dedication").find({ _limit: -1 }));
    promises.push(strapi.query("festive").find({ _limit: -1 }));

    const results = await Promise.all(promises);

    let projects = results[0];
    const dailyDedications = results[1];
    const festives = results[2];

    const totals = [];
    for await (const p of projects) {
      const { totalsByDay } = await calculateEstimatedTotals(
        { id: p.id, name: p.name },
        p.project_original_phases,
        dailyDedications,
        festives
      );
      totals.push(
        ...totalsByDay.map((t) => ({ ...t, day: t.day.format("YYYY-MM-DD") }))
      );
    }
    // for await (const event of eventsAdded) {
    if (year) {
      return totals.filter((r) => r.day.substring(0, 4) === year);
    }
    return totals;
  },

  async findChildren(ctx) {
    const { id, expense } = ctx.params;
    const { mother } = await strapi.query("project").findOne({ id });
    if (mother && mother.id == id) {
      const childrenAll = await strapi
        .query("project")
        .find({ mother: id, _limit: -1 });
      const children = childrenAll.filter((c) => c.id != mother.id);

      const flattenMap = (arrays, prop) =>
        _.flatten(arrays.map((a) => a[prop]));

      const totals = {
        total_estimated_hours: _.sumBy(children, "total_estimated_hours"),
        total_real_hours: _.sumBy(children, "total_real_hours"),
        total_expenses: _.sumBy(children, "total_expenses"),
        total_incomes: _.sumBy(children, "total_incomes"),
        total_expenses_hours: _.sumBy(children, "total_expenses_hours"),
        balance: _.sumBy(children, "balance"),
        total_estimated_expenses: _.sumBy(children, "total_estimated_expenses"),
        estimated_balance: _.sumBy(children, "estimated_balance"),
        incomes_expenses: _.sumBy(children, "incomes_expenses"),
        dedicated_hours: _.sumBy(children, "dedicated_hours"),
        invoice_hours: _.sumBy(children, "invoice_hours"),
        invoice_hours_price: _.sumBy(children, "invoice_hours_price"),
        total_dedicated_hours: _.sumBy(children, "total_dedicated_hours"),
        total_real_incomes: _.sumBy(children, "total_real_incomes"),
        total_real_expenses: _.sumBy(children, "total_real_expenses"),
        total_real_incomes_expenses: _.sumBy(
          children,
          "total_real_incomes_expenses"
        ),
        structural_expenses: _.sumBy(children, "structural_expenses"),
        total_estimated_hours_price: _.sumBy(
          children,
          "total_estimated_hours_price"
        ),
        total_real_hours_price: _.sumBy(children, "total_real_hours_price"),
        total_real_expenses: _.sumBy(children, "total_real_expenses"),
        grantable_amount: _.sumBy(children, "grantable_amount"),
        grantable_amount_total: _.sumBy(children, "grantable_amount_total"),
        // phases: flattenMap(children, 'phases'),
        // original_phases: flattenMap(children, 'original_phases'),
        // emitted_invoices: flattenMap(children, 'emitted_invoices'),
        // received_grants: flattenMap(children, 'received_grants'),
        // received_invoices: flattenMap(children, 'received_invoices'),
        // tickets: flattenMap(children, 'tickets'),
        // diets: flattenMap(children, 'diets'),
        // received_incomes: flattenMap(children, 'received_incomes'),
        // received_expenses: flattenMap(children, 'received_expenses'),
      };

      return { children, totals };
    } else {
      return {};
    }
  },

  // async updatePhases(ctx) {
  //   const projects = await strapi.query("project").find({ _limit: -1 });

  //   for (let i = 0; i < projects.length; i++) {
  //     const project = projects[i];
  //     if (
  //       project.phases &&
  //       project.phases.length &&
  //       (!project.original_phases || !project.original_phases.length)
  //     ) {
  //       const projectToUpdate = { id: project.id };
  //       projectToUpdate.original_phases = project.phases;
  //       projectToUpdate.original_phases.forEach((p) => {
  //         delete p.id;
  //         p.incomes.forEach((sp) => {
  //           delete sp.id;
  //         });
  //         p.expenses.forEach((sp) => {
  //           delete sp.id;
  //         });
  //       });
  //       await strapi
  //         .query("project")
  //         .update({ id: project.id }, projectToUpdate);
  //     }
  //   }
  //   return { done: true };
  // },

  payExpense: async (ctx) => {
    // const { id, expense } = ctx.params;
    // const project = await strapi.query("project").findOne({ id });
    // var found = false;
    // if (project && project.id) {
    //   project.project_phases.forEach((ph) => {
    //     const expenseItem = ph.expenses.find((e) => e.id == expense);
    //     if (expenseItem) {
    //       found = true;
    //       expenseItem.paid = true;
    //       if (ctx.request.body.received && ctx.request.body.received.id) {
    //         expenseItem.invoice = ctx.request.body.received.id;
    //       }
    //       if (ctx.request.body.ticket && ctx.request.body.ticket.id) {
    //         expenseItem.ticket = ctx.request.body.ticket.id;
    //       }
    //       if (ctx.request.body.diet && ctx.request.body.diet.id) {
    //         expenseItem.diet = ctx.request.body.diet.id;
    //       }
    //       if (ctx.request.body.expense && ctx.request.body.expense.id) {
    //         expenseItem.expense = ctx.request.body.expense.id;
    //       }
    //     }
    //   });
    //   if (found) {
    //     const projectToUpdate = { phases: project.phases };
    //     await strapi.query("project").update({ id: id }, projectToUpdate);
    //   }
    // }
    // return { id, expense, found };
  },
  payIncome: async (ctx) => {
    // const { id, income } = ctx.params;
    // const project = await strapi.query("project").findOne({ id });
    // var found = false;
    // if (project && project.id) {
    //   project.phases.forEach((ph) => {
    //     const incomeItem = ph.incomes.find((e) => e.id == income);
    //     if (incomeItem) {
    //       found = true;
    //       incomeItem.paid = true;
    //       if (ctx.request.body.emitted && ctx.request.body.emitted.id) {
    //         incomeItem.emitted = ctx.request.body.emitted.id;
    //       }
    //       if (ctx.request.body.grant && ctx.request.body.grant.id) {
    //         incomeItem.grant = ctx.request.body.grant.id;
    //       }
    //       if (ctx.request.body.income && ctx.request.body.income.id) {
    //         incomeItem.income = ctx.request.body.income.id;
    //       }
    //     }
    //   });
    //   if (found) {
    //     const projectToUpdate = { phases: project.phases };
    //     await strapi.query("project").update({ id: id }, projectToUpdate);
    //   }
    // }
    // return { id, income, found };
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    // const data = await strapi.query("project").findOne({ id });
    const data = await strapi
      .query("project")
      .findOne({ id: id }, [
        "leader",
        "project_scope",
        "project_state",
        "clients",
        "default_dedication_type",
        "mother",
        "region",
        "documents",
        "strategies",
        "intercooperations",
        "emmited_invoices",
        "received_invoices",
        "activity_types",
        "received_incomes",
        "received_expenses",
        "global_activity_types",
        "treasury_annotations",
        "global_activity_types",
        "project_phases",
        "project_original_phases",
      ]);

    return data;
  },
  async findOneExtended(ctx) {
    const { id } = ctx.params;
    // const data = await strapi.query("project").findOne({ id });
    const data = await strapi
      .query("project")
      .findOne({ id: id }, [
        "leader",
        "project_scope",
        "project_state",
        "clients",
        "default_dedication_type",
        "mother",
        "region",
        "documents",
        "strategies",
        "intercooperations",
        "emmited_invoices",
        "received_invoices",
        "activity_types",
        "received_incomes",
        "received_expenses",
        "global_activity_types",
        "treasury_annotations",
        "global_activity_types",
        "project_phases",
        "project_phases.incomes",
        "project_phases.incomes.estimated_hours",
        "project_phases.incomes.income_type",
        "project_phases.incomes.estimated_hours.users_permissions_user",
        "project_phases.incomes.invoice",
        "project_phases.incomes.income",
        "project_phases.expenses",
        "project_phases.expenses.expense_type",
        "project_phases.expenses.invoice",
        "project_phases.expenses.expense",
        "project_original_phases",
        "project_original_phases.incomes",
        "project_original_phases.incomes.estimated_hours",
        "project_original_phases.incomes.income_type",
        "project_original_phases.incomes.estimated_hours.users_permissions_user",
        "project_original_phases.incomes.invoice",
        "project_original_phases.incomes.income",
        "project_original_phases.expenses",
        "project_original_phases.expenses.expense_type",
        "project_original_phases.expenses.invoice",
        "project_original_phases.expenses.expense",
      ]);

    return data;
  },
  // doCalculateProjectInfo: async (ctx) => {
  //   const { id } = ctx.params;
  //   var start = new Date();
  //   const data = await strapi.query("project").findOne({ id });
  //   var end = new Date() - start;

  //   const result = await doProjectInfoCalculations(data, id);
  //   var end = new Date() - start;

  //   return result;
  // },

  // getProjectIsDirty: async (ctx) => {
  //   const { id } = ctx.params;
  //   const projects = await strapi
  //     .query("project")
  //     .model.query((qb) => {
  //       qb.select("id", "dirty").where({ id: id });
  //     })
  //     .fetchAll();

  //   const p = projects.map((entity) =>
  //     sanitizeEntity(entity, { model: strapi.models.project })
  //   );

  //   return { id: id, dirty: p[0].dirty };
  // },

  setDirty: async (id) => {
    // console.log("setDirty", id);
    if (parseInt(id) > 0) {
      //await updateProjectInfo(id, false);

      await strapi
        .query("dirty-queue")
        .create({ entityId: id, entity: "project" });
    }
  },

  // enqueueProjects: async (projects) => {
  //   //projectsQueue.push(projects);
  // },

  // updateQueuedProjects: async () => {
  //   const projects = projectsQueue.pop();
  //   if (projects && projects.current) {
  //     await updateProjectInfo(projects.current, true);
  //   }
  //   if (
  //     projects &&
  //     projects.previous &&
  //     projects.current !== projects.previous
  //   ) {
  //     await updateProjectInfo(projects.previous, true);
  //   }
  // },

  updatePhases: async (
    id,
    entity,
    phases,
    deletedPhases,
    deletedIncomes,
    deletedExpenses,
    deletedHours
  ) => {
    for await (const income of deletedIncomes.filter((i) => i)) {
      await strapi.query("phase-income").delete({ id: income });
    }
    for await (const expense of deletedExpenses.filter((i) => i)) {
      await strapi.query("phase-expense").delete({ id: expense });
    }
    for await (const hour of deletedHours.filter((i) => i)) {
      await strapi.query("estimated-hours").delete({ id: hour });
    }
    for await (const phase of deletedPhases.filter((i) => i)) {
      if (entity === "project-original-phases") {
        const incomesOfPhase = await strapi
          .query("phase-income")
          .find({ project_original_phase: phase, _limit: -1 });
        for await (const income of incomesOfPhase) {
          await strapi.query("phase-income").delete({ id: income.id });
        }
        const expensesOfPhase = await strapi
          .query("phase-expense")
          .find({ project_original_phase: phase, _limit: -1 });

        for await (const expense of expensesOfPhase) {
          await strapi.query("phase-expense").delete({ id: expense.id });
        }
        await strapi.query(entity).delete({ id: phase });
      } else {
        const incomesOfPhase = await strapi
          .query("phase-income")
          .find({ project_phase: phase, _limit: -1 });
        for await (const income of incomesOfPhase) {
          await strapi.query("phase-income").delete({ id: income.id });
        }
        const expensesOfPhase = await strapi
          .query("phase-expense")
          .find({ project_phase: phase, _limit: -1 });
        for await (const expense of expensesOfPhase) {
          await strapi.query("phase-expense").delete({ id: expense.id });
        }
        await strapi.query(entity).delete({ id: phase });
      }
    }

    for await (const phase of phases) {
      const { incomes, expenses, ...item } = phase;
      if (!phase.id) {
        const resp = await strapi.query(entity).create({ project: id, name: item.name });
        phase.id = resp.id;
      } else if (phase.dirty) {
        await strapi
          .query(entity)
          .update({ id: phase.id }, { project: id, name: item.name });
      }

      if (incomes) {
        for await (const income of incomes) {
          income.total_amount = income.quantity * income.amount;
          if (!income.id) {
            const { estimated_hours, ...item } = income;
            if (entity === "project-original-phases") {
              
              const newIncome = await strapi.query("phase-income").create({
                ...item,
                project_original_phase: phase.id,
              });
              income.id = newIncome.id;
            } else {
              const newIncome = await strapi.query("phase-income").create({
                ...item,
                project_phase: phase.id,
              });
              income.id = newIncome.id;
            }
          } else if (income.dirty) {
            const { estimated_hours, ...item } = income;
            await strapi.query("phase-income").update({ id: income.id }, item);
          }

          if (entity === "project-original-phases") {
            if (income.estimated_hours) {
              for await (const estimated_hours of income.estimated_hours) {
                if (!estimated_hours.id) {
                  await strapi.query("estimated-hours").create({
                    ...estimated_hours,
                    phase_income: income.id,
                  });
                } else if (estimated_hours.dirty) {
                  await strapi
                    .query("estimated-hours")
                    .update({ id: estimated_hours.id }, estimated_hours);
                }
              }
            }
          }
        }
      }

      if (expenses) {
        for await (const expense of expenses) {
          expense.total_amount = expense.quantity * expense.amount;
          if (!expense.id) {
            if (entity === "project-original-phases") {              
              await strapi.query("phase-expense").create({
                ...expense,
                project_original_phase: phase.id,
              });
            } else {
              await strapi.query("phase-expense").create({
                ...expense,
                project_phase: phase.id,
              });
            }
          } else if (expense.dirty) {
            await strapi
              .query("phase-expense")
              .update({ id: expense.id }, expense);
          }
        }
      }
    }
    console.log("phases updated!!");
  },
  createPhasesForAllProjects: async (ctx) => {
    return;

    const phases0 = await strapi
      .query("project-original-phases")
      .find({ _limit: 1 });

    if (phases0.length > 0) {
      console.log("phases already created!");
      return;
    }

    await strapi.query("estimated-hours").delete({ _limit: -1 });
    console.log("deleted estimated-hours");
    await strapi.query("phase-income").delete({ _limit: -1 });
    console.log("deleted phase-income");
    await strapi.query("phase-expense").delete({ _limit: -1 });
    console.log("deleted phase-expense");
    await strapi.query("project-phases").delete({ _limit: -1 });
    console.log("deleted project-phases");
    await strapi.query("project-original-phases").delete({ _limit: -1 });
    console.log("deleted project-original-phases");
    console.log("deleted all!!!");

    const projects = await strapi.query("project").find({ _limit: -1 });

    for await (const p of projects) {
      // copy p.phases to project-phase
      console.log("project", p.name);
      for await (const ph of p.phases) {
        console.log("phase", ph.name);
        const phase = await strapi.query("project-phases").create({
          name: ph.name,
          project: p.id,
        });
        for await (const income of ph.incomes) {
          if (!income || !income.id) continue;
          console.log("income", income.concept);
          const data = {
            concept: income.concept,
            quantity: income.quantity,
            amount: income.amount,
            total_amount: income.total_amount,
            date: income.date ? income.date.substring(0, 10) : null,
            paid: income.paid,
            client: income.client && income.client.id ? income.client.id : null,
            invoice:
              income.invoice && income.invoice.id ? income.invoice.id : null,
            total_estimated_hours: income.total_estimated_hours,
            income_type: income.income_type,
            income: income.income && income.income.id ? income.income.id : null,
            date_estimated_document: income.date_estimated_document
              ? income.date_estimated_document.substring(0, 10)
              : null,
            project_phase: phase.id,
          };
          const newIncome = await strapi.query("phase-income").create(data);
        }
        for await (const expense of ph.expenses) {
          if (!expense || !expense.id) continue;
          console.log("expense", expense.concept);
          const data = {
            concept: expense.concept,
            quantity: expense.quantity,
            amount: expense.amount,
            total_amount: expense.total_amount,
            date: expense.date ? expense.date.substring(0, 10) : null,
            paid: expense.paid,
            provider:
              expense.provider && expense.provider.id
                ? expense.provider.id
                : null,
            invoice:
              expense.invoice && expense.invoice.id ? expense.invoice.id : null,
            total_estimated_hours: expense.total_estimated_hours,
            expense_type: expense.expense_type,
            expense:
              expense.expense && expense.expense.id ? expense.expense.id : null,
            date_estimated_document: expense.date_estimated_document
              ? expense.date_estimated_document.substring(0, 10)
              : null,
            project_phase: phase.id,
          };
          const newExpense = await strapi.query("phase-expense").create(data);
        }
      }
      // copy p.original-phases to project-original-phase
      for await (const ph of p.original_phases) {
        console.log("original-phase", ph.name);
        const phase = await strapi.query("project-original-phases").create({
          name: ph.name,
          project: p.id,
        });
        for await (const income of ph.incomes) {
          console.log("income", income.concept);
          if (!income || !income.id) continue;
          const data = {
            concept: income.concept,
            quantity: income.quantity,
            amount: income.amount,
            total_amount: income.total_amount,
            date: income.date ? income.date.substring(0, 10) : null,
            // paid: income.paid,
            //client: income.client,
            //invoice: income.invoice,
            total_estimated_hours: income.total_estimated_hours,
            income_type: income.income_type,
            //income: income.income,
            date_estimated_document: income.date_estimated_document
              ? income.date_estimated_document.substring(0, 10)
              : null,
            project_original_phase: phase.id,
          };
          const newIncome = await strapi.query("phase-income").create(data);

          for await (const estimated_hours of income.estimated_hours) {
            console.log("estimated_hours", estimated_hours.hours);
            const data = {
              users_permissions_user: estimated_hours.users_permissions_user,
              quantity: estimated_hours.quantity,
              amount: estimated_hours.amount,
              total_amount: estimated_hours.total_amount,
              comment: estimated_hours.comment,
              from: estimated_hours.from,
              to: estimated_hours.to,
              monthly_quantity: estimated_hours.monthly_quantity,
              quantity_type: estimated_hours.quantity_type,
              phase_income: newIncome.id,
            };
            const newEstimatedHours = await strapi
              .query("estimated-hours")
              .create(data);
          }
        }
        for await (const expense of ph.expenses) {
          if (!expense || !expense.id) continue;
          console.log("expense", expense.concept);
          const data = {
            concept: expense.concept,
            quantity: expense.quantity,
            amount: expense.amount,
            total_amount: expense.total_amount,
            date: expense.date ? expense.date.substring(0, 10) : null,
            // paid: expense.paid,
            //provider: expense.provider,
            //invoice: expense.invoice,
            total_estimated_hours: expense.total_estimated_hours,
            expense_type: expense.expense_type,
            //expense: expense.expense,
            date_estimated_document: expense.date_estimated_document
              ? expense.date_estimated_document.substring(0, 10)
              : null,
            project_original_phase: phase.id,
          };
          const newExpense = await strapi.query("phase-expense").create(data);
        }
      }
    }
  },
};
