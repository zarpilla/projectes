"use strict";
const projectController = require("../../api/project/controllers/project");

/**
 * An asynchronous bootstrap function that runs before
 * your application gets started.
 *
 * This gives you an opportunity to set up your data model,
 * run jobs, or perform some special logic.
 *
 * See more details here: https://strapi.io/documentation/developer-docs/latest/setup-deployment-guides/configurations.html#bootstrap
 */

async function setPermissions(role, type, newPermissions) {
  // Find the ID of the public role
  const publicRole = await strapi
    .query("role", "users-permissions")
    .findOne({ type: role });

  // List all available permissions
  const publicPermissions = await strapi
    .query("permission", "users-permissions")
    .find({ type: type, role: publicRole.id, _limit: -1 });

  // Update permission to match new config
  const controllersToUpdate = Object.keys(newPermissions);
  const updatePromises = publicPermissions
    .filter((permission) => {
      // Only update permissions included in newConfig
      if (permission.controller === "contact") {
        console.log("permission", permission);
      }
      if (!controllersToUpdate.includes(permission.controller)) {
        return false;
      }
      if (!newPermissions[permission.controller].includes(permission.action)) {
        return false;
      }
      return true;
    })
    .map((permission) => {
      // Enable the selected permissions
      return strapi
        .query("permission", "users-permissions")
        .update({ id: permission.id }, { enabled: true });
    });

  await Promise.all(updatePromises);
}

