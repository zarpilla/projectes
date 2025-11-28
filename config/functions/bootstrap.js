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
  await setPermissions("public", "application", {
    "logos": ["find"]
  });
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
      "payvatids",
      "pdf",
      "sendinvoicebyemail",
      "pendingprovider",
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
      "checkmultidelivery"
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
    "verifactu": ["find", "findone"],
    "verifactu-declaration": ["find", "findone", "create"],
    "pivot-table-view": ["find", "findone", "create", "update", "delete"],
    "bank-accounts": ["find", "findone"],
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

  const festives = await strapi
    .query("festive")
    .find({ users_permissions_user_null: true, _limit: -1 });

  const festives2025 = [
    { date: "2025-01-01", festive_type: 1 },
    { date: "2025-01-06", festive_type: 1 },
    { date: "2025-04-18", festive_type: 1 },
    { date: "2025-04-21", festive_type: 2 },
    { date: "2025-05-01", festive_type: 1 },
    { date: "2025-06-24", festive_type: 2 },
    { date: "2025-08-15", festive_type: 1 },
    { date: "2025-09-11", festive_type: 2 },
    { date: "2025-12-08", festive_type: 1 },
    { date: "2025-12-25", festive_type: 1 },
    { date: "2025-12-26", festive_type: 2 },
  ];

  // if festives2025 is not in festives, add them
  for (const festive of festives2025) {
    const festiveExists =
      festives.filter((f) => f.date === festive.date).length > 0;
    if (!festiveExists) {
      await strapi
        .query("festive")
        .create({ date: festive.date, festive_type: festive.festive_type });
      console.log("Festive added", festive);
    }
  }

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
  // const allExpenses = await strapi.query("phase-expense").find({ _limit: -1 });
  // for (const expense of allExpenses) {
  //   if (!expense.total_amount && expense.amount) {
  //     await strapi.query("phase-expense").update(
  //       { id: expense.id },
  //       {
  //         total_amount: expense.amount * expense.quantity,
  //       }
  //     )
  //   }
  // }
  // const allIncomes = await strapi.query("phase-income").find({ _limit: -1 });
  // for (const income of allIncomes) {
  //   if (!income.total_amount && income.amount) {
  //     await strapi.query("phase-income").update(
  //       { id: income.id },
  //       {
  //         total_amount: income.amount * income.quantity,
  //       }
  //     )
  //   }
  // }

  const allEmittedInvoices = await strapi
    .query("emitted-invoice")
    .find({ _limit: -1, state_null: true });
  for (const invoice of allEmittedInvoices) {
    if (invoice.code && !invoice.state) {
      await strapi
        .query("emitted-invoice")
        .update(
          { id: invoice.id },
          { state: "real", _internal: true, verifactu: false }
        );
    }
  }

  const me = await strapi.query("me").findOne();
  const verifactu = await strapi.query("verifactu").findOne();
  if (!verifactu) {
    await strapi.query("verifactu").create({
      mode: "no",
      software_developerName: "",
      software_developerIrsId: "",
      software_name: "ESSTRAPIS",
      software_version: "2025.06.28",
      software_id: "01",
      software_number: me.nif,
      software_useOnlyVerifactu: true,
      software_useMulti: true,
      software_useCurrentMulti: false,
      software_address: '',
      software_date: '1 de julio de 2025',
      software_location: '-',
    });
  }
  const verifactuDeclarations = await strapi.query("verifactu-declaration").find({ _limit: -1 });
  if (verifactuDeclarations.length === 0) {
    await strapi.query("verifactu-declaration").create({
      version: "2025.06.28",
      url: "https://github.com/zarpilla/projectes/tree/master/public/verifactu"
    });
  }

  // update software_version
  if (verifactu && verifactu.software_version !== "2025.11.18") {
    await strapi.query("verifactu").update(
      { id: verifactu.id },
      { software_version: "2025.11.18", software_date: "18 de noviembre de 2025" }
    );
  }

  // insert verifactu-declarations
  const verifactuDeclaration1 = await strapi.query("verifactu-declaration").findOne({ version: "2025.08.02" });
  if (!verifactuDeclaration1) {
    await strapi.query("verifactu-declaration").create({
      version: "2025.08.02",
      url: "https://github.com/zarpilla/projectes/tree/master/public/verifactu"
    });
  }

  const verifactuDeclaration2 = await strapi.query("verifactu-declaration").findOne({ version: "2025.11.18" });
  if (!verifactuDeclaration2) {
    await strapi.query("verifactu-declaration").create({
      version: "2025.11.18",
      url: "https://github.com/zarpilla/projectes/tree/master/public/verifactu"
    });
  }

  // Create default bank account if no bank accounts exist
  const bankAccounts = await strapi.query("bank-accounts").find({ _limit: 1 });
  if (bankAccounts.length === 0) {
    console.log("No bank accounts found. Creating default bank account...");
    
    // Create default bank account
    const defaultBankAccount = await strapi.query("bank-accounts").create({
      name: "-",
    });
    
    console.log("Default bank account created:", defaultBankAccount.id);
    
    // Update me record with default bank account
    if (me) {
      await strapi.query("me").update(
        { id: me.id },
        {
          bank_account_payroll: defaultBankAccount.id,
          bank_account_ss: defaultBankAccount.id,
          bank_account_irpf: defaultBankAccount.id,
          bank_account_default: defaultBankAccount.id,
          bank_account_vat: defaultBankAccount.id,
        }
      );
      console.log("Updated me record with default bank account references");
    }
    /*
    await strapi.connections.default.raw("UPDATE phase_expenses SET bank_account = ?;", [defaultBankAccount.id]);
    
    await strapi.connections.default.raw("UPDATE phase_incomes SET bank_account = ?;", [defaultBankAccount.id]);
    
    await strapi.connections.default.raw("UPDATE payrolls SET bank_account = ?;", [defaultBankAccount.id]);

    await strapi.connections.default.raw("UPDATE payment_methods SET bank_account = ?;", [defaultBankAccount.id]);

    await strapi.connections.default.raw("UPDATE emitted_invoices SET bank_account = ?;", [defaultBankAccount.id]);

    await strapi.connections.default.raw("UPDATE received_invoices SET bank_account = ?;", [defaultBankAccount.id]);
    
    await strapi.connections.default.raw("UPDATE received_expenses SET bank_account = ?;", [defaultBankAccount.id]);
    
    await strapi.connections.default.raw("UPDATE received_incomes SET bank_account = ?;", [defaultBankAccount.id]);
    
    await strapi.connections.default.raw("UPDATE treasuries SET bank_account = ?;", [defaultBankAccount.id]);
    */

    // update first payment method with default 
    const paymentMethods = await strapi.query("payment-method").find({ _limit: 1 });
    if (paymentMethods.length > 0) {
      await strapi.query("payment-method").update(
        { id: paymentMethods[0].id },
        { default: true }
      );
      console.log("Updated first payment method with default bank account");
    }

    console.log("Default bank account setup completed");
  }
}

