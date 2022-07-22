"use strict";
const { sanitizeEntity } = require("strapi-utils");
const _ = require("lodash");
const moment = require("moment");

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

let doProjectInfoCalculations = async (data, id) => {
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
    const infoPhases = await calculateEstimatedTotals(data, data.phases);
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
        data.original_phases
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
  // promises.push(strapi.query('emitted-invoice').find({ project: id, _limit: -1 }))
  // promises.push(strapi.query('received-grant').find({ project: id, _limit: -1 }))
  // promises.push(strapi.query('received-invoice').find({ project: id, _limit: -1 }))
  // promises.push(strapi.query('ticket').find({ project: id, _limit: -1 }))
  // promises.push(strapi.query('diet').find({ project: id, _limit: -1 }))
  // promises.push(strapi.query('emitted-grant').find({ project: id, _limit: -1 }))
  // promises.push(strapi.query('received-income').find({ project: id, _limit: -1 }))
  // promises.push(strapi.query('received-expense').find({ project: id, _limit: -1 }))

  const results = await Promise.all(promises);

  const activities = results[0];
  // const emittedInvoices = results[1];
  // const receivedGrants = results[2];
  // const receivedInvoices = results[3];
  // const tickets = results[4];
  // const diets = results[5];
  // const emittedGrants = results[6];
  // const receivedIncomes = results[7];
  // const receivedExpenses = results[8];

  data.total_real_hours = _.sumBy(activities, "hours");
  // data.total_real_incomes += _.sumBy(emittedInvoices, 'total_base') + _.sumBy(receivedGrants, 'total') + _.sumBy(receivedIncomes, 'total')
  // data.total_real_expenses += _.sumBy(receivedInvoices, 'total_base') + _.sumBy(tickets, 'total') + _.sumBy(diets, 'total') + _.sumBy(emittedGrants, 'total') + _.sumBy(receivedExpenses, 'total')
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

let calculateEstimatedTotals = async (data, phases) => {
  var total_estimated_hours = 0;
  var total_incomes = 0;
  var total_estimated_hours_price = 0;
  let total_expenses = 0;

  let total_real_incomes = 0;
  let total_real_expenses = 0;

  if (phases && phases.length) {
    for (var i = 0; i < phases.length; i++) {
      const phase = phases[i];
      if (phase.subphases && phase.subphases.length) {
        for (var j = 0; j < phase.subphases.length; j++) {
          const subphase = phase.subphases[j];
          var subphase_estimated_hours = 0;
          if (subphase.quantity && subphase.amount) {
            subphase.total_amount = subphase.quantity * subphase.amount;
            total_incomes += subphase.quantity * subphase.amount;
          }
          if (subphase.estimated_hours) {
            for (var k = 0; k < subphase.estimated_hours.length; k++) {
              const hours = subphase.estimated_hours[k];
              if (hours.from && hours.to) {
                let mdiff = 1
                if (hours.quantity_type && hours.quantity_type === 'month') {
                  const diff = moment.duration(moment(hours.to, 'YYYY-MM-DD').diff(moment(hours.from, 'YYYY-MM-DD')))
                  mdiff = Math.round(diff.asMonths())
                }
                if (hours.quantity_type && hours.quantity_type === 'week') {
                  const diff = moment.duration(moment(hours.to, 'YYYY-MM-DD').diff(moment(hours.from, 'YYYY-MM-DD')))
                  mdiff = Math.round(diff.asWeeks())
                }
                subphase_estimated_hours += hours.quantity * mdiff;
                total_estimated_hours += hours.quantity * mdiff;
                if (hours.quantity && hours.amount) {
                  hours.total_amount = hours.quantity * mdiff * hours.amount;
                  total_estimated_hours_price += hours.total_amount;
                }
              }
            }
            subphase.total_estimated_hours = subphase_estimated_hours;
          }
          if (subphase.quantity && subphase.amount && subphase.paid) {
            total_real_incomes += subphase.quantity * subphase.amount;
          }
        }
      }
      if (phase.expenses && phase.expenses.length) {
        for (var j = 0; j < phase.expenses.length; j++) {
          const expense = phase.expenses[j];
          if (expense.quantity && expense.amount) {
            expense.total_amount = expense.quantity * expense.amount;
            total_expenses += expense.quantity * expense.amount;
          }
          if (expense.quantity && expense.amount && expense.paid) {
            total_real_expenses += expense.quantity * expense.amount;
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
  };
};

let projectsQueue = [];

let updateProjectInfo = async (id) => {
  const data = await strapi.query("project").findOne({ id });
  const info = await doProjectInfoCalculations(data, id);

  info._internal = true;
  await strapi.query("project").update({ id: id }, info);
  return { id };
};

module.exports = {
  async findWithBasicInfo(ctx) {
    // Calling the default core action
    let projects;

    // only published
    ctx.query.published_at_null = false;
    if (ctx.query._q) {
      projects = await await strapi.query("project").search(ctx.query);
    } else {
      projects = await await strapi.query("project").find(ctx.query);
    }

    // Removing some info
    const newArray = projects.map(
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
        clients,
        received_expenses,
        received_incomes,
        ...item
      }) => item
    );
    return newArray.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models.project })
    );
  },

  async findWithEconomicDetail(ctx) {
    // Calling the default core action
    let projects;

    // only published
    ctx.query.published_at_null = false;

    const { query, year, paid, document } = ctx.query
    ctx.query = { ...query, _limit: -1 }

    if (ctx.query._q) {
      projects = await strapi.query("project").search(ctx.query);
    } else {
      projects = await strapi.query("project").find(ctx.query);
    }

    var response = [];

    projects.forEach((p) => {
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
            response.push({
              ...projectInfo,
              type: "income",
              total_amount_esti: sph.quantity * sph.amount,
              total_amount_real: sph.paid ? sph.quantity * sph.amount : 0,
              paid: sph.paid,
              date: sph.date,
              income_esti: sph.quantity * sph.amount,
              income_real: sph.paid ? sph.quantity * sph.amount : 0,
              year: moment(sph.date, "YYYY-MM-DD").format("YYYY"),
              month: moment(sph.date, "YYYY-MM-DD").format("MM"),
              row_type:
                sph.income_type && sph.income_type.name
                  ? sph.income_type.name
                  : "",
              document: sph.income || sph.invoice
            });
          }
        });
        ph.expenses.forEach((sph) => {
          if (sph.quantity && sph.amount) {
            response.push({
              ...projectInfo,
              type: "expense",
              total_amount_esti: -1 * sph.quantity * sph.amount,
              total_amount_real: sph.paid ? -1 * sph.quantity * sph.amount : 0,
              paid: sph.paid,
              expense_esti: -1 * Math.abs(sph.quantity * sph.amount),
              expense_real: sph.paid ? -1 * sph.quantity * sph.amount : 0,
              date: sph.date,
              year: moment(sph.date, "YYYY-MM-DD").format("YYYY"),
              month: moment(sph.date, "YYYY-MM-DD").format("MM"),
              row_type:
                sph.expense_type && sph.expense_type.name
                  ? sph.expense_type.name
                  : "",
                document: sph.expense || sph.invoice
            });
          }
        });
      });

      response.push({
        ...projectInfo,
        type: "hours",
        date: "",
        total_estimated_hours_price: -1 * p.total_estimated_hours_price,
        total_real_hours_price: -1 * p.total_real_hours_price,
        year: "2099",
        month: "99",
        row_type: "",
        document: "0"
      });
    });

    if (year) {
      response = response.filter(r => r.year === year)
    }
    if (paid != null) {
      response = response.filter(r => r.paid === (paid === 'true'))
    }
    if (document === 'null') {
      response = response.filter(r => r.document === null)
    }
    
    

    // Removing some info
    // const newArray = projects.map(({ phases, activities, emitted_invoices, received_invoices, tickets, diets, emitted_grants, received_grants, quotes, original_phases, incomes, expenses, strategies, estimated_hours, intercooperations, clients, received_expenses, received_incomes, ...item }) => item)
    return response; // projects.map(entity => sanitizeEntity(entity, { model: strapi.models.project }));
  },


  async updatePhases(ctx) {

    const projects = await strapi.query("project").find({ _limit: -1 });

    for(let i = 0; i < projects.length; i++) {
      const project = projects[i]
      if (project.phases?.length && (!project.original_phases || !project.original_phases.length)) {
        const projectToUpdate = { id: project.id }
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
        await strapi.query("project").update({ id: project.id }, projectToUpdate);      
      }
    }
    return { done: true }
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

  enqueueProjects: async (projects) => {
    projectsQueue.push(projects);
  },

  updateQueuedProjects: async () => {
    const projects = projectsQueue.pop();
    if (projects.current) {
      await updateProjectInfo(projects.current);
    }
    if (projects.previous && projects.current !== projects.previous) {
      await updateProjectInfo(projects.previous);
    }
  },
};
