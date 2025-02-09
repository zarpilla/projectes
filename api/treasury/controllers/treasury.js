"use strict";

const moment = require("moment")
const _ = require('lodash');
const zeroPad = (num, places) => String(num).padStart(places, "0");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const getDeductiblePct = (years, emitted) => {
  const year = years.find((y) => y.year.toString() === moment(emitted, "YYYY-MM-DD").format('YYYY').toString())  
  return year ? year.deductible_vat_pct / 100.0: 1.0;
}

module.exports = {
  async forecast(ctx) {

    let where = { _limit: -1 };

    if (ctx.query && ctx.query.project_states && ctx.query.project_states !== undefined) {
      where = { _limit: -1, project_state_in: ctx.query.project_states.split(",").map((x) => parseInt(x)) };
    }

    const year = ctx.query.year;

    if (ctx.query && ctx.query.filter && ctx.query.filter === "approved") {
      where = { _limit: -1, project_state_in: [1, 2] };
    } else if (ctx.query && ctx.query.filter && ctx.query.filter === "requested") {
      where = { _limit: -1, project_state_eq: 3 };
    }

    const treasury = [];
    // const treasuryData = [];
    const projectExpenses = [];
    const projectIncomes = [];

    const treasuries = 
    await strapi.query("treasury").find({ _limit: -1 })
    
    const emitted = 
    await strapi.query("emitted-invoice").find({ _limit: -1 })
    
    const received = 
    await strapi.query("received-invoice").find({ _limit: -1 })
    
    const tickets = 
    await strapi.query("ticket").find({ _limit: -1 })
      
    const diets = 
    await strapi.query("diet").find({ _limit: -1 })
    
    const receivedIncomes = 
    await strapi.query("received-income").find({ _limit: -1 })
    
    const receivedExpenses = 
    await strapi.query("received-expense").find({ _limit: -1 })

    const payrolls = 
    await strapi.query("payroll").find({ _limit: -1 })
    
    const projects = 
    await strapi.query("project").find(where,
      ["project_phases", "project_phases.expenses", "project_phases.expenses.provider", "project_phases.expenses.expense_type", "project_phases.expenses.invoice", "project_phases.expenses.grant", "project_phases.expenses.ticket", "project_phases.expenses.diet", "project_phases.incomes", "project_phases.incomes.client", "project_phases.incomes.income_type", "project_phases.incomes.invoice", "project_phases.incomes.income"]
    )

    const years = 
    await strapi.query("year").find({ _limit: -1 })

    // vat
    const vat = { paid: 0, received: 0, deductible_vat_pct: 0, deductible_vat_pct_sum: 0, deductible_vat_pct_n: 0, deductible_vat: 0 };
    const vat_expected = { paid: 0, received: 0 };    

    for (let p of projects) {
      for (let ph of p.project_phases) {
        for (let e of ph.expenses || []) {          
          if (!e.paid) {
            const expense = {
              expenseId: e.id,
              project_name: p.name,
              project_id: p.id,
              type: "Despesa esperada",
              concept: e.concept,
              total_amount: e.total_amount ? -1 * e.total_amount : 0,
              date: moment(e.date, "YYYY-MM-DD") || moment(),
              date_error: e.date === null,
              paid: false,
              contact: e.provider && e.provider.name ? e.provider.name : "-",
            };
            treasury.push(expense);

            const date_est = e.date_estimate_document || e.date
            if (date_est && moment(date_est, 'YYYY-MM-DD').year() <= moment().year() && e.expense_type && e.expense_type.vat_pct) {
              vat_expected.paid += e.total_amount * e.expense_type.vat_pct / 100;
            }
          }
          if (e.invoice && e.invoice.id) {
            projectExpenses.push({
              type: "invoice",
              id: e.invoice.id,
              code: e.invoice.code,
            });
          }
          if (e.grant && e.grant.id) {
            projectExpenses.push({
              type: "grant",
              id: e.grant.id,
              code: e.grant.code,
            });
          }
          if (e.ticket && e.ticket.id) {
            projectExpenses.push({
              type: "ticket",
              id: e.ticket.id,
              code: e.ticket.code,
            });
          }
          if (e.diet && e.diet.id) {
            projectExpenses.push({
              type: "diet",
              id: e.diet.id,
              code: e.diet.code,
            });
          }
          if (e.expense && e.expense.id) {
            projectExpenses.push({
              type: "expense",
              id: e.expense.id,
              code: e.expense.code,
            });
          }
        }
        for (let i of ph.incomes || []) {
          if (!i.paid) {
            const income = {
              incomeId: i.id,
              project_name: p.name,
              project_id: p.id,
              type: "Ingrés esperat",
              concept: i.concept,
              total_amount: i.total_amount ? i.total_amount : 0,
              date: moment(i.date, "YYYY-MM-DD") || moment(),
              date_error: i.date === null,
              paid: false,
              contact: i.client && i.client.name ? i.client.name : "-",
            };
            treasury.push(income);            
            
            const date_est = i.date_estimate_document || i.date

            if (date_est && moment(date_est, 'YYYY-MM-DD').year() <= moment().year() && i.income_type && i.income_type.vat_pct) {
              vat_expected.received += i.total_amount * i.income_type.vat_pct / 100;
            }
          }
          if (i.invoice && i.invoice.id) {
            projectIncomes.push({
              type: "invoice",
              id: i.invoice.id,
              code: i.invoice.code,
            });
          }
          if (i.grant && i.grant.id) {
            projectIncomes.push({
              type: "grant",
              id: i.grant.id,
              code: i.grant.code,
            });
          }
          if (i.income && i.income.id) {
            projectIncomes.push({
              type: "income",
              id: i.income.id,
              code: i.income.code,
            });
          }
        }
      }
    }

    treasuries.forEach((e) => {
      const expense = {
        project_name: e.project?.name,
        project_id: e.project?.id,
        treasury_id: e.id,
        type: e.comment === "IVA Saldat" ? e.comment : "Operació de tresoreria",
        concept: e.comment,
        total_amount: e.total,
        date: moment(e.date, "YYYY-MM-DD") || moment(),
        date_error: e.date === null,
        paid: true,
        contact: "-",
      };
      treasury.push(expense);
    });
    // today
    const today = {
      project_name: "-",
      project_id: 0,
      type: "Avui",
      concept: "-",
      total_amount: 0,
      date: moment(),
      date_error: false,
      paid: null,
      contact: "-",
    };

    treasury.push(today);

    // today
    const startOfYear = {
      project_name: "-",
      project_id: 0,
      type: "Inici Any",
      concept: "-",
      total_amount: 0,
      date: moment(year, 'YYYY').startOf("year"),
      date_error: false,
      paid: null,
      contact: "-",
    };

    treasury.push(startOfYear);

    
    
    // emitted
    for (let i of emitted) {
      const date = i.paid_date
        ? moment(i.paid_date, "YYYY-MM-DD")
        : i.estimated_payment
        ? moment(i.estimated_payment, "YYYY-MM-DD")
        : i.paybefore
        ? moment(i.paybefore, "YYYY-MM-DD")
        : moment(i.emitted, "YYYY-MM-DD");
      const income = {
        project_name:
          i.project && i.project.name
            ? i.project.name
            : i.projects &&
              i.projects.length &&
              i.projects[0] &&
              i.projects[0].name
            ? i.projects[0].name
            : "",
        project_id: i.project
          ? i.project.id
          : i.projects && i.projects.length && i.projects[0] && i.projects[0].id
          ? i.projects[0].id
          : 0,
        type: i.paid ? "Factura cobrada" : "Factura emesa",
        concept: i.code,
        total_amount: i.total ? i.total : 0,
        date: date,
        date_error: (i.paid_date || i.estimated_payment || i.paybefore || i.emitted) === null,
        real: true,
        pdf: i.pdf,
        paid: i.paid,
        contact: i.contact && i.contact.name ? i.contact.name : "?",
        to: `/document/${i.id}/emitted-invoices`,
      };

      treasury.push(income);
      if (i.total_vat) {
        if (!i.vat_paid_date) {
          vat.received += i.total_vat;
          vat.deductible_vat += -1 * i.total_vat;
        }
      }
    }
    for (let i of receivedIncomes) {
      const date = i.paid_date
        ? moment(i.paid_date, "YYYY-MM-DD")
        : i.estimated_payment
        ? moment(i.estimated_payment, "YYYY-MM-DD")
        : i.paybefore
        ? moment(i.paybefore, "YYYY-MM-DD")
        : moment(i.emitted, "YYYY-MM-DD");
      const income = {
        project_name:
          i.project && i.project.name
            ? i.project.name
            : i.projects &&
              i.projects.length &&
              i.projects[0] &&
              i.projects[0].name
            ? i.projects[0].name
            : "",
        project_id: i.project
          ? i.project.id
          : i.projects && i.projects.length && i.projects[0] && i.projects[0].id
          ? i.projects[0].id
          : 0,
        type: `${i.paid ? "Ingrés cobrat" : "Ingrés emès"} (${
          i.document_type.name
        })`,
        concept: i.code,
        total_amount: i.total ? i.total : 0,
        date: date,
        date_error: (i.paid_date || i.estimated_payment || i.paybefore || i.emitted) === null,
        real: true,
        pdf: i.pdf,
        paid: i.paid,
        contact: i.contact && i.contact.name ? i.contact.name : "?",
        to: `/document/${i.id}/received-incomes`,
      };
      treasury.push(income);
      if (i.total_vat) {
        if (!i.vat_paid_date) {
          vat.received += i.total_vat;
          vat.deductible_vat += -1 * i.total_vat;
        }
      }
    }
    // received
    for (let e of received) {
      const date = e.paid_date
        ? moment(e.paid_date, "YYYY-MM-DD")
        : e.paybefore
        ? moment(e.paybefore, "YYYY-MM-DD")
        : moment(e.emitted, "YYYY-MM-DD");
      const expense = {
        project_name:
          e.project && e.project.name
            ? e.project.name
            : e.projects &&
              e.projects.length &&
              e.projects[0] &&
              e.projects[0].name
            ? e.projects[0].name
            : "",
        project_id: e.project
          ? e.project.id
          : e.projects && e.projects.length && e.projects[0] && e.projects[0].id
          ? e.projects[0].id
          : 0,
        type: e.paid ? "Factura pagada" : "Factura rebuda",
        concept: e.code,
        total_amount: e.total ? -1 * e.total : 0,
        date: date,
        date_error: false,
        paid: e.paid,
        real: true,
        pdf: e.pdf,
        contact: e.contact && e.contact.name ? e.contact.name : "-",
        to: `/document/${e.id}/received-invoices`,
      };
      treasury.push(expense);
      if (e.total_irpf) {
        const expense2 = {
          project_name:
            e.project && e.project.name
              ? e.project.name
              : e.projects &&
                e.projects.length &&
                e.projects[0] &&
                e.projects[0].name
              ? e.projects[0].name
              : "",
          project_id: e.project
            ? e.project.id
            : e.projects &&
              e.projects.length &&
              e.projects[0] &&
              e.projects[0].id
            ? e.projects[0].id
            : 0,
          type: "IRPF Factura",
          concept: e.code,
          total_amount: -1 * e.total_irpf,
          date: moment(e.emitted, "YYYY-MM-DD").endOf("quarter").add(20, "day"),
          date_error: e.emitted === null,
          paid:
            moment(e.emitted, "YYYY-MM-DD")
              .endOf("quarter")
              .add(20, "day")
              .format("YYYY-MM-DD") < moment().format("YYYY-MM-DD"),
          contact: e.contact && e.contact.name ? e.contact.name : "-",
          to: `/document/${e.id}/received-invoices`,
        };
        treasury.push(expense2);
      }
      if (e.total_vat) {
        if (!e.vat_paid_date) {
          vat.paid += e.total_vat;
          vat.deductible_vat += getDeductiblePct(years, e.emitted) * e.total_vat;          
          vat.deductible_vat_pct_sum += getDeductiblePct(years, e.emitted)
          vat.deductible_vat_pct_n++
        }
      }
    }
    for (let e of receivedExpenses) {
      const date = e.paid_date
        ? moment(e.paid_date, "YYYY-MM-DD")
        : e.paybefore
        ? moment(e.paybefore, "YYYY-MM-DD")
        : moment(e.emitted, "YYYY-MM-DD");
      const expense = {
        project_name:
          e.project && e.project.name
            ? e.project.name
            : e.projects &&
              e.projects.length &&
              e.projects[0] &&
              e.projects[0].name
            ? e.projects[0].name
            : "",
        project_id: e.project
          ? e.project.id
          : e.projects && e.projects.length && e.projects[0] && e.projects[0].id
          ? e.projects[0].id
          : 0,
        type: `${e.paid ? "Despesa pagada" : "Despesa rebuda"} (${
          e.document_type.name
        })`,
        concept: e.code,
        total_amount: e.total ? -1 * e.total : 0,
        date: date,
        date_error: false,
        paid: e.paid,
        real: true,
        pdf: e.pdf,
        contact: e.contact && e.contact.name ? e.contact.name : "-",
        to: `/document/${e.id}/received-expenses`,
      };
      treasury.push(expense);
      if (e.total_irpf) {
        const expense2 = {
          project_name:
            e.project && e.project.name
              ? e.project.name
              : e.projects &&
                e.projects.length &&
                e.projects[0] &&
                e.projects[0].name
              ? e.projects[0].name
              : "",
          project_id: e.project
            ? e.project.id
            : e.projects &&
              e.projects.length &&
              e.projects[0] &&
              e.projects[0].id
            ? e.projects[0].id
            : 0,
          type: "IRPF Factura",
          concept: e.code,
          total_amount: -1 * e.total_irpf,
          date: moment(e.emitted, "YYYY-MM-DD").endOf("quarter").add(20, "day"),
          date_error: e.emitted === null,
          paid: false,
          contact: e.contact && e.contact.name ? e.contact.name : "-",
          to: `/document/${e.id}/received-expenses`,
        };
        treasury.push(expense2);
      }
      if (e.total_vat) {
        // treasury.push(vat);
        if (!e.vat_paid_date) {
          vat.received += e.total_vat;
          vat.deductible_vat += getDeductiblePct(years, e.emitted) * e.total_vat;
          vat.deductible_vat_pct_sum += getDeductiblePct(years, e.emitted)
          vat.deductible_vat_pct_n++
        }
      }
    }
    for (let e of diets) {
      const date = e.paid_date
        ? moment(e.paid_date, "YYYY-MM-DD")
        : e.paybefore
        ? moment(e.paybefore, "YYYY-MM-DD")
        : moment(e.emitted, "YYYY-MM-DD");
      const expense = {
        project_name:
          e.project && e.project.name
            ? e.project.name
            : e.projects &&
              e.projects.length &&
              e.projects[0] &&
              e.projects[0].name
            ? e.projects[0].name
            : "",
        project_id: e.project
          ? e.project.id
          : e.projects && e.projects.length && e.projects[0] && e.projects[0].id
          ? e.projects[0].id
          : 0,
        type: "Dieta",
        concept: e.code,
        total_amount: e.total ? -1 * e.total : 0,
        date: date,
        date_error: (e.paid_date || e.paybefore || e.emitted) === null,
        paid: e.paid,
        contact: e.contact && e.contact.name ? e.contact.name : "-",
      };
      treasury.push(expense);
    }
    for (let e of tickets) {
      const date = e.paid_date
        ? moment(e.paid_date, "YYYY-MM-DD")
        : e.paybefore
        ? moment(e.paybefore, "YYYY-MM-DD")
        : moment(e.emitted, "YYYY-MM-DD");
      const expense = {
        project_name:
          e.project && e.project.name
            ? e.project.name
            : e.projects &&
              e.projects.length &&
              e.projects[0] &&
              e.projects[0].name
            ? e.projects[0].name
            : "",
        project_id: e.project
          ? e.project.id
          : e.projects && e.projects.length && e.projects[0] && e.projects[0].id
          ? e.projects[0].id
          : 0,
        type: "Ticket",
        concept: e.code,
        total_amount: e.total ? -1 * e.total : 0,
        date: date,
        date_error: (e.paid_date || e.emitted) === null,
        paid: e.paid,
        contact: e.provider && e.provider.name ? e.provider.name : "-",
      };
      treasury.push(expense);
    }

    for (let e of payrolls) {
      const date = e.paid_date
        ? moment(e.paid_date, "YYYY-MM-DD")
        : moment.max([
            e.emitted ? moment(e.emitted, "YYYY-MM-DD") : moment(),
            moment(),
          ]);
      const expense = {
        project_name: "",
        project_id: 0,
        type: e.paid ? "Nòmina pagada" : "Nòmina esperada",
        concept: `Nòmina ${e.year.year}-${zeroPad(e.month.month, 2)}-${
          e.users_permissions_user.username
        }`,
        total_amount: e.net_base ? -1 * e.net_base : 0,
        date: moment(e.net_date, "YYYY-MM-DD"),
        date_error: (e.paid_date || e.emitted) === null,
        paid: e.paid,
        contact:
          e.users_permissions_user && e.users_permissions_user.username
            ? e.users_permissions_user.username
            : "",
        to: `/document/${e.id}/payrolls`,
      };
      treasury.push(expense);

      if (e.irpf_base) {
        const expense2 = {
          project_name: "",
          project_id: 0,
          type: "IRPF Nòmina",
          concept: `Nòmina ${e.year.year}-${zeroPad(e.month.month, 2)}-${
            e.users_permissions_user.username
          }`,
          total_amount: e.irpf_base ? -1 * e.irpf_base : 0,
          date: moment(e.irpf_date, "YYYY-MM-DD"),
          date_error: e.irpf_date === null,
          paid: e.paid,
          contact:
            e.users_permissions_user && e.users_permissions_user.username
              ? e.users_permissions_user.username
              : "",
          to: `/document/${e.id}/payrolls`,
        };
        treasury.push(expense2);
      }

      if (e.other_base) {
        const expense4 = {
          project_name: "",
          project_id: 0,
          type: "Altres Nòmina",
          concept: `Nòmina ${e.year.year}-${zeroPad(e.month.month, 2)}-${
            e.users_permissions_user.username
          }`,
          total_amount: e.other_base ? -1 * e.other_base : 0,
          date: moment(e.other_date, "YYYY-MM-DD"),
          date_error: e.other_date === null,
          paid: e.paid,
          contact:
            e.users_permissions_user && e.users_permissions_user.username
              ? e.users_permissions_user.username
              : "",
          to: `/document/${e.id}/payrolls`,
        };
        treasury.push(expense4);
      }

      if (e.ss_base) {
        const expense3 = {
          project_name: "",
          project_id: 0,
          type: e.paid ? "SS pagat" : "SS esperat",
          concept: `Nòmina ${e.year.year}-${zeroPad(e.month.month, 2)}-${
            e.users_permissions_user.username
          }`,
          total_amount: e.ss_base ? -1 * e.ss_base : 0,
          date: moment(e.ss_date, "YYYY-MM-DD"),
          date_error: e.ss_date === null,
          paid: e.paid,
          contact:
            e.users_permissions_user && e.users_permissions_user.username
              ? e.users_permissions_user.username
              : "",
          to: `/document/${e.id}/payrolls`,
        };
        treasury.push(expense3);
      }
    }

    const me = await strapi.query("me").findOne();
    
    // if (-1*(vat.received - (vat.paid * me.options.deductible_vat_pct / 100)) !== 0) {
    //   treasury.push({
    //     project_name: "",
    //       project_id: 0,
    //       type: "IVA pendent de saldar",
    //       concept: `IVA pendent de saldar`,
    //       total_amount: -1*(vat.received - (vat.paid * me.options.deductible_vat_pct / 100)),
    //       date: moment().endOf("year"),
    //       date_error: false,
    //       paid: false,
    //       contact:
    //         "",
    //       to: null,
    //   })
    // }

    if (-1*(vat_expected.received - (vat_expected.paid * me.options.deductible_vat_pct / 100)) !== 0) {
      treasury.push({
        project_name: "",
          project_id: 0,
          type: "IVA previst pendent de saldar",
          concept: `IVA previst pendent de saldar`,
          total_amount: -1*(vat_expected.received - (vat_expected.paid * me.options.deductible_vat_pct / 100)),
          date: moment().endOf("year"),
          date_error: false,
          paid: false,
          contact:
            "",
          to: null,
      })
    }


    // sort and show
    const treasury2 = treasury.map((t) => {
      return { ...t, datef: t.date.format("YYYYMMDD") };
    });

    const treasuryData = _.sortBy(treasury2, "datef");
    const treasuryDataX = [];

    let subtotal = 0;
    for (let i = 0; i < treasuryData.length; i++) {
      const t = treasuryData[i];
      subtotal += t.total_amount;
      treasuryDataX.push({
        ...t,
        datex: moment(treasuryData[i].datef, "YYYYMMDD").format("DD-MM-YYYY"),
        subtotal,
      });
    }

    // console.log("vat_expected", vat_expected);
    vat.deductible_vat_pct = vat.deductible_vat_pct_sum / vat.deductible_vat_pct_n * 100
    vat.deductible_vat_pct = parseFloat(vat.deductible_vat_pct.toFixed(2))
    return { treasury: treasuryDataX, projects, vat, vat_expected };
  },
};