async function migrateGrantableDataToYears() {
  try {
    console.log("Starting grantable data migration...");
    
    // Check if migration has already been performed by looking for a simple marker
    // We'll check if any project has both old and new data structure inconsistency
    const projects = await strapi.query("project").find({
      _limit: 10,
      grantable: true
    });
    
    // If no grantable projects found, skip migration
    if (projects.length === 0) {
      console.log("No grantable projects found - skipping migration");
      return;
    }
    
    // Simple check: if we can't query grantable_years, the component doesn't exist yet
    try {
      // Try a simple query to see if grantable_years exists
      await strapi.query("project").findOne({ id: projects[0].id }, ["grantable_years"]);
    } catch (err) {
      if (err.message.includes('grantable_years')) {
        console.log("grantable_years component not yet available in database - migration will run later when admin panel has created the component");
        return;
      }
    }
    
    // Get all years
    const years = await strapi.query("year").find({ _limit: -1 });
    console.log(`Found ${years.length} years`);
    
    // Get all projects with grantable data
    const allGrantableProjects = await strapi.query("project").find({
      _limit: -1,
      grantable: true
    }, ["grantable_years"]);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const project of allGrantableProjects) {
      // Skip if project already has grantable_years data
      if (project.grantable_years && project.grantable_years.length > 0) {
        skippedCount++;
        continue;
      }
      
      // Check if project has any non-zero grantable data
      const hasGrantableData = 
        (project.grantable_amount_total && project.grantable_amount_total !== 0) ||
        (project.grantable_amount && project.grantable_amount !== 0) ||
        (project.grantable_structural_expenses_justify_invoices && project.grantable_structural_expenses_justify_invoices !== 0) ||
        (project.grantable_structural_expenses && project.grantable_structural_expenses !== 0) ||
        (project.grantable_cofinancing && project.grantable_cofinancing !== 0);
      
      if (!hasGrantableData || !project.date_end) {
        continue;
      }
      
      // Extract year from date_end
      const projectEndYear = project.date_end.substring(0, 4);
      
      // Find matching year record
      const yearRecord = years.find(y => y.year.toString() === projectEndYear) || years[years.length - 1];
      
      if (!yearRecord) {
        console.log(`Warning: No year record found for ${projectEndYear} (project: ${project.name})`);
        continue;
      }
      
      // Create grantable_year component data
      const grantableYearData = {
        year: yearRecord.id,
        grantable_amount_total: project.grantable_amount_total || 0,
        grantable_amount: project.grantable_amount || 0,
        grantable_structural_expenses_justify_invoices: project.grantable_structural_expenses_justify_invoices || 0,
        grantable_structural_expenses: project.grantable_structural_expenses || 0,
        grantable_cofinancing: project.grantable_cofinancing || 0
      };
      
      // Update project with grantable_years component
      await strapi.query("project").update(
        { id: project.id },
        {
          grantable_years: [grantableYearData]
        }
      );
      
      migratedCount++;
      console.log(`Migrated project "${project.name}" (${projectEndYear})`);
    }
    
    console.log(`Migration completed: ${migratedCount} projects migrated, ${skippedCount} projects skipped (already had grantable_years data)`);
    
  } catch (error) {
    console.error("Error during grantable data migration:", error);
    console.log("Migration will be retried next time the server starts");
  }
}

module.exports = async () => {
  await importSeedData();
  await migrateGrantableDataToYears();
};
