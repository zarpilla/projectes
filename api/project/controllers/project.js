"use strict";
const { sanitizeEntity } = require("strapi-utils");
const _ = require("lodash");
const moment = require("moment");

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const doProjectInfoCalculations = async (data, id) => {
  if (!id || !data) {
    return;
  }

  data.total_incomes = 0;
  data.total_expenses = 0;
  data.total_expenses_hours = 0;
  data.total_estimated_hours = 0;
  data.estimated_balance = 0;
  data.total_estimated_expenses = 0;

  if (data.expenses && data.expenses.length) {
    let total_expenses = 0;
    data.expenses.forEach((i) => {
      i.total_amount =
        (i.quantity ? i.quantity : 0) * (i.amount ? i.amount : 0);
      i.tax_amount = (i.total_amount * (i.tax_pct ? i.tax_pct : 0)) / 100.0;
      i.total_amount = i.total_amount + i.tax_amount;
      total_expenses += i.total_amount;
    });
    data.total_expenses = total_expenses;
  }

  if (data.incomes && data.incomes.length) {
    let total_incomes = 0;
    data.incomes.forEach((i) => {
      i.total_amount =
        (i.quantity ? i.quantity : 0) * (i.amount ? i.amount : 0);
      total_incomes += i.total_amount;
    });
    data.total_incomes = total_incomes;
  }

  if (data.phases && data.phases.length) {
    const dailyDedications = await strapi
      .query("daily-dedication")
      .find({ _limit: -1 });
    const festives = await strapi.query("festive").find({ _limit: -1 });
    const infoPhases = await calculateEstimatedTotals(
      data,
      data.phases,
      dailyDedications,
      festives
    );
    data = infoPhases.data;
    data.total_expenses = infoPhases.total_expenses;
    data.total_incomes = infoPhases.total_incomes;
    data.total_estimated_hours = infoPhases.total_estimated_hours;
    data.total_estimated_hours_price = infoPhases.total_estimated_hours_price;
    // not assigned invoices
    data.total_real_incomes = infoPhases.total_real_incomes;
    data.total_real_expenses = infoPhases.total_real_expenses;

    if (data.original_phases && data.original_phases.length) {
      const infoOriginalPhases = await calculateEstimatedTotals(
        data,
        data.original_phases,
        dailyDedications,
        festives
      );
      data = infoOriginalPhases.data;
      data.total_expenses = infoOriginalPhases.total_expenses;
      data.total_incomes = infoOriginalPhases.total_incomes;
      data.total_estimated_hours = infoOriginalPhases.total_estimated_hours;
      data.total_estimated_hours_price =
        infoOriginalPhases.total_estimated_hours_price;
    }
  } else {
    data.total_expenses = 0;
    data.total_incomes = 0;
    data.total_estimated_hours = 0;
    data.total_estimated_hours_price = 0;
    data.total_real_incomes = 0;
    data.total_real_expenses = 0;
  }

  const promises = [];

  promises.push(strapi.query("activity").find({ project: id, _limit: -1 }));

  const results = await Promise.all(promises);

  const activities = results[0];
  data.total_real_hours = _.sumBy(activities, "hours");
  const activities_price = activities.map((a) => {
    return { cost: a.hours * a.cost_by_hour };
  });
  data.total_real_hours_price = _.sumBy(activities_price, "cost");
  data.total_real_incomes_expenses =
    data.total_real_incomes -
    data.total_real_expenses -
    data.total_real_hours_price;

  if (data.structural_expenses_pct) {
    data.total_expenses =
      data.total_expenses +
      (data.structural_expenses_pct / 100) * data.total_incomes;
    data.incomes_expenses =
      data.total_incomes - data.total_expenses - data.total_estimated_expenses;
    data.total_real_expenses =
      data.total_real_expenses +
      (data.structural_expenses_pct / 100) * data.total_real_incomes;
    data.total_real_incomes_expenses =
      data.total_real_incomes -
      data.total_real_expenses -
      data.total_real_hours_price;
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
    data.total_real_hours_price;

  data.balance =
    data.total_incomes - data.total_expenses - data.total_expenses_hours;
  data.estimated_balance =
    data.total_incomes - data.total_expenses - data.total_estimated_expenses;
  data.incomes_expenses =
    data.total_incomes - data.total_expenses - data.total_estimated_hours_price;

  if (!data.leader || !data.leader.id) {
    delete data.leader;
  }
  return data;
};

const calculateEstimatedTotals = async (
  data,
  phases,
  dailyDedications,
  festives
) => {
  var total_estimated_hours = 0;
  var total_incomes = 0;
  var total_estimated_hours_price = 0;
  let total_expenses = 0;

  let total_real_incomes = 0;
  let total_real_expenses = 0;

  const totalsByDay = [];

  if (phases && phases.length) {
    for (var i = 0; i < phases.length; i++) {
      const phase = phases[i];
      if (phase.subphases && phase.subphases.length) {
        for (var j = 0; j < phase.subphases.length; j++) {
          const subphase = phase.subphases[j];
          var subphase_estimated_hours = 0;

          subphase.total_amount =
            (subphase.quantity ? subphase.quantity : 0) *
            (subphase.amount ? subphase.amount : 0);
          total_incomes +=
            (subphase.quantity ? subphase.quantity : 0) *
            (subphase.amount ? subphase.amount : 0);

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

                      totalsByDay.push({ day, q, costByHour });
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

                      totalsByDay.push({ day, q, costByHour });
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
                    });
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
          if (expense.paid) {
            total_real_expenses +=
              (expense.quantity ? expense.quantity : 0) *
              (expense.amount ? expense.amount : 0);
          }
        }
      }
    }
  }

  return {
    data,
    total_expenses,
    total_incomes,
    total_estimated_hours,
    total_estimated_hours_price,
    total_real_incomes,
    total_real_expenses,
    totalsByDay,
  };
};