async function importSeedData() {
  // Permissions
  await setPermissions("authenticated", "application", {
    activity: [
      "create",
      "find",
      "update",
      "delete",
      "importcalendar",
      "move",
      "totalByDay",
      "getforcalendar",
    ],
    "activity-type": ["create", "find", "getBasic"],
    "emitted-invoice": [
      "create",
      "find",
      "findbasic",
      "findone",
      "update",
      "delete",
      "payvat",
      "pdf",
      "sendinvoicebyemail",
    ],
    "received-invoice": [
      "create",
      "find",
      "findbasic",
      "findone",
      "update",
      "delete",
    ],
    "received-income": [
      "create",
      "find",
      "findbasic",
      "findone",
      "update",
      "delete",
    ],
    "received-expense": [
      "create",
      "find",
      "findbasic",
      "findone",
      "update",
      "delete",
    ],
    payroll: ["create", "find", "findone", "update", "delete", "createAll"],
    project: [
      "create",
      "find",
      "findone",
      "update",
      "delete",
      "findwithbasicinfo",
      "findestimatedtotalsbyday",
      "findNames",
      "findwithphases",
      "payexpense",
      "payincome",
      "findwitheconomicdetail",
      "findChildren",
      "calculateproject2",
      "findoneextended",
    ],
    quote: ["create", "find", "findone", "update", "delete"],
    contacts: [
      "create",
      "find",
      "findone",
      "update",
      "delete",
      "basic",
      "withorders",
      "orders",
    ],
    "festive-type": ["find"],
    festive: ["create", "find", "findone", "update", "delete"],
    "daily-dedication": ["create", "find", "findone", "update", "delete"],
    "document-type": ["find", "findone"],
    "users-permissions": ["me", "find", "findone"],
    regions: ["find", "findone"],
    task: ["create", "find", "findone", "update", "delete"],
    "task-state": ["find", "findone"],
    treasury: ["create", "find", "forecast", "findone", "update", "delete"],
    "kanban-view": ["create", "find", "findone", "update", "delete"],
    justifications: ["create", "find", "findone", "update", "delete"],
    "workday-log": ["create", "find", "findone", "update", "delete"],
    product: ["find", "findone"],
    "user-festive": ["find"],
    orders: [
      "create",
      "count",
      "find",
      "findone",
      "update",
      "delete",
      "createcsv",
      "invoice",
      "pdf",
      "infoall",
      "pdfmultiple",
    ],
    "orders-imports": ["create", "find", "findone", "update"],
    "delivery-type": ["find"],
    pickups: ["find"],
    route: ["find"],
    "route-rate": ["find"],
    city: ["find", "findone", "create"],
    "city-route": ["find", "findone", "create", "delete"],
    "form-submission": ["create"],
    "route-festive": ["find", "findone", "create", "delete"],
    "project-phases": ["find", "findone", "create", "update", "delete"],
    "project-original-phases": [
      "find",
      "findone",
      "create",
      "update",
      "delete",
      "findwithhours",
    ],
    "estimated-hours": ["find", "findone", "create", "update", "delete"],
    "phase-income": ["find", "findassigned"],
    "phase-expense": ["find", "findassigned"],
  });

  await setPermissions("authenticated", "upload", {
    upload: ["upload"],
  });

  // set user permissions
  // const users = await strapi
  //   .query("user", "users-permissions")
  //   .find({ _limit: -1 });

  // for await (const user of users) {
  //   // if (user.permissions.length === 0 && user.blocked === false) {
  //   //   await strapi
  //   //     .query("user", "users-permissions")
  //   //     .update({ id: user.id }, { permissions: [{ permission: 'projects' }] });
  //   // }
  //   if (user.permissions.length > 0 && user.blocked === false) {
  //     const permissionHasProjects = user.permissions.filter(p => p.permission === 'projects').length > 0;
  //     const permissionHasHours = user.permissions.filter(p => p.permission === 'hours').length > 0;

  //     if (permissionHasProjects && !permissionHasHours) {
  //       const permissions = [...user.permissions]
  //       permissions.push({ permission: 'hours' });
  //       await strapi
  //         .query("user", "users-permissions")
  //         .update({ id: user.id }, { permissions: permissions });
  //     }
  //   }
  // }

  // const expenseTypes = await strapi.query("expense-type").find({ _limit: -1 });

  // for await (const expenseType of expenseTypes) {
  //   if (expenseType.vat_pct === null) {
  //     if (expenseType.id === 1) {
  //       await strapi
  //         .query("expense-type")
  //         .update({ id: expenseType.id }, { vat_pct: 21 });
  //     }
  //     if (expenseType.id === 2) {
  //       await strapi
  //         .query("expense-type")
  //         .update({ id: expenseType.id }, { vat_pct: 0 });
  //     }
  //     if (expenseType.id === 3) {
  //       await strapi
  //         .query("expense-type")
  //         .update({ id: expenseType.id }, { vat_pct: 10 });
  //     }
  //     if (expenseType.id === 4) {
  //       await strapi
  //         .query("expense-type")
  //         .update({ id: expenseType.id }, { vat_pct: 21 });
  //     }
  //     if (expenseType.id === 5) {
  //       await strapi
  //         .query("expense-type")
  //         .update({ id: expenseType.id }, { vat_pct: 21 });
  //     }
  //     if (expenseType.id === 6) {
  //       await strapi
  //         .query("expense-type")
  //         .update({ id: expenseType.id }, { vat_pct: 0 });
  //     }
  //   }
  // }

  // const incomesTypes = await strapi.query("income-type").find({ _limit: -1 });

  // for await (const incomeType of incomesTypes) {
  //   if (incomeType.vat_pct === null) {
  //     if (incomeType.id === 1) {
  //       await strapi
  //         .query("income-type")
  //         .update({ id: incomeType.id }, { vat_pct: 21 });
  //     }
  //     if (incomeType.id === 2) {
  //       await strapi
  //         .query("income-type")
  //         .update({ id: incomeType.id }, { vat_pct: 0 });
  //     }
  //     if (incomeType.id === 3) {
  //       await strapi
  //         .query("income-type")
  //         .update({ id: incomeType.id }, { vat_pct: 0 });
  //     }
  //     if (incomeType.id === 4) {
  //       await strapi
  //         .query("income-type")
  //         .update({ id: incomeType.id }, { vat_pct: 21 });
  //     }
  //   }
  // }

  // const sql1 = `UPDATE components_project_phase_original_project_phases_components SET field = 'incomes' WHERE field = 'subphases';`;
  // await strapi.connections.default.raw(sql1);

  // const sql2 = `UPDATE components_project_phase_project_phases_components SET field = 'incomes' WHERE field = 'subphases';`;
  // await strapi.connections.default.raw(sql2);

  // const projectStates = await strapi
  //   .query("project-state")
  //   .find({ _limit: -1 });
  // for await (const projectState of projectStates) {
  //   if (projectState.id === 1 && projectState.can_assign_activities === null) {
  //     await strapi
  //       .query("project-state")
  //       .update({ id: projectState.id }, { can_assign_activities: true });
  //   }
  // }

  // const festives = await strapi.query("festive").find({ _limit: -1 });

  // const festives2025 = [
  //   { date: "2025-01-01", festive_type: 1 },
  //   { date: "2025-01-06", festive_type: 1 },
  //   { date: "2025-04-21", festive_type: 2 },
  //   { date: "2025-05-01", festive_type: 1 },
  //   { date: "2025-06-24", festive_type: 2 },
  //   { date: "2025-08-15", festive_type: 1 },
  //   { date: "2025-09-11", festive_type: 2 },
  //   { date: "2025-12-08", festive_type: 1 },
  //   { date: "2025-12-25", festive_type: 1 },
  //   { date: "2025-12-26", festive_type: 2 },
  // ];

  // // if festives2025 is not in festives, add them
  // for (const festive of festives2025) {
  //   const festiveExists =
  //     festives.filter((f) => f.date === festive.date).length > 0;
  //   if (!festiveExists) {
  //     await strapi
  //       .query("festive")
  //       .create({ date: festive.date, festive_type: festive.festive_type });
  //     console.log("Festive added", festive);
  //   }
  // }

  // const years = await strapi.query("year").find({ _limit: -1 });
  // // if 2025 is not in years, add it
  // const year2025 = years.filter((y) => y.year === 2025);
  // if (year2025.length === 0) {
  //   await strapi
  //     .query("year")
  //     .create({ year: 2025, working_hours: 1760, deductible_vat_pct: 100 });

  //   console.log("year added", 2025);
  // }

  // const series = await strapi.query("serie").find({ _limit: -1 });
  // // if 2025 is not in years, add it
  // const serie2025 = series.filter((s) => s.name === "2025");
  // if (serie2025.length === 0) {
  //   await strapi
  //     .query("serie")
  //     .create({ name: "2025", leadingZeros: 3, emitted_invoice_number: 0 });
  // }

  // await projectController.createPhasesForAllProjects();

  // await strapi.query("phase-expense")
  const allExpenses = await strapi.query("phase-expense").find({ _limit: -1 });
  for (const expense of allExpenses) {
    if (!expense.total_amount && expense.amount) {
      await strapi.query("phase-expense").update(
        { id: expense.id },
        {
          total_amount: expense.amount * expense.quantity,
        }
      )
    }
  }
  const allIncomes = await strapi.query("phase-income").find({ _limit: -1 });
  for (const income of allIncomes) {
    if (!income.total_amount && income.amount) {
      await strapi.query("phase-income").update(
        { id: income.id },
        {
          total_amount: income.amount * income.quantity,
        }
      )
    }
  }
}

module.exports = async () => {
  await importSeedData();
};
