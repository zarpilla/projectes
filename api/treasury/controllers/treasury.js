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

const getBankAccountName = (bankAccount, defaultBankAccount) => {
  if (bankAccount && bankAccount.name) {
    return bankAccount.name;
  }
  if (defaultBankAccount && defaultBankAccount.name) {
    return defaultBankAccount.name;
  }
  return null;
}

module.exports = {
  async forecast(ctx) {

    const year = ctx.query.year;
    const bankAccountFilterIds = ctx.query.bank_account_id;

    const treasury = [];
    // const treasuryData = [];
    const projectExpenses = [];
    const projectIncomes = [];

    console.time("forecast")

    const treasuries = 
    await strapi.query("treasury").find({ _limit: -1 }, ["bank_account", "project"])
    
    const emitted = 
    await strapi.query("emitted-invoice").find({ _limit: -1 }, ["bank_account", "project", "projects", "contact"])
    
    const received = 
    await strapi.query("received-invoice").find({ _limit: -1 }, ["bank_account", "project", "projects", "contact"])
    
    const receivedIncomes = 
    await strapi.query("received-income").find({ _limit: -1 }, ["bank_account", "project", "projects", "contact", "document_type"])
    
    const receivedExpenses = 
    await strapi.query("received-expense").find({ _limit: -1 }, ["bank_account", "project", "projects", "contact", "document_type"])

    const payrolls = 
    await strapi.query("payroll").find({ _limit: -1 }, ["bank_account", "year", "month", "users_permissions_user"])
    
    // Fetch ALL projects (we'll filter in JavaScript)
    const allProjectsRaw = 
    await strapi.query("project").find({ _limit: -1 },
      ["project_phases", "project_phases.expenses", "project_phases.expenses.provider", "project_phases.expenses.expense_type", "project_phases.expenses.invoice", "project_phases.expenses.grant", "project_phases.expenses.ticket", "project_phases.expenses.diet", "project_phases.expenses.expense", "project_phases.expenses.bank_account", "project_phases.incomes", "project_phases.incomes.client", "project_phases.incomes.income_type", "project_phases.incomes.invoice", "project_phases.incomes.income", "project_phases.incomes.bank_account"]
    )
    
    // Filter out mother projects (is_mother === true) for unpaid items processing
    // This ensures we only process real projects, not container/mother projects
    const allProjects = allProjectsRaw.filter(p => p.is_mother !== true);
    
    // Also filter projects with the specified state filter for the return list
    const projects = allProjects.filter(p => {
      // If no specific filter, return all non-mother projects
      if (!ctx.query || (!ctx.query.project_states && !ctx.query.filter)) {
        return true;
      }
      
      // Apply project_states filter
      if (ctx.query.project_states) {
        const states = ctx.query.project_states.split(",").map((x) => parseInt(x));
        return states.includes(p.project_state);
      }
      
      // Apply filter shortcuts
      if (ctx.query.filter === "approved") {
        return [1, 2].includes(p.project_state);
      } else if (ctx.query.filter === "requested") {
        return p.project_state === 3;
      }
      
      return true;
    });

    const years = 
    await strapi.query("year").find({ _limit: -1 })

    const bankAccounts = 
    await strapi.query("bank-accounts").find({ _limit: -1 })

    const me = await strapi.query("me").findOne({}, ["bank_account_payroll", "bank_account_ss", "bank_account_irpf", "bank_account_default", "bank_account_vat"]);

    console.timeEnd("forecast")

    console.time("process")

    // vat
    const vat = { paid: 0, received: 0, deductible_vat_pct: 0, deductible_vat_pct_sum: 0, deductible_vat_pct_n: 0, deductible_vat: 0, documents: [] };
    const vat_expected = { paid: 0, received: 0 };
    const vat_expected_by_quarter = {};    

    // Process filtered projects to find unpaid incomes and expenses
    for (let p of projects) {
      const hasUnpaidItems = p.project_phases?.some(ph => 
        (ph.incomes?.some(i => !i.paid) || ph.expenses?.some(e => !e.paid))
      );
      if (hasUnpaidItems) {
        console.log('Project with unpaid items:', p.name, 'Phases:', p.project_phases?.length);
      }
      for (let ph of p.project_phases) {
        if (ph.incomes?.some(i => !i.paid) || ph.expenses?.some(e => !e.paid)) {
          console.log('  Phase:', ph.name, 'Incomes:', ph.incomes?.length, 'Expenses:', ph.expenses?.length);
        }
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
              bank_account: getBankAccountName(e.bank_account, me.bank_account_default),
            };
            treasury.push(expense);

            const date_est = e.date_estimate_document || e.date
            if (date_est && e.expense_type && e.expense_type.vat_pct) {
              const vatAmount = e.total_amount * e.expense_type.vat_pct / 100;
              vat_expected.paid += vatAmount;
              
              // Group by quarter
              const dateEstMoment = moment(date_est, 'YYYY-MM-DD');
              const quarter = dateEstMoment.quarter();
              const year = dateEstMoment.year();
              const key = `${year}-Q${quarter}`;
              
              if (!vat_expected_by_quarter[key]) {
                vat_expected_by_quarter[key] = {
                  year,
                  quarter,
                  paid: 0,
                  received: 0
                };
              }
              
              vat_expected_by_quarter[key].paid += vatAmount;
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
          console.log('    Income:', i.id, 'Paid:', i.paid, 'Concept:', i.concept, 'Date:', i.date);
          if (!i.paid) {
            console.log('      -> Adding to treasury as "Ingrés esperat"');
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
              bank_account: getBankAccountName(i.bank_account, me.bank_account_default),
            };
            treasury.push(income);            
            
            const date_est = i.date_estimate_document || i.date

            if (date_est && i.income_type && i.income_type.vat_pct) {
              const vatAmount = i.total_amount * i.income_type.vat_pct / 100;
              vat_expected.received += vatAmount;
              
              // Group by quarter
              const dateEstMoment = moment(date_est, 'YYYY-MM-DD');
              const quarter = dateEstMoment.quarter();
              const year = dateEstMoment.year();
              const key = `${year}-Q${quarter}`;
              
              if (!vat_expected_by_quarter[key]) {
                vat_expected_by_quarter[key] = {
                  year,
                  quarter,
                  paid: 0,
                  received: 0
                };
              }
              
              vat_expected_by_quarter[key].received += vatAmount;
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
      let expense;
      
      // Special case: treasury with total=0 but balance>0 indicates real money in account for that day
      if (e.total === 0 && e.balance && parseFloat(e.balance) > 0) {
        expense = {
          project_name: e.project?.name,
          project_id: e.project?.id,
          treasury_id: e.id,
          type: "Saldo bancari",
          concept: e.comment || "Saldo real del compte",
          total_amount: 0,
          account_balance: parseFloat(e.balance),
          date: moment(e.date, "YYYY-MM-DD") || moment(),
          date_error: e.date === null,
          paid: true,
          contact: "-",
          bank_account: getBankAccountName(e.bank_account, me.bank_account_default),
          is_balance_annotation: true,
        };
      } else {
        expense = {
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
          bank_account: getBankAccountName(e.bank_account, me.bank_account_default),
        };
      }
      
      treasury.push(expense);
    });
    
    // Create "Today" entries for each bank account
    bankAccounts.forEach((bankAccount) => {
      const today = {
        project_name: "-",
        project_id: 0,
        type: "Avui",
        concept: `-`,
        total_amount: 0,
        date: moment(),
        date_error: false,
        paid: null,
        contact: "-",
        bank_account: bankAccount.name,
      };
      treasury.push(today);
    });

    // Create "Start of Year" entries for each bank account  
    bankAccounts.forEach((bankAccount) => {
      const startOfYear = {
        project_name: "-",
        project_id: 0,
        type: "Inici Any",
        concept: `-`,
        total_amount: 0,
        date: moment(year, 'YYYY').startOf("year"),
        date_error: false,
        paid: null,
        contact: "-",
        bank_account: bankAccount.name,
      };
      treasury.push(startOfYear);
    });

    
    
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
        bank_account: getBankAccountName(i.bank_account, me.bank_account_default),
      };

      treasury.push(income);
      if (i.total_vat) {
        if (!i.vat_paid_date) {
          vat.received += i.total_vat;
          vat.deductible_vat += -1 * i.total_vat;
          vat.documents.push({ id: i.id, code: i.code, type: 'emitted-invoices', total_vat: i.total_vat, total: i.total, date: i.emitted });
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
        bank_account: getBankAccountName(i.bank_account, me.bank_account_default),
      };
      treasury.push(income);
      if (i.total_vat) {
        if (!i.vat_paid_date) {
          vat.received += i.total_vat;
          vat.deductible_vat += -1 * i.total_vat;
          vat.documents.push({ id: i.id, code: i.code, type: 'received-incomes', total_vat: i.total_vat, total: i.total, date: i.emitted });
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
        bank_account: getBankAccountName(e.bank_account, me.bank_account_default),
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
          bank_account: me.bank_account_irpf && me.bank_account_irpf.name ? me.bank_account_irpf.name : null,
        };
        treasury.push(expense2);
      }
      if (e.total_vat) {
        if (!e.vat_paid_date) {
          vat.paid += e.total_vat;
          vat.deductible_vat += getDeductiblePct(years, e.emitted) * e.total_vat;          
          vat.deductible_vat_pct_sum += getDeductiblePct(years, e.emitted)
          vat.deductible_vat_pct_n++
          vat.documents.push({ id: e.id, code: e.code, type: 'received-invoices', total_vat: e.total_vat, total: e.total, date: e.emitted });
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
        bank_account: getBankAccountName(e.bank_account, me.bank_account_default),
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
          bank_account: me.bank_account_irpf && me.bank_account_irpf.name ? me.bank_account_irpf.name : null,
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
          vat.documents.push({ id: e.id, code: e.code, type: 'received-expenses', total_vat: e.total_vat, total: e.total, date: e.emitted });
        }
      }
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
        bank_account: getBankAccountName(e.bank_account, me.bank_account_default),
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
          bank_account: me.bank_account_irpf && me.bank_account_irpf.name ? me.bank_account_irpf.name : null,
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
          bank_account: me.bank_account_payroll && me.bank_account_payroll.name ? me.bank_account_payroll.name : null,
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
          bank_account: me.bank_account_ss && me.bank_account_ss.name ? me.bank_account_ss.name : null,
        };
        treasury.push(expense3);
      }
    }


    // Group VAT documents by quarter for executed VAT
    const vatByQuarter = {};
    
    for (let doc of vat.documents) {
      const docDate = moment(doc.date, 'YYYY-MM-DD');
      const quarter = docDate.quarter();
      const year = docDate.year();
      const key = `${year}-Q${quarter}`;
      
      if (!vatByQuarter[key]) {
        vatByQuarter[key] = {
          year,
          quarter,
          paid: 0,
          received: 0,
          deductible_vat: 0,
          deductible_vat_pct_sum: 0,
          deductible_vat_pct_n: 0,
          documents: []
        };
      }
      
      if (doc.type === 'received-invoices' || doc.type === 'received-expenses') {
        const deductiblePct = getDeductiblePct(years, doc.date);
        vatByQuarter[key].paid += doc.total_vat;
        vatByQuarter[key].deductible_vat += deductiblePct * doc.total_vat;
        vatByQuarter[key].deductible_vat_pct_sum += deductiblePct;
        vatByQuarter[key].deductible_vat_pct_n++;
      } else if (doc.type === 'emitted-invoices' || doc.type === 'received-incomes') {
        vatByQuarter[key].received += doc.total_vat;
        vatByQuarter[key].deductible_vat += -1 * doc.total_vat;
      }
      
      vatByQuarter[key].documents.push(doc);
    }
    
    // Add executed VAT entries to treasury
    for (let key in vatByQuarter) {
      const qData = vatByQuarter[key];
      const balance = qData.deductible_vat;
      
      if (balance !== 0) {
        // Calculate the payment date: 30th of the month after quarter end
        // Exception: Q4 (Oct-Dec) is paid on January 20th instead of 30th
        let paymentDate = moment(`${qData.year}`, 'YYYY')
          .quarter(qData.quarter)
          .endOf('quarter')
          .add(1, 'month');
        
        if (qData.quarter === 4) {
          // Q4: January 20th
          paymentDate.date(20);
        } else {
          // Q1, Q2, Q3: 30th of the month
          paymentDate.date(30);
        }
        
        // Determine if it's paid (before today) or expected (today or future)
        const isPaid = paymentDate.isBefore(moment(), 'day');
        
        treasury.push({
          project_name: "",
          project_id: 0,
          type: "IVA executat pendent de saldar",
          concept: `IVA executat ${qData.year} T${qData.quarter}`,
          total_amount: -1 * balance,
          date: paymentDate,
          date_error: false,
          paid: isPaid,
          contact: "",
          to: null,
          bank_account: me.bank_account_vat && me.bank_account_vat.name ? me.bank_account_vat.name : null,
        });
      }
    }

    // Add expected VAT entries to treasury (grouped by quarter)
    for (let key in vat_expected_by_quarter) {
      const qData = vat_expected_by_quarter[key];
      const balance = qData.received - (qData.paid * me.options.deductible_vat_pct / 100);
      
      if (balance !== 0) {
        // Calculate the payment date: 30th of the month after quarter end
        // Exception: Q4 (Oct-Dec) is paid on January 20th instead of 30th
        let paymentDate = moment(`${qData.year}`, 'YYYY')
          .quarter(qData.quarter)
          .endOf('quarter')
          .add(1, 'month');
        
        if (qData.quarter === 4) {
          // Q4: January 20th
          paymentDate.date(20);
        } else {
          // Q1, Q2, Q3: 30th of the month
          paymentDate.date(30);
        }
        
        treasury.push({
          project_name: "",
          project_id: 0,
          type: "IVA previst pendent de saldar",
          concept: `IVA previst ${qData.year} T${qData.quarter}`,
          total_amount: -1 * balance,
          date: paymentDate,
          date_error: false,
          paid: false,
          contact: "",
          to: null,
          bank_account: me.bank_account_vat && me.bank_account_vat.name ? me.bank_account_vat.name : null,
        });
      }
    }

    console.timeEnd("process")

    console.time("sort")


    // sort and show
    const treasury2 = treasury.map((t) => {
      return { ...t, datef: t.date.format("YYYYMMDD") };
    });

    const treasuryData = _.sortBy(treasury2, "datef");
    const treasuryDataX = [];

    let subtotal = 0;
    for (let i = 0; i < treasuryData.length; i++) {
      const t = treasuryData[i];
      
      // For balance annotations, set the subtotal to the account balance
      if (t.is_balance_annotation && t.account_balance !== undefined) {
        subtotal = t.account_balance;
      } else {
        subtotal += t.total_amount;
      }
      
      treasuryDataX.push({
        ...t,
        datex: moment(treasuryData[i].datef, "YYYYMMDD").format("DD-MM-YYYY"),
        subtotal,
      });
    }

    // console.log("vat_expected", vat_expected);
    vat.deductible_vat_pct = vat.deductible_vat_pct_sum / vat.deductible_vat_pct_n * 100
    vat.deductible_vat_pct = parseFloat(vat.deductible_vat_pct.toFixed(2))

    vat.documents = vat.documents.sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return 0;
    });

    // Apply bank account filter if specified
    let filteredTreasuryDataX = treasuryDataX;
    if (bankAccountFilterIds && bankAccountFilterIds.trim() !== '') {
      // Parse bank account IDs (can be comma-separated for multiple selection)
      const bankAccountIdArray = bankAccountFilterIds.split(',').map(id => id.trim()).filter(id => id !== '');
      
      console.log('Bank account filter IDs:', bankAccountIdArray);
      console.log('Treasury entries before filter:', treasuryDataX.length);
      console.log('Sample entries:', treasuryDataX.filter(t => t.type === 'Ingrés esperat').map(t => ({
        type: t.type,
        concept: t.concept,
        bank_account: t.bank_account,
        project_name: t.project_name
      })));
      
      if (bankAccountIdArray.length > 0) {
        // Find the bank account names by IDs for filtering
        const selectedBankAccountNames = bankAccounts
          .filter(ba => bankAccountIdArray.includes(ba.id.toString()))
          .map(ba => ba.name);
        
        console.log('Selected bank account names:', selectedBankAccountNames);
        
        if (selectedBankAccountNames.length > 0) {
          // Filter entries: include if bank_account matches OR if bank_account is null/undefined
          filteredTreasuryDataX = treasuryDataX.filter(t => 
            selectedBankAccountNames.includes(t.bank_account) || 
            !t.bank_account || 
            t.bank_account === null
          );
          
          console.log('Treasury entries after filter:', filteredTreasuryDataX.length);
          console.log('Ingrés esperat after filter:', filteredTreasuryDataX.filter(t => t.type === 'Ingrés esperat').length);
          
          // Recalculate subtotals for the filtered account-specific data
          let accountSubtotal = 0;
          filteredTreasuryDataX = filteredTreasuryDataX.map(t => {
            // For balance annotations, set the subtotal to the account balance
            if (t.is_balance_annotation && t.account_balance !== undefined) {
              accountSubtotal = t.account_balance;
            } else {
              accountSubtotal += t.total_amount;
            }
            
            return {
              ...t,
              subtotal: accountSubtotal,
            };
          });
        }
      }
    }

    console.timeEnd("sort")
    return { treasury: filteredTreasuryDataX, projects, vat, vat_expected };
  },
};