let projectsQueue = [];

const updateProjectInfo = async (id) => {
  const data = await strapi.query("project").findOne({ id });
  const info = await doProjectInfoCalculations(data, id);

  info._internal = true;
  await strapi.query("project").update({ id: id }, info);
  return { id };
};

module.exports = {
  async updateDirtyProjects(ctx) {
    const projects = await strapi
      .query("project")
      .find({ dirty: true, _limit: -1 });
    console.log("updateDirtyProjects", projects.length);
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const data = await doProjectInfoCalculations(project, project.id);
      data._internal = true;
      data.dirty = false;
      await strapi.query("project").update({ id: project.id }, data);
    }
    console.log("updateDirtyProjects end");
    return true;
  },
  async findWithBasicInfo(ctx) {
    // Calling the default core action
    let projects;

    // only published
    ctx.query.published_at_null = false;
    if (ctx.query._q) {
      projects = await strapi.query("project").search(ctx.query);
    } else {
      projects = await strapi.query("project").find(ctx.query);
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

  async findWithPhases(ctx) {
    // Calling the default core action
    let projects;
    const { published_at_null, _limit, ...where } = ctx.query;

    if (ctx.query._q) {
      projects = await strapi
        .query("project")
        .model.fetchAll({ withRelated: ["original_phases"] });
    } else {
      projects = await strapi
        .query("project")
        .model.query((qb) => {
          qb.select("id", "name", "published_at").where(where._where || {});
        })
        .fetchAll({ withRelated: ["original_phases"] });
    }

    return projects
      .map((entity) => sanitizeEntity(entity, { model: strapi.models.project }))
      .filter((p) => p.published_at !== "");
  },

  async findWithEconomicDetail(ctx) {
    // Calling the default core action

    // only published
    // ctx.query.published_at_null = false;

    const { query, year, paid, document } = ctx.query;
    // ctx.query = { _limit: -1 }

    const promises = [];
    if (ctx.query._q) {
      promises.push(strapi.query("project").search(ctx.query));
    } else {
      promises.push(strapi.query("project").find({ _limit: -1 }));
    }

    promises.push(strapi.query("activity").find({ _limit: -1 }));
    promises.push(strapi.query("daily-dedication").find({ _limit: -1 }));
    promises.push(strapi.query("festive").find({ _limit: -1 }));

    const results = await Promise.all(promises);
    let projects = results[0];
    const activities = results[1];
    const dailyDedications = results[2];
    const festives = results[3];

    projects = projects.filter((p) => p.published_at !== null);
    if (ctx.query && ctx.query._where && ctx.query._where.project_state_eq) {
      projects = projects.filter(
        (p) =>
          p.project_state &&
          p.project_state.id == ctx.query._where.project_state_eq
      );
    }

    var response = [];

    const activitiesPYM = activities
      .filter((a) => a.date && a.project && a.project.id)
      .map((a) => {
        return {
          ...a,
          pym: `${a.project.id}.${moment(a.date, "YYYY-MM-DD").year()}.${moment(
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
        };
      });

    // console.log('activities', activities.length)
    // console.log('grouped', grouped)

    // const activities = await strapi.query("activity").find({ _limit: -1 });

    projects.forEach(async (p) => {
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
      };

      p.phases.forEach((ph) => {
        ph.subphases.forEach((sph) => {
          if (sph.quantity && sph.amount) {
            const document = sph.income || sph.invoice;
            const date =
              sph.paid && document
                ? document.emitted
                : sph.date_estimate_document;
            response.push({
              ...projectInfo,
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
        });
        ph.expenses.forEach((sph) => {
          if (sph.quantity && sph.amount) {
            const document = sph.expense || sph.invoice;
            const date =
              sph.paid && document
                ? document.emitted
                : sph.date_estimate_document;
            response.push({
              ...projectInfo,
              type: "expense",
              paid: sph.paid,
              expense_esti: 0,
              expense_real: sph.paid ? -1 * sph.quantity * sph.amount : 0,
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
        });
      });

      p.original_phases.forEach((ph) => {
        ph.subphases.forEach((sph) => {
          // if (sph && sph.estimated_hours && sph.estimated_hours.length) {
          //   console.log('sph', sph.estimated_hours)
          // }

          if (sph.quantity && sph.amount) {
            const document = sph.income || sph.invoice;
            const date = sph.date_estimate_document || sph.date;
            response.push({
              ...projectInfo,
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
        });
        ph.expenses.forEach((sph) => {
          if (sph.quantity && sph.amount) {
            const document = sph.expense || sph.invoice;
            const date = sph.date_estimate_document || sph.date;
            response.push({
              ...projectInfo,
              type: "expense",
              // paid: sph.paid,
              expense_esti: -1 * Math.abs(sph.quantity * sph.amount),
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
        });
      });

      const projectActivities = groupedActivities.filter(
        (a) => a.projectId === projectInfo.id
      );

      projectActivities.forEach((pa) => {
        response.push({
          ...projectInfo,
          type: "real_hours",
          date: "",
          total_estimated_hours_price: 0,
          total_real_hours_price: -1 * (pa.cost || 0),
          year: pa.year,
          month: pa.month,
          row_type: "",
          document: "0",
        });
      });

      const { totalsByDay } = await calculateEstimatedTotals(
        {},
        p.original_phases,
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
          };
        });

      groupedTotalsByDay.forEach((g) => {
        response.push({
          ...projectInfo,
          type: "estimated_hours",
          date: "",
          total_estimated_hours_price: -1 * (g.cost || 0),
          total_real_hours_price: 0,
          year: g.year,
          month: g.month,
          row_type: "",
          document: "0",
        });
      });
    });

    if (year) {
      response = response.filter((r) => r.year === year);
    }
    if (paid != null) {
      response = response.filter((r) => r.paid === (paid === "true"));
    }
    // if (document === 'null') {
    //   response = response.filter(r => r.document === null)
    // }

    // Removing some info
    // const newArray = projects.map(({ phases, activities, emitted_invoices, received_invoices, tickets, diets, emitted_grants, received_grants, quotes, original_phases, incomes, expenses, strategies, estimated_hours, intercooperations, clients, received_expenses, received_incomes, ...item }) => item)
    return response; // projects.map(entity => sanitizeEntity(entity, { model: strapi.models.project }));
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

  async updatePhases(ctx) {
    const projects = await strapi.query("project").find({ _limit: -1 });

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      if (
        project.phases &&
        project.phases.length &&
        (!project.original_phases || !project.original_phases.length)
      ) {
        const projectToUpdate = { id: project.id };
        projectToUpdate.original_phases = project.phases;
        projectToUpdate.original_phases.forEach((p) => {
          delete p.id;
          p.subphases.forEach((sp) => {
            delete sp.id;
          });
          p.expenses.forEach((sp) => {
            delete sp.id;
          });
        });
        await strapi
          .query("project")
          .update({ id: project.id }, projectToUpdate);
      }
    }
    return { done: true };
  },

  payExpense: async (ctx) => {
    const { id, expense } = ctx.params;
    const project = await strapi.query("project").findOne({ id });
    var found = false;
    if (project && project.id) {
      project.phases.forEach((ph) => {
        const expenseItem = ph.expenses.find((e) => e.id == expense);
        if (expenseItem) {
          found = true;
          expenseItem.paid = true;
          if (ctx.request.body.received && ctx.request.body.received.id) {
            expenseItem.invoice = ctx.request.body.received.id;
          }
          if (ctx.request.body.ticket && ctx.request.body.ticket.id) {
            expenseItem.ticket = ctx.request.body.ticket.id;
          }
          if (ctx.request.body.diet && ctx.request.body.diet.id) {
            expenseItem.diet = ctx.request.body.diet.id;
          }
          if (ctx.request.body.expense && ctx.request.body.expense.id) {
            expenseItem.expense = ctx.request.body.expense.id;
          }
        }
      });
      if (found) {
        const projectToUpdate = { phases: project.phases };
        await strapi.query("project").update({ id: id }, projectToUpdate);
      }
    }
    return { id, expense, found };
  },
  payIncome: async (ctx) => {
    const { id, income } = ctx.params;
    const project = await strapi.query("project").findOne({ id });
    var found = false;
    if (project && project.id) {
      project.phases.forEach((ph) => {
        const incomeItem = ph.subphases.find((e) => e.id == income);
        if (incomeItem) {
          found = true;
          incomeItem.paid = true;
          if (ctx.request.body.emitted && ctx.request.body.emitted.id) {
            incomeItem.emitted = ctx.request.body.emitted.id;
          }
          if (ctx.request.body.grant && ctx.request.body.grant.id) {
            incomeItem.grant = ctx.request.body.grant.id;
          }
          if (ctx.request.body.income && ctx.request.body.income.id) {
            incomeItem.income = ctx.request.body.income.id;
          }
        }
      });
      if (found) {
        const projectToUpdate = { phases: project.phases };
        await strapi.query("project").update({ id: id }, projectToUpdate);
      }
    }
    return { id, income, found };
  },

  calculateProjectInfo: async (data, id) => {
    return await doProjectInfoCalculations(data, id);
  },

  doCalculateProjectInfo: async (ctx) => {
    const { id } = ctx.params;
    const data = await strapi.query("project").findOne({ id });
    const result = await doProjectInfoCalculations(data, id);
    return result;
  },

  getProjectIsDirty: async (ctx) => {
    const { id } = ctx.params;
    const projects = await strapi
      .query("project")
      .model.query((qb) => {
        qb.select("id", "dirty").where({ id: id });
      })
      .fetchAll();

      const p = projects.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models.project })
    )

    return { id: id, dirty: p[0].dirty }
  },

  setDirty: async (id) => {
    console.log("setDirty", id);
    if (parseInt(id) > 0) {
      await strapi.query("project").update({ id: id }, { dirty: true });
    }
  },
};
