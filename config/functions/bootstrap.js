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
    logos: ["find"],
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
      "unify",
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
      "infoall",
      "pdfmultiple",
      "checkmultidelivery",
      "collectionpointroutes"
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
    verifactu: ["find", "findone"],
    "verifactu-declaration": ["find", "findone", "create"],
    "pivot-table-view": ["find", "findone", "create", "update", "delete"],
    "bank-accounts": ["find", "findone"],
    incidences: ["create", "find", "findone", "update", "count", "delete", "infoall"],
    "vat-type": ["find"],
  });

  await setPermissions("authenticated", "upload", {
    upload: ["upload"],
  });

  // Mark all projects as dirty for recalculation after beforeUpdate hook fix
  // CRITICAL FIX: beforeUpdate now loads FULL project before calculating
  // Previously it only had request data (partial fields), causing incorrect totals
  // try {
  //   const allProjects = await strapi.query('project').find({ published_at_null: false, _limit: -1 });
  //   console.log(`[BOOTSTRAP] Found ${allProjects.length} projects to mark as dirty`);
    
  //   for (const project of allProjects) {
  //     // Check if already in dirty queue
  //     const existingQueue = await strapi.query('dirty-queue').findOne({ 
  //       entity: 'project', 
  //       entityId: project.id 
  //     });
      
  //     if (!existingQueue) {
  //       await strapi.query('dirty-queue').create({
  //         entity: 'project',
  //         entityId: project.id
  //       });
  //       // Also set the dirty flag on the project
  //       await strapi.query('project').update(
  //         { id: project.id },
  //         { dirty: true, _internal: true }
  //       );
  //     }
  //   }
    
  //   console.log("[BOOTSTRAP] Added all projects to dirty queue for recalculation");
  // } catch (error) {
  //   console.error("[BOOTSTRAP] Error adding projects to dirty queue:", error);
  // }

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

  // const festives = await strapi
  //   .query("festive")
  //   .find({ users_permissions_user_null: true, _limit: -1 });

  /*

    1 de gener, dijous
    6 de gener, dimarts
    3 d'abril, divendres
    6 d'abril, dilluns
    1 de maig, divendres
    24 de juny, dimecres
    15 d'agost, dissabte
    11 de setembre, divendres
    12 d'octubre, dilluns
    8 de desembre, dimarts
    25 de desembre, divendres
    26 de desembre, dissabte
  */

  // const festives2026 = [
  //   { date: "2026-01-01", festive_type: 1 },
  //   { date: "2026-01-06", festive_type: 1 },
  //   { date: "2026-04-03", festive_type: 1 },
  //   { date: "2026-04-06", festive_type: 2 },
  //   { date: "2026-05-01", festive_type: 1 },
  //   { date: "2026-06-24", festive_type: 2 },
  //   { date: "2026-08-15", festive_type: 1 },
  //   { date: "2026-09-11", festive_type: 2 },
  //   { date: "2026-10-12", festive_type: 1 },
  //   { date: "2026-12-08", festive_type: 1 },
  //   { date: "2026-12-25", festive_type: 1 },
  //   { date: "2026-12-26", festive_type: 2 },
  // ];

  // // if festives2025 is not in festives, add them
  // for (const festive of festives2026) {
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
  // // if 2026 is not in years, add it
  // const year2026 = years.filter((y) => y.year === 2026);
  // if (year2026.length === 0) {
  //   await strapi
  //     .query("year")
  //     .create({ year: 2026, working_hours: 1760, deductible_vat_pct: 100 });

  //   console.log("year added", 2026);
  // }

  // const series = await strapi.query("serie").find({ _limit: -1 });
  // // if 2026 is not in years, add it
  // const serie2026 = series.filter((s) => s.name === "2026");
  // if (serie2026.length === 0) {
  //   await strapi
  //     .query("serie")
  //     .create({ name: "2026", leadingZeros: 3, emitted_invoice_number: 0 });
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
          { state: "real", _internal: true, verifactu: false },
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
      software_address: "",
      software_date: "1 de julio de 2025",
      software_location: "-",
    });
  }
  const verifactuDeclarations = await strapi
    .query("verifactu-declaration")
    .find({ _limit: -1 });
  if (verifactuDeclarations.length === 0) {
    await strapi.query("verifactu-declaration").create({
      version: "2025.06.28",
      url: "https://github.com/zarpilla/projectes/tree/master/public/verifactu",
    });
  }

  // update software_version
  if (verifactu && verifactu.software_version !== "2025.11.18") {
    await strapi
      .query("verifactu")
      .update(
        { id: verifactu.id },
        {
          software_version: "2025.11.18",
          software_date: "18 de noviembre de 2025",
        },
      );
  }

  // insert verifactu-declarations
  const verifactuDeclaration1 = await strapi
    .query("verifactu-declaration")
    .findOne({ version: "2025.08.02" });
  if (!verifactuDeclaration1) {
    await strapi.query("verifactu-declaration").create({
      version: "2025.08.02",
      url: "https://github.com/zarpilla/projectes/tree/master/public/verifactu",
    });
  }

  const verifactuDeclaration2 = await strapi
    .query("verifactu-declaration")
    .findOne({ version: "2025.11.18" });
  if (!verifactuDeclaration2) {
    await strapi.query("verifactu-declaration").create({
      version: "2025.11.18",
      url: "https://github.com/zarpilla/projectes/tree/master/public/verifactu",
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
        },
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
    const paymentMethods = await strapi
      .query("payment-method")
      .find({ _limit: 1 });
    if (paymentMethods.length > 0) {
      await strapi
        .query("payment-method")
        .update({ id: paymentMethods[0].id }, { default: true });
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
      grantable: true,
    });

    // If no grantable projects found, skip migration
    if (projects.length === 0) {
      console.log("No grantable projects found - skipping migration");
      return;
    }

    // Simple check: if we can't query grantable_years, the component doesn't exist yet
    try {
      // Try a simple query to see if grantable_years exists
      await strapi
        .query("project")
        .findOne({ id: projects[0].id }, ["grantable_years"]);
    } catch (err) {
      if (err.message.includes("grantable_years")) {
        console.log(
          "grantable_years component not yet available in database - migration will run later when admin panel has created the component",
        );
        return;
      }
    }

    // Get all years
    const years = await strapi.query("year").find({ _limit: -1 });
    console.log(`Found ${years.length} years`);

    // Get all projects with grantable data
    const allGrantableProjects = await strapi.query("project").find(
      {
        _limit: -1,
        grantable: true,
      },
      ["grantable_years"],
    );

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
        (project.grantable_amount_total &&
          project.grantable_amount_total !== 0) ||
        (project.grantable_amount && project.grantable_amount !== 0) ||
        (project.grantable_structural_expenses_justify_invoices &&
          project.grantable_structural_expenses_justify_invoices !== 0) ||
        (project.grantable_structural_expenses &&
          project.grantable_structural_expenses !== 0) ||
        (project.grantable_cofinancing && project.grantable_cofinancing !== 0);

      if (!hasGrantableData || !project.date_end) {
        continue;
      }

      // Extract year from date_end
      const projectEndYear = project.date_end.substring(0, 4);

      // Find matching year record
      const yearRecord =
        years.find((y) => y.year.toString() === projectEndYear) ||
        years[years.length - 1];

      if (!yearRecord) {
        console.log(
          `Warning: No year record found for ${projectEndYear} (project: ${project.name})`,
        );
        continue;
      }

      // Create grantable_year component data
      const grantableYearData = {
        year: yearRecord.id,
        grantable_amount_total: project.grantable_amount_total || 0,
        grantable_amount: project.grantable_amount || 0,
        grantable_structural_expenses_justify_invoices:
          project.grantable_structural_expenses_justify_invoices || 0,
        grantable_structural_expenses:
          project.grantable_structural_expenses || 0,
        grantable_cofinancing: project.grantable_cofinancing || 0,
      };

      // Update project with grantable_years component
      await strapi.query("project").update(
        { id: project.id },
        {
          grantable_years: [grantableYearData],
        },
      );

      migratedCount++;
      console.log(`Migrated project "${project.name}" (${projectEndYear})`);
    }

    console.log(
      `Migration completed: ${migratedCount} projects migrated, ${skippedCount} projects skipped (already had grantable_years data)`,
    );
  } catch (error) {
    console.error("Error during grantable data migration:", error);
    console.log("Migration will be retried next time the server starts");
  }
}

async function migrateContactInfo() {
  try {
    console.log("Starting contact_info migration...");

    // Helper function to fill contact_info from contact
    const fillContactInfoFromContact = async (contact) => {
      if (!contact) return null;

      // Get the contact ID (handle both object and ID cases)
      const contactId = typeof contact === "object" ? contact.id : contact;

      if (!contactId) return null;

      // Fetch the contact data
      const contactData = await strapi
        .query("contacts")
        .findOne({ id: contactId });

      if (!contactData) return null;

      // Map contact fields to contact_info structure
      return {
        name: contactData.name || null,
        nif: contactData.nif || null,
        address: contactData.address || null,
        postcode: contactData.postcode || null,
        city: contactData.city || null,
        state: contactData.state || null,
        country: contactData.country || null,
      };
    };

    // Helper function to check if contact_info is null or undefined
    const needsContactInfo = (record) => {
      return (
        !record.contact_info ||
        (record.contact_info && Object.keys(record.contact_info).length === 0)
      );
    };

    // Migrate emitted-invoice (only non-draft invoices)
    console.log("Migrating emitted-invoice contact_info...");
    const allEmittedInvoices = await strapi.query("emitted-invoice").find(
      {
        _limit: -1,
        state_ne: "draft",
      },
      ["contact"],
    );

    const emittedInvoicesToMigrate =
      allEmittedInvoices.filter(needsContactInfo);

    let emittedInvoicesMigrated = 0;
    for (const invoice of emittedInvoicesToMigrate) {
      if (invoice.contact) {
        const contactInfo = await fillContactInfoFromContact(invoice.contact);
        if (contactInfo) {
          await strapi
            .query("emitted-invoice")
            .update(
              { id: invoice.id },
              {
                contact_info: contactInfo,
                _internal: true,
                updatable_admin: true,
              },
            );
          emittedInvoicesMigrated++;
        }
      }
    }
    console.log(`Migrated ${emittedInvoicesMigrated} emitted-invoice records`);

    // Migrate received-invoice
    console.log("Migrating received-invoice contact_info...");
    const allReceivedInvoices = await strapi.query("received-invoice").find(
      {
        _limit: -1,
      },
      ["contact"],
    );

    const receivedInvoicesToMigrate =
      allReceivedInvoices.filter(needsContactInfo);

    let receivedInvoicesMigrated = 0;
    for (const invoice of receivedInvoicesToMigrate) {
      if (invoice.contact) {
        const contactInfo = await fillContactInfoFromContact(invoice.contact);
        if (contactInfo) {
          await strapi
            .query("received-invoice")
            .update(
              { id: invoice.id },
              {
                contact_info: contactInfo,
                _internal: true,
                updatable_admin: true,
              },
            );
          receivedInvoicesMigrated++;
        }
      }
    }
    console.log(
      `Migrated ${receivedInvoicesMigrated} received-invoice records`,
    );

    // Migrate received-income
    console.log("Migrating received-income contact_info...");
    const allReceivedIncomes = await strapi.query("received-income").find(
      {
        _limit: -1,
      },
      ["contact"],
    );

    const receivedIncomesToMigrate =
      allReceivedIncomes.filter(needsContactInfo);

    let receivedIncomesMigrated = 0;
    for (const income of receivedIncomesToMigrate) {
      if (income.contact) {
        const contactInfo = await fillContactInfoFromContact(income.contact);
        if (contactInfo) {
          await strapi
            .query("received-income")
            .update(
              { id: income.id },
              {
                contact_info: contactInfo,
                _internal: true,
                updatable_admin: true,
              },
            );
          receivedIncomesMigrated++;
        }
      }
    }
    console.log(`Migrated ${receivedIncomesMigrated} received-income records`);

    // Migrate received-expense
    console.log("Migrating received-expense contact_info...");
    const allReceivedExpenses = await strapi.query("received-expense").find(
      {
        _limit: -1,
      },
      ["contact"],
    );

    const receivedExpensesToMigrate =
      allReceivedExpenses.filter(needsContactInfo);

    let receivedExpensesMigrated = 0;
    for (const expense of receivedExpensesToMigrate) {
      if (expense.contact) {
        const contactInfo = await fillContactInfoFromContact(expense.contact);
        if (contactInfo) {
          await strapi
            .query("received-expense")
            .update(
              { id: expense.id },
              {
                contact_info: contactInfo,
                _internal: true,
                updatable_admin: true,
              },
            );
          receivedExpensesMigrated++;
        }
      }
    }
    console.log(
      `Migrated ${receivedExpensesMigrated} received-expense records`,
    );

    // Migrate quote
    console.log("Migrating quote contact_info...");
    const allQuotes = await strapi.query("quote").find(
      {
        _limit: -1,
      },
      ["contact"],
    );

    const quotesToMigrate = allQuotes.filter(needsContactInfo);

    let quotesMigrated = 0;
    for (const quote of quotesToMigrate) {
      if (quote.contact) {
        const contactInfo = await fillContactInfoFromContact(quote.contact);
        if (contactInfo) {
          await strapi
            .query("quote")
            .update(
              { id: quote.id },
              {
                contact_info: contactInfo,
                _internal: true,
                updatable_admin: true,
              },
            );
          quotesMigrated++;
        }
      }
    }
    console.log(`Migrated ${quotesMigrated} quote records`);

    console.log(
      `Contact info migration completed. Total migrated: ${emittedInvoicesMigrated + receivedInvoicesMigrated + receivedIncomesMigrated + receivedExpensesMigrated + quotesMigrated} records`,
    );
  } catch (error) {
    console.error("Error during contact_info migration:", error);
    console.log("Migration will be retried next time the server starts");
  }
}

async function calculateMotherProjects() {
  try {
    console.log("Starting mother projects calculation...");

    // Get all projects
    const allProjects = await strapi.query("project").find(
      {
        _limit: -1,
        published_at_null: false,
      },
      ["mother"],
    );

    console.log(`Found ${allProjects.length} total projects`);

    // Create a map to count children for each potential mother project
    const motherChildCountMap = new Map();

    // Count children for each mother project
    for (const project of allProjects) {
      if (project.mother) {
        const motherId =
          typeof project.mother === "object"
            ? project.mother.id
            : project.mother;
        if (motherId) {
          motherChildCountMap.set(
            motherId,
            (motherChildCountMap.get(motherId) || 0) + 1,
          );
        }
      }
    }

    console.log(`Found ${motherChildCountMap.size} projects that are mothers`);

    let updatedCount = 0;

    // Only update projects that should be mothers (have children)
    for (const [motherId, childCount] of motherChildCountMap.entries()) {
      const motherProject = allProjects.find((p) => p.id === motherId);

      if (motherProject && !motherProject.is_mother) {
        await strapi
          .query("project")
          .update({ id: motherId }, { is_mother: true, _internal: true });
        updatedCount++;
        console.log(
          `Updated project "${motherProject.name}" to is_mother=true (has ${childCount} children)`,
        );
      }
    }

    console.log(
      `Mother projects calculation completed: ${updatedCount} projects updated`,
    );

  } catch (error) {
    console.error("Error during mother projects calculation:", error);
    console.log("Calculation will be retried next time the server starts");
  }
}

async function recalculatePhaseWarnings() {
  try {
    console.log("Starting phase warnings recalculation...");

    // Get all phase-incomes with null warning
    const nullWarningIncomes = await strapi.query("phase-income").find({
      _limit: -1,
      warning_null: true,
    });

    console.log(`Found ${nullWarningIncomes.length} phase-incomes with null warnings`);

    let incomesUpdated = 0;
    const processedDocuments = new Set(); // Track processed documents to avoid duplicates

    // Process each income
    for (const income of nullWarningIncomes) {
      try {
        let documentId = null;
        let documentType = null;
        let document = null;

        // Determine which document this income is linked to
        if (income.invoice) {
          documentId = typeof income.invoice === 'object' ? income.invoice.id : income.invoice;
          documentType = 'emitted-invoice';
          document = await strapi.query("emitted-invoice").findOne({ id: documentId });
        } else if (income.grant) {
          documentId = typeof income.grant === 'object' ? income.grant.id : income.grant;
          documentType = 'received-grant';
          document = await strapi.query("received-grant").findOne({ id: documentId });
        } else if (income.income) {
          documentId = typeof income.income === 'object' ? income.income.id : income.income;
          documentType = 'received-income';
          document = await strapi.query("received-income").findOne({ id: documentId });
        }

        // Skip if no document linked or already processed
        if (!documentId || !document || !document.total_base) {
          continue;
        }

        const docKey = `${documentType}-${documentId}`;
        if (processedDocuments.has(docKey)) {
          continue; // Already processed this document
        }
        processedDocuments.add(docKey);

        // Find ALL phase-incomes that reference this document across all projects
        let allRelatedIncomes = [];
        
        if (documentType === 'emitted-invoice') {
          allRelatedIncomes = await strapi.query("phase-income").find({
            _limit: -1,
            invoice: documentId
          });
        } else if (documentType === 'received-grant') {
          allRelatedIncomes = await strapi.query("phase-income").find({
            _limit: -1,
            grant: documentId
          });
        } else if (documentType === 'received-income') {
          allRelatedIncomes = await strapi.query("phase-income").find({
            _limit: -1,
            income: documentId
          });
        }

        if (allRelatedIncomes.length === 0) {
          continue;
        }

        // Sum up all assigned amounts
        let totalAssigned = 0;
        allRelatedIncomes.forEach(relatedIncome => {
          const lineTotal = (relatedIncome.quantity || 0) * (relatedIncome.amount || 0);
          totalAssigned += lineTotal;
        });

        // Calculate warning
        const diff = Math.abs(document.total_base - totalAssigned);
        const hasWarning = diff > 0.01;

        // Update ALL related incomes with the same warning value
        for (const relatedIncome of allRelatedIncomes) {
          if (relatedIncome.warning === null || relatedIncome.warning === undefined) {
            await strapi.query("phase-income").update(
              { id: relatedIncome.id },
              { warning: hasWarning }
            );
            incomesUpdated++;
          }
        }

        console.log(`Updated ${allRelatedIncomes.length} incomes for ${documentType} #${documentId} (total: ${document.total_base}, assigned: ${totalAssigned}, warning: ${hasWarning})`);

      } catch (error) {
        console.error(`Error processing income ${income.id}:`, error.message);
      }
    }

    console.log(`Phase-income warnings recalculation completed: ${incomesUpdated} records updated`);

    // Get all phase-expenses with null warning
    const nullWarningExpenses = await strapi.query("phase-expense").find({
      _limit: -1,
      warning_null: true,
    });

    console.log(`Found ${nullWarningExpenses.length} phase-expenses with null warnings`);

    let expensesUpdated = 0;
    const processedExpenseDocuments = new Set(); // Track processed documents to avoid duplicates

    // Process each expense
    for (const expense of nullWarningExpenses) {
      try {
        let documentId = null;
        let documentType = null;
        let document = null;

        // Determine which document this expense is linked to
        if (expense.invoice) {
          documentId = typeof expense.invoice === 'object' ? expense.invoice.id : expense.invoice;
          documentType = 'received-invoice';
          document = await strapi.query("received-invoice").findOne({ id: documentId });
        } else if (expense.expense) {
          documentId = typeof expense.expense === 'object' ? expense.expense.id : expense.expense;
          documentType = 'received-expense';
          document = await strapi.query("received-expense").findOne({ id: documentId });
        } else if (expense.grant) {
          documentId = typeof expense.grant === 'object' ? expense.grant.id : expense.grant;
          documentType = 'received-grant';
          document = await strapi.query("received-grant").findOne({ id: documentId });
        }

        // Skip if no document linked or already processed
        if (!documentId || !document || !document.total_base) {
          continue;
        }

        const docKey = `${documentType}-${documentId}`;
        if (processedExpenseDocuments.has(docKey)) {
          continue; // Already processed this document
        }
        processedExpenseDocuments.add(docKey);

        // Find ALL phase-expenses that reference this document across all projects
        let allRelatedExpenses = [];
        
        if (documentType === 'received-invoice') {
          allRelatedExpenses = await strapi.query("phase-expense").find({
            _limit: -1,
            invoice: documentId
          });
        } else if (documentType === 'received-expense') {
          allRelatedExpenses = await strapi.query("phase-expense").find({
            _limit: -1,
            expense: documentId
          });
        } else if (documentType === 'received-grant') {
          allRelatedExpenses = await strapi.query("phase-expense").find({
            _limit: -1,
            grant: documentId
          });
        }

        if (allRelatedExpenses.length === 0) {
          continue;
        }

        // Sum up all assigned amounts
        let totalAssigned = 0;
        allRelatedExpenses.forEach(relatedExpense => {
          const lineTotal = (relatedExpense.quantity || 0) * (relatedExpense.amount || 0);
          totalAssigned += lineTotal;
        });

        // Calculate warning
        const diff = Math.abs(document.total_base - totalAssigned);
        const hasWarning = diff > 0.01;

        // Update ALL related expenses with the same warning value
        for (const relatedExpense of allRelatedExpenses) {
          if (relatedExpense.warning === null || relatedExpense.warning === undefined) {
            await strapi.query("phase-expense").update(
              { id: relatedExpense.id },
              { warning: hasWarning }
            );
            expensesUpdated++;
          }
        }

        console.log(`Updated ${allRelatedExpenses.length} expenses for ${documentType} #${documentId} (total: ${document.total_base}, assigned: ${totalAssigned}, warning: ${hasWarning})`);

      } catch (error) {
        console.error(`Error processing expense ${expense.id}:`, error.message);
      }
    }

    console.log(`Phase-expense warnings recalculation completed: ${expensesUpdated} records updated`);
    console.log(`Total warnings recalculated: ${incomesUpdated + expensesUpdated} records`);

  } catch (error) {
    console.error("Error during phase warnings recalculation:", error);
    console.log("Recalculation will be retried next time the server starts");
  }
}

async function migrateEstimatedHoursToExecutionPhases() {
  try {
    console.log("Starting estimated_hours migration with per-project checking...");

    // Get all projects with their phases and estimated hours
    const allProjects = await strapi.query("project").find(
      { _limit: -1, published_at_null: false },
      [
        "project_original_phases",
        "project_original_phases.incomes",
        "project_original_phases.incomes.estimated_hours",
        "project_original_phases.incomes.estimated_hours.users_permissions_user",
        "project_phases",
        "project_phases.incomes",
        "project_phases.incomes.estimated_hours",
      ]
    );

    console.log(`Found ${allProjects.length} projects to process`);

    let projectsProcessed = 0;
    let hoursCopied = 0;
    let hoursSkipped = 0;
    let projectsSkipped = 0;
    let projectsAlreadyMigrated = 0;

    for (const project of allProjects) {
      // Skip if no original phases
      if (!project.project_original_phases || project.project_original_phases.length === 0) {
        projectsSkipped++;
        continue;
      }

      // Skip if no execution phases
      if (!project.project_phases || project.project_phases.length === 0) {
        projectsSkipped++;
        continue;
      }

      // Check if THIS specific project already has hours in execution phases
      const existingProjectHours = await strapi.connections.default.raw(`
        SELECT COUNT(*) as count
        FROM estimated_hours eh
        JOIN phase_incomes pi ON eh.phase_income = pi.id
        JOIN project_phases pp ON pi.project_phase = pp.id
        WHERE pp.project = ?
      `, [project.id]);

      const projectHoursCount = existingProjectHours[0][0].count;
      
      if (projectHoursCount > 0) {
        console.log(`Project ${project.id} "${project.name}" already has ${projectHoursCount} hours in execution phases - skipping`);
        projectsAlreadyMigrated++;
        continue;
      }

      let projectHadUpdates = false;

      // Iterate through original phases
      for (const originalPhase of project.project_original_phases) {
        // Find matching execution phase by name
        let executionPhase = project.project_phases.find(
          ep => ep.name === originalPhase.name
        );

        // If no matching phase exists, create a new one for migrated hours
        if (!executionPhase) {
          executionPhase = await strapi.query("project-phases").create({
            name: "Hores previstes migrades",
            project: project.id,
            order: 999, // Put it at the end
          });
          // Add to project's phases array so subsequent iterations can find it
          project.project_phases.push(executionPhase);
          projectHadUpdates = true;
        }

        // Skip if original phase has no incomes
        if (!originalPhase.incomes || originalPhase.incomes.length === 0) {
          continue;
        }

        // Iterate through incomes with estimated_hours
        for (const originalIncome of originalPhase.incomes) {
          if (!originalIncome.estimated_hours || originalIncome.estimated_hours.length === 0) {
            continue;
          }

          // Find matching execution income by concept
          let executionIncome = executionPhase.incomes?.find(
            ei => ei.concept === originalIncome.concept
          );

          // If no matching income exists, create one
          if (!executionIncome) {
            executionIncome = await strapi.query("phase-income").create({
              concept: originalIncome.concept || "Ingrés migrat",
              quantity: originalIncome.quantity || 0,
              amount: originalIncome.amount || 0,
              total_amount: originalIncome.total_amount || 0,
              project_phase: executionPhase.id,
            });
            // Initialize incomes array if it doesn't exist
            if (!executionPhase.incomes) {
              executionPhase.incomes = [];
            }
            executionPhase.incomes.push(executionIncome);
            projectHadUpdates = true;
          }

          // Check if execution income already has estimated_hours
          if (executionIncome.estimated_hours && executionIncome.estimated_hours.length > 0) {
            hoursSkipped += originalIncome.estimated_hours.length;
            // Don't skip - still need to recalculate aggregate!
          } else {
            // Clone estimated_hours to execution phase income
            for (const hour of originalIncome.estimated_hours) {
              // Extract user ID safely - handle null, undefined, empty objects, or numeric IDs
              let userId = null;
              if (hour.users_permissions_user) {
                if (typeof hour.users_permissions_user === 'number') {
                  userId = hour.users_permissions_user;
                } else if (typeof hour.users_permissions_user === 'object' && hour.users_permissions_user.id) {
                  userId = hour.users_permissions_user.id;
                }
              }

              const newHour = {
                users_permissions_user: userId,
                quantity: hour.quantity,
                amount: hour.amount,
                total_amount: hour.total_amount,
                comment: hour.comment || null,
                from: hour.from,
                to: hour.to,
                monthly_quantity: hour.monthly_quantity,
                quantity_type: hour.quantity_type,
                phase_income: executionIncome.id,
              };

              await strapi.query("estimated-hours").create(newHour);
              hoursCopied++;
              projectHadUpdates = true;
            }
          }

          // ALWAYS recalculate total_estimated_hours aggregate field
          const copiedHours = await strapi.query("estimated-hours").find({ phase_income: executionIncome.id });
          const totalHours = copiedHours.reduce((sum, h) => sum + (parseFloat(h.quantity) || 0), 0);
          await strapi.query("phase-income").update(
            { id: executionIncome.id },
            { total_estimated_hours: totalHours }
          );
          projectHadUpdates = true;
        }
      }

      if (projectHadUpdates) {
        projectsProcessed++;
      }
    }

    console.log("Estimated hours migration completed:");
    console.log(`  - Projects processed: ${projectsProcessed}`);
    console.log(`  - Projects already migrated: ${projectsAlreadyMigrated}`);
    console.log(`  - Projects skipped (no phases): ${projectsSkipped}`);
    console.log(`  - Hours copied: ${hoursCopied}`);
    console.log(`  - Hours skipped (already exist): ${hoursSkipped}`);

  } catch (error) {
    console.error("Error during estimated_hours migration:", error);
    console.log("Migration will be retried next time the server starts");
  }
}

async function cleanupDuplicateExecutionPhaseHours() {
  try {
    console.log("Starting cleanup of duplicate execution phase hours...");

    // Get all projects with both original and execution phases
    const allProjects = await strapi.query("project").find(
      { _limit: -1, published_at_null: false },
      [
        "project_original_phases",
        "project_original_phases.incomes",
        "project_original_phases.incomes.estimated_hours",
        "project_phases",
        "project_phases.incomes",
        "project_phases.incomes.estimated_hours",
      ]
    );

    console.log(`Found ${allProjects.length} projects to check`);

    let projectsProcessed = 0;
    let hoursDeleted = 0;
    let incomesCleared = 0;

    for (const project of allProjects) {
      if (!project.project_original_phases || !project.project_phases) {
        continue;
      }

      const isProject236 = project.id === 236;
      if (isProject236) {
        console.log(`\n=== DETAILED LOG FOR PROJECT 236 "${project.name}" ===`);
        console.log(`Original phases (${project.project_original_phases.length}):`);
        project.project_original_phases.forEach(op => {
          console.log(`  - "${op.name}" (raw: "${op.name}", trimmed: "${op.name ? op.name.trim() : ''}", incomes: ${op.incomes?.length || 0})`);
        });
        console.log(`Execution phases (${project.project_phases.length}):`);
        project.project_phases.forEach(ep => {
          console.log(`  - "${ep.name}" (raw: "${ep.name}", trimmed: "${ep.name ? ep.name.trim() : ''}", incomes: ${ep.incomes?.length || 0})`);
        });
      }

      let projectHadChanges = false;

      // Check each execution phase against original phases
      for (const executionPhase of project.project_phases) {
        const executionPhaseName = executionPhase.name ? executionPhase.name.trim() : '';
        
        // Find matching original phase by name
        const matchingOriginalPhase = project.project_original_phases.find(
          op => op.name && op.name.trim() === executionPhaseName
        );

        if (isProject236) {
          console.log(`\n  Checking execution phase "${executionPhase.name}" (trimmed: "${executionPhaseName}")`);
          if (matchingOriginalPhase) {
            console.log(`    -> Found matching original phase: "${matchingOriginalPhase.name}"`);
          } else {
            console.log(`    -> No matching original phase found`);
          }
        }

        if (!matchingOriginalPhase || !executionPhase.incomes || !matchingOriginalPhase.incomes) {
          continue;
        }

        // Check each income in execution phase
        for (const executionIncome of executionPhase.incomes) {
          const executionConcept = executionIncome.concept ? executionIncome.concept.trim() : '';
          
          // Find matching original income by concept
          const matchingOriginalIncome = matchingOriginalPhase.incomes.find(
            oi => oi.concept && oi.concept.trim() === executionConcept
          );

          if (isProject236) {
            console.log(`    Checking income "${executionIncome.concept}" (trimmed: "${executionConcept}")`);
            if (matchingOriginalIncome) {
              console.log(`      -> Found matching original income: "${matchingOriginalIncome.concept}"`);
            } else {
              console.log(`      -> No matching original income found`);
            }
          }

          if (!matchingOriginalIncome) {
            continue;
          }

          // Get hours from both incomes
          const executionHours = await strapi.query("estimated-hours").find({
            phase_income: executionIncome.id,
            _limit: -1
          });

          const originalHours = await strapi.query("estimated-hours").find({
            phase_income: matchingOriginalIncome.id,
            _limit: -1
          });

          if (isProject236) {
            console.log(`      Execution hours: ${executionHours.length}, Original hours: ${originalHours.length}`);
          }

          if (executionHours.length === 0 || originalHours.length === 0) {
            if (isProject236) {
              console.log(`      Skipping - not enough hours to compare`);
            }
            continue;
          }

          // Check if hours are duplicates (same users, quantities, dates)
          let areDuplicates = executionHours.length === originalHours.length;
          
          if (areDuplicates) {
            for (const execHour of executionHours) {
              const userId = typeof execHour.users_permissions_user === 'object' 
                ? execHour.users_permissions_user?.id 
                : execHour.users_permissions_user;
              
              const matchingOrigHour = originalHours.find(oh => {
                const origUserId = typeof oh.users_permissions_user === 'object'
                  ? oh.users_permissions_user?.id
                  : oh.users_permissions_user;
                
                return origUserId === userId &&
                  oh.quantity === execHour.quantity &&
                  oh.amount === execHour.amount &&
                  oh.from === execHour.from &&
                  oh.to === execHour.to;
              });

              if (!matchingOrigHour) {
                areDuplicates = false;
                break;
              }
            }
          }

          if (isProject236) {
            console.log(`      Are duplicates? ${areDuplicates}`);
          }

          // If duplicates found, delete hours from execution phase
          if (areDuplicates) {
            console.log(`  Project ${project.id} "${project.name}": Removing ${executionHours.length} duplicate hours from "${executionPhaseName}" > "${executionConcept}"`);
            
            for (const hour of executionHours) {
              await strapi.query("estimated-hours").delete({ id: hour.id });
              hoursDeleted++;
            }

            // Clear total_estimated_hours
            await strapi.query("phase-income").update(
              { id: executionIncome.id },
              { total_estimated_hours: 0 }
            );
            
            incomesCleared++;
            projectHadChanges = true;
          }
        }
      }

      if (isProject236) {
        console.log(`\n=== END PROJECT 236 LOG ===\n`);
      }

      if (projectHadChanges) {
        projectsProcessed++;
      }
    }

    console.log("Duplicate hours cleanup completed:");
    console.log(`  - Projects processed: ${projectsProcessed}`);
    console.log(`  - Hours deleted: ${hoursDeleted}`);
    console.log(`  - Incomes cleared: ${incomesCleared}`);

  } catch (error) {
    console.error("Error during duplicate hours cleanup:", error);
    console.log("Cleanup will be retried next time the server starts");
  }
}

async function consolidateMigratedHoursPhases() {
  try {
    console.log("Starting consolidation of 'Hores previstes migrades' phases...");

    // Find all execution phases named "Hores previstes migrades"
    const migratedPhases = await strapi.query("project-phases").find(
      { name: "Hores previstes migrades", _limit: -1 },
      ["incomes", "incomes.estimated_hours", "project"]
    );

    console.log(`Found ${migratedPhases.length} 'Hores previstes migrades' phases to consolidate`);

    let phasesProcessed = 0;
    let hoursMoved = 0;
    let phasesDeleted = 0;
    let incomesProcessed = 0;

    for (const migratedPhase of migratedPhases) {
      try {
        const projectId = typeof migratedPhase.project === 'object' ? migratedPhase.project.id : migratedPhase.project;
        
        // Get full project data with all phases
        const project = await strapi.query("project").findOne(
          { id: projectId },
          [
            "project_original_phases",
            "project_original_phases.incomes",
            "project_phases",
            "project_phases.incomes",
            "project_phases.incomes.estimated_hours"
          ]
        );

        if (!project) {
          console.log(`Project ${projectId} not found, skipping phase ${migratedPhase.id}`);
          continue;
        }

        const isProject236 = project.id === 236;

        console.log(`\nProcessing project ${project.id} "${project.name}"`);
        
        if (isProject236) {
          console.log(`\n=== DETAILED CONSOLIDATION LOG FOR PROJECT 236 ===`);
          console.log(`Original phases:`);
          project.project_original_phases?.forEach(op => {
            console.log(`  - "${op.name}" (trimmed: "${op.name ? op.name.trim() : ''}")`);
            op.incomes?.forEach(income => {
              console.log(`    > "${income.concept}" (trimmed: "${income.concept ? income.concept.trim() : ''}")`);
            });
          });
          console.log(`Execution phases (excluding migrated):`);
          project.project_phases?.filter(ep => ep.id !== migratedPhase.id).forEach(ep => {
            console.log(`  - "${ep.name}" (trimmed: "${ep.name ? ep.name.trim() : ''}")`);
            ep.incomes?.forEach(income => {
              console.log(`    > "${income.concept}" (trimmed: "${income.concept ? income.concept.trim() : ''}")`);
            });
          });
          console.log(`Migrated phase incomes:`);
          migratedPhase.incomes?.forEach(income => {
            console.log(`  - "${income.concept}" (trimmed: "${income.concept ? income.concept.trim() : ''}")`);
          });
        }
        
        // Skip if no incomes in migrated phase
        if (!migratedPhase.incomes || migratedPhase.incomes.length === 0) {
          console.log(`  Phase ${migratedPhase.id} has no incomes, deleting empty phase`);
          await strapi.query("project-phases").delete({ id: migratedPhase.id });
          phasesDeleted++;
          continue;
        }

        let phaseHadChanges = false;

        // Process each income in the migrated phase
        for (const migratedIncome of migratedPhase.incomes) {
          // Get all estimated hours for this income
          const estimatedHours = await strapi.query("estimated-hours").find({
            phase_income: migratedIncome.id,
            _limit: -1
          });

          if (isProject236) {
            console.log(`\n  Processing migrated income "${migratedIncome.concept}" (has ${estimatedHours?.length || 0} hours)`);
          }

          if (!estimatedHours || estimatedHours.length === 0) {
            console.log(`  Income ${migratedIncome.id} "${migratedIncome.concept}" has no hours, skipping`);
            continue;
          }

          console.log(`  Processing income "${migratedIncome.concept}" with ${estimatedHours.length} hour entries`);

          // Group estimated hours by year (based on 'from' date)
          const hoursByYear = {};
          for (const hour of estimatedHours) {
            if (hour.from) {
              const year = hour.from.substring(0, 4); // Extract YYYY from date
              if (!hoursByYear[year]) {
                hoursByYear[year] = [];
              }
              hoursByYear[year].push(hour);
            } else {
              // If no 'from' date, put in special group
              if (!hoursByYear['unknown']) {
                hoursByYear['unknown'] = [];
              }
              hoursByYear['unknown'].push(hour);
            }
          }

          if (isProject236) {
            console.log(`    -> Hours grouped by year:`, Object.keys(hoursByYear).map(y => `${y}: ${hoursByYear[y].length}`).join(', '));
          }

          // Process each year group separately
          for (const [year, yearHours] of Object.entries(hoursByYear)) {
            if (isProject236) {
              console.log(`    -> Processing ${yearHours.length} hours for year ${year}`);
            }

            // Find execution phase matching this year
            let targetExecutionPhase = null;
            const migratedConceptTrimmed = migratedIncome.concept ? migratedIncome.concept.trim() : '';

            // If year is 'unknown', try to use the first matching phase
            if (year === 'unknown') {
              // Find the best matching original phase income by concept (with trim)
              for (const originalPhase of project.project_original_phases || []) {
                if (originalPhase.incomes) {
                  const found = originalPhase.incomes.find(
                    oi => oi.concept && oi.concept.trim() === migratedConceptTrimmed
                  );
                  if (found) {
                    const targetPhaseName = originalPhase.name.trim();
                    targetExecutionPhase = project.project_phases.find(
                      ep => ep.name && ep.name.trim() === targetPhaseName && ep.id !== migratedPhase.id
                    );
                    if (targetExecutionPhase) break;
                  }
                }
              }
            } else {
              // Try to find execution phase by year name
              targetExecutionPhase = project.project_phases.find(
                ep => ep.name && ep.name.trim() === year && ep.id !== migratedPhase.id
              );

              if (isProject236) {
                if (targetExecutionPhase) {
                  console.log(`      -> Found execution phase "${targetExecutionPhase.name}" for year ${year}`);
                } else {
                  console.log(`      -> No execution phase found for year ${year}`);
                }
              }

              // If no execution phase with that year name exists, create it
              if (!targetExecutionPhase) {
                console.log(`  Creating new execution phase "${year}" for year-based hours`);
                targetExecutionPhase = await strapi.query("project-phases").create({
                  name: year,
                  project: project.id,
                  order: parseInt(year) - 2020 // Order by year
                });
              }
            }

            if (!targetExecutionPhase) {
              console.log(`  Warning: Could not find or create target phase for year ${year}, skipping ${yearHours.length} hours`);
              continue;
            }

            // Find or create matching income in target phase (with trim)
            const migratedConcept = migratedIncome.concept ? migratedIncome.concept.trim() : '';
            let targetIncome = targetExecutionPhase.incomes?.find(
              ei => ei.concept && ei.concept.trim() === migratedConcept
            );

            if (!targetIncome) {
              console.log(`  Creating new income "${migratedConcept}" in phase "${targetExecutionPhase.name}"`);
              targetIncome = await strapi.query("phase-income").create({
                concept: migratedConcept,
                quantity: migratedIncome.quantity || 0,
                amount: migratedIncome.amount || 0,
                total_amount: migratedIncome.total_amount || 0,
                project_phase: targetExecutionPhase.id,
              });
            }

            // Move estimated hours for this year to target income
            for (const hour of yearHours) {
              await strapi.query("estimated-hours").update(
                { id: hour.id },
                { phase_income: targetIncome.id }
              );
              hoursMoved++;
            }

            // Recalculate total_estimated_hours for target income
            const allTargetHours = await strapi.query("estimated-hours").find({ 
              phase_income: targetIncome.id,
              _limit: -1 
            });
            const totalHours = allTargetHours.reduce((sum, h) => sum + (parseFloat(h.quantity) || 0), 0);
            await strapi.query("phase-income").update(
              { id: targetIncome.id },
              { total_estimated_hours: totalHours }
            );

            console.log(`  Moved ${yearHours.length} hour entries to "${targetExecutionPhase.name}" > "${targetIncome.concept}"`);
            incomesProcessed++;
            phaseHadChanges = true;
          }
        }

        if (phaseHadChanges) {
          phasesProcessed++;
          
          // Check if migrated phase is now empty and delete if so
          const remainingIncomes = await strapi.query("phase-income").find({
            project_phase: migratedPhase.id,
            _limit: -1
          });

          let hasRemainingHours = false;
          for (const income of remainingIncomes) {
            const hours = await strapi.query("estimated-hours").find({
              phase_income: income.id,
              _limit: 1
            });
            if (hours.length > 0) {
              hasRemainingHours = true;
              break;
            }
          }

          if (!hasRemainingHours) {
            // Delete all incomes (they should be empty)
            for (const income of remainingIncomes) {
              await strapi.query("phase-income").delete({ id: income.id });
            }
            // Delete the phase itself
            await strapi.query("project-phases").delete({ id: migratedPhase.id });
            console.log(`  Deleted empty migrated phase ${migratedPhase.id}`);
            phasesDeleted++;
          } else {
            console.log(`  Note: Migrated phase still has some hours that couldn't be moved`);
          }
        }

        if (isProject236) {
          console.log(`\n=== END PROJECT 236 CONSOLIDATION LOG ===\n`);
        }

      } catch (error) {
        console.error(`Error processing migrated phase ${migratedPhase.id}:`, error);
      }
    }

    console.log("\nConsolidation completed:");
    console.log(`  - Phases processed: ${phasesProcessed}`);
    console.log(`  - Incomes processed: ${incomesProcessed}`);
    console.log(`  - Hours moved: ${hoursMoved}`);
    console.log(`  - Empty phases deleted: ${phasesDeleted}`);

  } catch (error) {
    console.error("Error during consolidation of migrated hours phases:", error);
    console.log("Consolidation will be retried next time the server starts");
  }
}

async function cleanupEmptyCollectionOrders() {
  try {
    console.log("Starting cleanup for empty collection orders...");

    const collectionOrders = await strapi.query("orders").find({
      is_collection_order: true,
      _limit: -1,
    });

    let reviewed = 0;
    let updated = 0;

    for (const collectionOrder of collectionOrders) {
      reviewed++;

      const relatedOrders = await strapi.query("orders").find({
        collection_order: collectionOrder.id,
        _limit: 1,
      });

      const hasOrdersInside = relatedOrders && relatedOrders.length > 0;
      const isAlreadyCancelled = collectionOrder.status === "cancelled";

      if (!hasOrdersInside && !isAlreadyCancelled) {
        await strapi.query("orders").update(
          { id: collectionOrder.id },
          {
            kilograms: 0,
            units: 0,
            price: 0,
            status: "cancelled",
            _internal: true,
          },
        );

        updated++;
        console.log(
          `[COLLECTION CLEANUP] Updated empty collection order #${collectionOrder.id}`,
        );
      }
    }

    console.log(
      `[COLLECTION CLEANUP] Done. Reviewed: ${reviewed}, updated: ${updated}`,
    );
  } catch (error) {
    console.error("Error during empty collection order cleanup:", error);
  }
}

async function populateVatTypes() {
  try {
    console.log("Starting VAT types population...");

    const vatValues = [0, 4, 10, 21];
    let createdCount = 0;
    let existingCount = 0;

    for (const value of vatValues) {
      // Check if VAT type already exists
      const existingVatType = await strapi.query("vat-type").findOne({ value });

      if (!existingVatType) {
        await strapi.query("vat-type").create({ value });
        createdCount++;
        console.log(`[VAT TYPES] Created VAT type with value: ${value}`);
      } else {
        existingCount++;
      }
    }

    console.log(
      `[VAT TYPES] Done. Created: ${createdCount}, Already existed: ${existingCount}`
    );
  } catch (error) {
    console.error("Error during VAT types population:", error);
  }
}

async function backfillPhaseVatPercentages() {
  try {
    console.log("Starting VAT percentage backfill for phase incomes and expenses...");

    let updatedIncomes = 0;
    let updatedExpenses = 0;

    // Process phase incomes
    const phaseIncomes = await strapi.query("phase-income").find({ _limit: -1 });
    console.log(`[VAT BACKFILL] Found ${phaseIncomes.length} phase incomes to process`);

    for (const phaseIncome of phaseIncomes) {
      // Skip if vat_pct is already set
      if (phaseIncome.vat_pct !== null && phaseIncome.vat_pct !== undefined) {
        continue;
      }

      let vatPct = 21; // Default value

      // Get the income type
      if (phaseIncome.income_type) {
        const incomeTypeId = typeof phaseIncome.income_type === 'object' 
          ? phaseIncome.income_type.id 
          : phaseIncome.income_type;
        
        const incomeType = await strapi.query("income-type").findOne({ id: incomeTypeId });
        
        if (incomeType && incomeType.vat_pct !== null && incomeType.vat_pct !== undefined) {
          vatPct = incomeType.vat_pct;
        }
      }

      // Update the phase income
      await strapi.query("phase-income").update(
        { id: phaseIncome.id },
        { vat_pct: vatPct }
      );

      updatedIncomes++;
    }

    // Process phase expenses
    const phaseExpenses = await strapi.query("phase-expense").find({ _limit: -1 });
    console.log(`[VAT BACKFILL] Found ${phaseExpenses.length} phase expenses to process`);

    for (const phaseExpense of phaseExpenses) {
      // Skip if vat_pct is already set
      if (phaseExpense.vat_pct !== null && phaseExpense.vat_pct !== undefined) {
        continue;
      }

      let vatPct = 21; // Default value

      // Get the expense type
      if (phaseExpense.expense_type) {
        const expenseTypeId = typeof phaseExpense.expense_type === 'object' 
          ? phaseExpense.expense_type.id 
          : phaseExpense.expense_type;
        
        const expenseType = await strapi.query("expense-type").findOne({ id: expenseTypeId });
        
        if (expenseType && expenseType.vat_pct !== null && expenseType.vat_pct !== undefined) {
          vatPct = expenseType.vat_pct;
        }
      }

      // Update the phase expense
      await strapi.query("phase-expense").update(
        { id: phaseExpense.id },
        { vat_pct: vatPct }
      );

      updatedExpenses++;
    }

    console.log(
      `[VAT BACKFILL] Done. Updated incomes: ${updatedIncomes}, Updated expenses: ${updatedExpenses}`
    );
  } catch (error) {
    console.error("Error during VAT percentage backfill:", error);
  }
}

async function backfillCollectionGroupingFields() {
  try {
    console.log("Starting backfill for missing collection grouping fields...");

    const pickupEnabledRecords = await strapi.query("pickups").find({
      pickup: true,
      _limit: -1,
    });
    const pickupEnabledIds = (pickupEnabledRecords || []).map((record) => record.id);

    if (pickupEnabledIds.length === 0) {
      console.log(
        "[COLLECTION BACKFILL] No pickups with pickup=true found. Skipping backfill.",
      );
      return;
    }

    const batchSize = 200;
    let updated = 0;
    let loop = 0;
    const startedAt = Date.now();

    console.log(
      `[COLLECTION BACKFILL] Config: batchSize=${batchSize}, filters=(status!=cancelled AND missing collection_pickup_route/date AND pickup_in=${pickupEnabledIds.length} pickup-enabled ids)`,
    );

    while (true) {
      loop++;
      const loopStartedAt = Date.now();

      console.log(
        `[COLLECTION BACKFILL] Loop ${loop}: querying missing route batch...`,
      );

      const routeQueryStartedAt = Date.now();
      const missingRouteBatch = await strapi.query("orders").find({
        status_ne: "cancelled",
        "pickup.id_in": pickupEnabledIds,
        collection_pickup_route_null: true,
        route_null: false,
        _sort: "id:ASC",
        _limit: batchSize,
      });
      const routeQueryMs = Date.now() - routeQueryStartedAt;
      console.log(
        `[COLLECTION BACKFILL] Loop ${loop}: missing route batch fetched ${
          (missingRouteBatch || []).length
        } rows in ${routeQueryMs}ms`,
      );

      console.log(
        `[COLLECTION BACKFILL] Loop ${loop}: querying missing date batch...`,
      );

      const dateQueryStartedAt = Date.now();
      const missingDateBatch = await strapi.query("orders").find({
        status_ne: "cancelled",
        "pickup.id_in": pickupEnabledIds,
        collection_pickup_date_null: true,
        estimated_delivery_date_null: false,
        _sort: "id:ASC",
        _limit: batchSize,
      });
      const dateQueryMs = Date.now() - dateQueryStartedAt;
      console.log(
        `[COLLECTION BACKFILL] Loop ${loop}: missing date batch fetched ${
          (missingDateBatch || []).length
        } rows in ${dateQueryMs}ms`,
      );

      const byId = {};
      for (const order of missingRouteBatch || []) {
        byId[order.id] = order;
      }
      for (const order of missingDateBatch || []) {
        byId[order.id] = order;
      }

      const batch = Object.values(byId);
      if (batch.length === 0) {
        const elapsedMs = Date.now() - startedAt;
        console.log(
          `[COLLECTION BACKFILL] Loop ${loop}: no more candidate rows. Finishing. Total updated=${updated}, elapsed=${elapsedMs}ms`,
        );
        break;
      }

      const firstId = batch[0]?.id;
      const lastId = batch[batch.length - 1]?.id;
      console.log(
        `[COLLECTION BACKFILL] Loop ${loop}: merged candidate batch size=${batch.length}, id-range=${firstId}..${lastId}`,
      );

      let updatedThisBatch = 0;
      let skippedThisBatch = 0;
      let processedInBatch = 0;

      for (const order of batch) {
        processedInBatch++;

        const normalizedRouteId =
          normalizeRouteId(order.collection_pickup_route) ||
          normalizeRouteId(order.route);
        const normalizedPickupDate = normalizeDate(
          order.collection_pickup_date || order.estimated_delivery_date,
        );

        const nextData = {};

        if (!order.collection_pickup_route && normalizedRouteId) {
          nextData.collection_pickup_route = normalizedRouteId;
        }

        if (!order.collection_pickup_date && normalizedPickupDate) {
          nextData.collection_pickup_date = normalizedPickupDate;
        }

        if (Object.keys(nextData).length > 0) {
          nextData._internal = true;
          await strapi.query("orders").update({ id: order.id }, nextData);
          updated++;
          updatedThisBatch++;
        } else {
          skippedThisBatch++;
        }

        if (processedInBatch % 50 === 0) {
          console.log(
            `[COLLECTION BACKFILL] Loop ${loop}: processed ${processedInBatch}/${batch.length} rows (updated ${updatedThisBatch}, skipped ${skippedThisBatch})`,
          );
        }
      }

      const loopMs = Date.now() - loopStartedAt;

      console.log(
        `[COLLECTION BACKFILL] Batch ${loop}: scanned ${batch.length}, updated ${updatedThisBatch}, skipped ${skippedThisBatch}, total updated ${updated}, loop time ${loopMs}ms`,
      );

      if (updatedThisBatch === 0) {
        console.log(
          `[COLLECTION BACKFILL] Loop ${loop}: updated 0 rows, stopping to avoid infinite loop`,
        );
        break;
      }
    }

    const totalMs = Date.now() - startedAt;
    console.log(
      `[COLLECTION BACKFILL] Done. Updated: ${updated}. Total time: ${totalMs}ms`,
    );
  } catch (error) {
    console.error("Error during collection grouping backfill:", error);
  }
}

async function runStartupScript(scriptName, scriptHandler, options = {}) {
  const runOnce = options.runOnce !== false;

  const existingRuns = await strapi.query("startup-scripts").find({
    name: scriptName,
    _sort: "id:DESC",
    _limit: 1,
  });

  const lastRun = existingRuns && existingRuns.length > 0 ? existingRuns[0] : null;

  if (runOnce && lastRun && lastRun.end) {
    console.log(
      `[STARTUP SCRIPT] Skipping ${scriptName} (already completed on ${lastRun.end})`,
    );
    return;
  }

  if (runOnce && lastRun && lastRun.start && !lastRun.end) {
    console.log(
      `[STARTUP SCRIPT] Skipping ${scriptName} (found previous run without end: ${lastRun.start})`,
    );
    return;
  }

  const execution = await strapi.query("startup-scripts").create({
    name: scriptName,
    start: new Date(),
  });

  console.log(
    `[STARTUP SCRIPT] Running ${scriptName} (execution #${execution.id})`,
  );

  try {
    await scriptHandler();
    await strapi.query("startup-scripts").update(
      { id: execution.id },
      { end: new Date() },
    );
    console.log(
      `[STARTUP SCRIPT] Completed ${scriptName} (execution #${execution.id})`,
    );
  } catch (error) {
    console.error(
      `[STARTUP SCRIPT] Failed ${scriptName} (execution #${execution.id})`,
      error,
    );
    throw error;
  }
}

const normalizeDate = (value) => {
  if (!value) return null;
  const textValue = String(value);
  return textValue.includes("T") ? textValue.split("T")[0] : textValue;
};

const normalizeRouteId = (value) => {
  if (!value) return null;
  return typeof value === "object" ? value.id : value;
};

const getCollectionRouteId = (order) => {
  return (
    normalizeRouteId(order?.collection_pickup_route) ||
    normalizeRouteId(order?.route)
  );
};

async function ensureCollectionOrderForDate(
  sourceCollectionOrder,
  targetDate,
  targetRouteId,
) {
  const ownerId =
    typeof sourceCollectionOrder.owner === "object"
      ? sourceCollectionOrder.owner?.id
      : sourceCollectionOrder.owner;
  const contactId =
    typeof sourceCollectionOrder.contact === "object"
      ? sourceCollectionOrder.contact?.id
      : sourceCollectionOrder.contact;
  const sourceRouteId = getCollectionRouteId(sourceCollectionOrder);
  const routeId = targetRouteId || sourceRouteId;

  const candidates = await strapi.query("orders").find({
    is_collection_order: true,
    owner: ownerId,
    contact: contactId,
    route: routeId,
    status_ne: "cancelled",
    _sort: "id:ASC",
    _limit: -1,
  });

  const exactDateMatches = (candidates || []).filter(
    (candidate) => {
      const candidateDate = normalizeDate(
        candidate.collection_pickup_date || candidate.estimated_delivery_date,
      );
      const candidateRouteId = getCollectionRouteId(candidate);
      return candidateDate === targetDate && candidateRouteId === routeId;
    },
  );

  if (exactDateMatches.length > 0) {
    return exactDateMatches[0];
  }

  const createData = {
    is_collection_order: true,
    owner: ownerId,
    contact: contactId,
    contact_name: sourceCollectionOrder.contact_name,
    contact_trade_name: sourceCollectionOrder.contact_trade_name,
    contact_nif: sourceCollectionOrder.contact_nif,
    contact_address: sourceCollectionOrder.contact_address,
    contact_postcode: sourceCollectionOrder.contact_postcode,
    contact_city: sourceCollectionOrder.contact_city,
    contact_phone: sourceCollectionOrder.contact_phone,
    contact_legal_form:
      typeof sourceCollectionOrder.contact_legal_form === "object"
        ? sourceCollectionOrder.contact_legal_form?.id
        : sourceCollectionOrder.contact_legal_form,
    contact_notes: sourceCollectionOrder.contact_notes,
    contact_time_slot_1_ini: sourceCollectionOrder.contact_time_slot_1_ini,
    contact_time_slot_1_end: sourceCollectionOrder.contact_time_slot_1_end,
    contact_time_slot_2_ini: sourceCollectionOrder.contact_time_slot_2_ini,
    contact_time_slot_2_end: sourceCollectionOrder.contact_time_slot_2_end,
    contact_pickup_discount: sourceCollectionOrder.contact_pickup_discount || 0,
    route: routeId,
    collection_pickup_route: routeId,
    collection_pickup_date: targetDate,
    estimated_delivery_date: targetDate,
    pickup:
      typeof sourceCollectionOrder.pickup === "object"
        ? sourceCollectionOrder.pickup?.id
        : sourceCollectionOrder.pickup,
    collection_point:
      typeof sourceCollectionOrder.collection_point === "object"
        ? sourceCollectionOrder.collection_point?.id
        : sourceCollectionOrder.collection_point,
    delivery_type:
      typeof sourceCollectionOrder.delivery_type === "object"
        ? sourceCollectionOrder.delivery_type?.id
        : sourceCollectionOrder.delivery_type,
    transfer: !!sourceCollectionOrder.transfer,
    transfer_pickup_origin:
      typeof sourceCollectionOrder.transfer_pickup_origin === "object"
        ? sourceCollectionOrder.transfer_pickup_origin?.id
        : sourceCollectionOrder.transfer_pickup_origin,
    transfer_pickup_destination:
      typeof sourceCollectionOrder.transfer_pickup_destination === "object"
        ? sourceCollectionOrder.transfer_pickup_destination?.id
        : sourceCollectionOrder.transfer_pickup_destination,
    status: "pending",
    units: 0,
    kilograms: 0,
    price: 0,
    refrigerated: false,
    comments: "[AUTO-RECONCILE] Created from contaminated collection order",
    _internal: true,
  };

  return strapi.query("orders").create(createData);
}

async function reconcileDateContaminatedCollectionOrders() {
  try {
    console.log("Starting date contamination reconciliation for collection orders...");

    const collectionOrders = await strapi.query("orders").find({
      is_collection_order: true,
      status_ne: "cancelled",
      _limit: -1,
    });

    let contaminatedCount = 0;
    let relinkedCount = 0;

    for (const collectionOrder of collectionOrders) {
      const linkedOrders = await strapi.query("orders").find({
        collection_order: collectionOrder.id,
        status_ne: "cancelled",
        _limit: -1,
      });

      const regularLinkedOrders = (linkedOrders || []).filter(
        (order) => !order.is_collection_order,
      );

      if (regularLinkedOrders.length === 0) {
        continue;
      }

      const linkedByDateAndRoute = {};
      for (const order of regularLinkedOrders) {
        const dateKey = normalizeDate(
          order.collection_pickup_date || order.estimated_delivery_date,
        );
        const routeKey =
          normalizeRouteId(order.collection_pickup_route) ||
          normalizeRouteId(order.route);

        if (!dateKey) {
          continue;
        }
        const bucketKey = `${dateKey}|${routeKey || "null"}`;
        if (!linkedByDateAndRoute[bucketKey]) {
          linkedByDateAndRoute[bucketKey] = {
            dateKey,
            routeKey,
            orders: [],
          };
        }
        linkedByDateAndRoute[bucketKey].orders.push(order);
      }

      const distinctBuckets = Object.keys(linkedByDateAndRoute);
      if (distinctBuckets.length <= 1) {
        continue;
      }

      contaminatedCount++;

      const canonicalDate =
        normalizeDate(
          collectionOrder.collection_pickup_date ||
            collectionOrder.estimated_delivery_date,
        ) || linkedByDateAndRoute[distinctBuckets[0]].dateKey;
      const canonicalRoute = getCollectionRouteId(collectionOrder);
      const canonicalBucket = `${canonicalDate}|${canonicalRoute || "null"}`;

      console.log(
        `[COLLECTION DATE RECONCILE] Collection order #${collectionOrder.id} has mixed buckets: ${distinctBuckets.join(",")}. Canonical bucket: ${canonicalBucket}`,
      );

      for (const bucketKey of distinctBuckets) {
        if (bucketKey === canonicalBucket) {
          continue;
        }

        const bucket = linkedByDateAndRoute[bucketKey];
        const dateKey = bucket.dateKey;
        const routeKey = bucket.routeKey;

        const targetCollectionOrder = await ensureCollectionOrderForDate(
          collectionOrder,
          dateKey,
          routeKey,
        );

        for (const orderToMove of bucket.orders) {
          await strapi.query("orders").update(
            { id: orderToMove.id },
            { collection_order: targetCollectionOrder.id, _internal: true },
          );
          relinkedCount++;
        }

        console.log(
          `[COLLECTION DATE RECONCILE] Moved ${bucket.orders.length} orders from #${collectionOrder.id} to #${targetCollectionOrder.id} for date ${dateKey} route ${routeKey}`,
        );
      }
    }

    console.log(
      `[COLLECTION DATE RECONCILE] Done. Contaminated groups: ${contaminatedCount}, relinked orders: ${relinkedCount}`,
    );
  } catch (error) {
    console.error("Error during collection date contamination reconciliation:", error);
  }
}

async function reconcileDuplicateCollectionOrders() {
  try {
    console.log("Starting duplicate collection orders reconciliation...");

    const collectionOrders = await strapi.query("orders").find({
      is_collection_order: true,
      status_ne: "cancelled",
      _limit: -1,
    });

    const grouped = {};
    for (const co of collectionOrders) {
      const ownerId = typeof co.owner === "object" ? co.owner?.id : co.owner;
      const contactId =
        typeof co.contact === "object" ? co.contact?.id : co.contact;
      const routeId = getCollectionRouteId(co);
      const groupingDate =
        normalizeDate(co.collection_pickup_date || co.estimated_delivery_date) || "";

      const key = `${ownerId}|${contactId}|${routeId}|${groupingDate}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(co);
    }

    let duplicateGroups = 0;
    let relinkedOrders = 0;
    let cancelledDuplicates = 0;

    for (const key of Object.keys(grouped)) {
      const group = grouped[key];

      if (!group || group.length <= 1) {
        continue;
      }

      duplicateGroups++;

      const sorted = [...group].sort((a, b) => a.id - b.id);
      const canonical = sorted[0];
      const duplicates = sorted.slice(1);

      console.log(
        `[COLLECTION RECONCILE] Duplicate group ${key}. Canonical: ${canonical.id}. Duplicates: ${duplicates.map((d) => d.id).join(",")}`,
      );

      for (const duplicate of duplicates) {
        const linkedOrders = await strapi.query("orders").find({
          collection_order: duplicate.id,
          _limit: -1,
        });

        for (const linkedOrder of linkedOrders) {
          if (linkedOrder.is_collection_order) {
            continue;
          }

          await strapi.query("orders").update(
            { id: linkedOrder.id },
            {
              collection_order: canonical.id,
            },
          );
          relinkedOrders++;
        }

        await strapi.query("orders").update(
          { id: duplicate.id },
          {
            status: "cancelled",
            kilograms: 0,
            units: 0,
            price: 0,
            comments: `${duplicate.comments ? `${duplicate.comments}\n` : ""}[AUTO-RECONCILE] Merged into #${canonical.id}`,
            _internal: true,
          },
        );
        cancelledDuplicates++;
      }
    }

    console.log(
      `[COLLECTION RECONCILE] Done. Duplicate groups: ${duplicateGroups}, relinked regular orders: ${relinkedOrders}, cancelled duplicates: ${cancelledDuplicates}`,
    );
  } catch (error) {
    console.error("Error during duplicate collection orders reconciliation:", error);
  }
}

async function reconcileDeliveredCollectionOrders() {
  try {
    console.log("Starting delivered status reconciliation for collection orders...");

    const collectionOrders = await strapi.query("orders").find({
      is_collection_order: true,
      status_ne: "cancelled",
      _limit: -1,
    });

    let reviewed = 0;
    let updated = 0;

    for (const collectionOrder of collectionOrders) {
      reviewed++;

      if (
        collectionOrder.status === "cancelled" ||
        collectionOrder.status === "invoiced" ||
        collectionOrder.status === "delivered"
      ) {
        continue;
      }

      const linkedOrders = await strapi.query("orders").find({
        collection_order: collectionOrder.id,
        status_ne: "cancelled",
        _limit: -1,
      });

      const regularLinkedOrders = (linkedOrders || []).filter(
        (order) => !order.is_collection_order,
      );

      if (regularLinkedOrders.length === 0) {
        continue;
      }

      const allDeliveredOrInvoiced = regularLinkedOrders.every((order) =>
        ["delivered", "invoiced"].includes(order.status),
      );

      if (allDeliveredOrInvoiced && collectionOrder.status !== "delivered") {
        await strapi.query("orders").update(
          { id: collectionOrder.id },
          { status: "delivered", _internal: true },
        );

        updated++;
        console.log(
          `[COLLECTION DELIVERED RECONCILE] Updated collection order #${collectionOrder.id} to delivered`,
        );
      }
    }

    console.log(
      `[COLLECTION DELIVERED RECONCILE] Done. Reviewed: ${reviewed}, updated: ${updated}`,
    );
  } catch (error) {
    console.error(
      "Error during delivered collection orders reconciliation:",
      error,
    );
  }
}

async function markRecentProjectsAsDirty() {
  try {
    console.log("Starting to mark recently updated projects as dirty...");

    // Calculate date 60 days ago
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const isoDate = sixtyDaysAgo.toISOString();

    console.log(`[MARK DIRTY] Querying projects updated after ${isoDate}`);

    // Get all projects updated in the last 60 days
    const recentProjects = await strapi.query("project").find({
      updated_at_gte: isoDate,
      published_at_null: false,
      _limit: -1,
    });

    console.log(`[MARK DIRTY] Found ${recentProjects.length} projects updated in the last 60 days`);

    let markedCount = 0;

    for (const project of recentProjects) {
      await projectController.setDirty(project.id);
      markedCount++;
    }

    console.log(`[MARK DIRTY] Done. Marked ${markedCount} projects as dirty for recalculation`);
  } catch (error) {
    console.error("Error marking recent projects as dirty:", error);
  }
}

async function copyCanAssignActivitiesToDocuments() {
  try {
    console.log("Starting to copy can_assign_activities to can_assign_documents...");

    const projectStates = await strapi.query("project-state").find({ _limit: -1 });

    console.log(`[PROJECT STATE] Found ${projectStates.length} project states to process`);

    let updatedCount = 0;

    for (const state of projectStates) {
      // Copy can_assign_activities value to can_assign_documents
      const canAssignActivities = state.can_assign_activities !== null && state.can_assign_activities !== undefined
        ? state.can_assign_activities
        : false;

      await strapi.query("project-state").update(
        { id: state.id },
        { can_assign_documents: canAssignActivities }
      );

      updatedCount++;
      console.log(`[PROJECT STATE] Updated state "${state.name}" (id: ${state.id}): can_assign_documents = ${canAssignActivities}`);
    }

    console.log(`[PROJECT STATE] Done. Updated ${updatedCount} project states`);
  } catch (error) {
    console.error("Error copying can_assign_activities to can_assign_documents:", error);
  }
}

async function backfillTransferRouteData() {
  try {
    console.log("Starting transfer route data backfill for transfer orders...");

    // Helper function to calculate transfer route based on estimated delivery date
    const calculateTransferRoute = async (estimatedDeliveryDate) => {
      if (!estimatedDeliveryDate) {
        return { transfer_route: null, transfer_route_date: null };
      }

      // Get all active transfer routes
      const transferRoutes = await strapi.query("route").find({
        is_transfer_route: true,
        active: true,
        _limit: -1
      });

      if (!transferRoutes || transferRoutes.length === 0) {
        return { transfer_route: null, transfer_route_date: null };
      }

      // Helper function to get day of week from route
      const getRouteDayOfWeek = (route) => {
        if (route.monday) return 1;
        if (route.tuesday) return 2;
        if (route.wednesday) return 3;
        if (route.thursday) return 4;
        if (route.friday) return 5;
        if (route.saturday) return 6;
        if (route.sunday) return 0; // Sunday is 0 in moment.js
        return -1; // No day configured
      };

      // Start from the estimated delivery date and work backwards
      const moment = require("moment");
      let currentDate = moment(estimatedDeliveryDate);
      let maxIterations = 14; // Check up to 2 weeks back
      let iterations = 0;

      while (iterations < maxIterations) {
        const currentDayOfWeek = currentDate.day();

        // Check if any transfer route operates on this day
        for (const route of transferRoutes) {
          const routeDayOfWeek = getRouteDayOfWeek(route);
          
          if (routeDayOfWeek === currentDayOfWeek) {
            return {
              transfer_route: route.id,
              transfer_route_date: currentDate.format("YYYY-MM-DD")
            };
          }
        }

        // Move to previous day
        currentDate = currentDate.subtract(1, "day");
        iterations++;
      }

      // No transfer route found
      return { transfer_route: null, transfer_route_date: null };
    };

    // Get all orders with transfer=true and status pending or processed
    const transferOrders = await strapi.query("orders").find({
      transfer: true,
      status_in: ["pending", "processed"],
      _limit: -1,
    });

    console.log(`[TRANSFER ROUTE BACKFILL] Found ${transferOrders.length} transfer orders to process`);

    let updatedCount = 0;
    let skippedCount = 0;
    let noRouteFoundCount = 0;

    for (const order of transferOrders) {
      // Skip if both transfer_route and transfer_route_date are already set
      if (order.transfer_route && order.transfer_route_date) {
        skippedCount++;
        continue;
      }

      // Skip if no estimated_delivery_date
      if (!order.estimated_delivery_date) {
        console.log(`[TRANSFER ROUTE BACKFILL] Order #${order.id} has no estimated_delivery_date, skipping`);
        skippedCount++;
        continue;
      }

      // Calculate transfer route
      const transferRouteInfo = await calculateTransferRoute(order.estimated_delivery_date);

      // Update the order if a transfer route was found
      if (transferRouteInfo.transfer_route && transferRouteInfo.transfer_route_date) {
        await strapi.query("orders").update(
          { id: order.id },
          {
            transfer_route: transferRouteInfo.transfer_route,
            transfer_route_date: transferRouteInfo.transfer_route_date,
            _internal: true,
          }
        );

        updatedCount++;
        console.log(
          `[TRANSFER ROUTE BACKFILL] Updated order #${order.id} with transfer_route=${transferRouteInfo.transfer_route}, transfer_route_date=${transferRouteInfo.transfer_route_date}`
        );
      } else {
        noRouteFoundCount++;
        console.log(
          `[TRANSFER ROUTE BACKFILL] No transfer route found for order #${order.id} with delivery date ${order.estimated_delivery_date}`
        );
      }
    }

    console.log(
      `[TRANSFER ROUTE BACKFILL] Done. Updated: ${updatedCount}, Skipped (already has data): ${skippedCount}, No route found: ${noRouteFoundCount}`
    );
  } catch (error) {
    console.error("Error during transfer route data backfill:", error);
  }
}

module.exports = async () => {
  await importSeedData();
  // await migrateGrantableDataToYears();
  // await migrateContactInfo();
  // await calculateMotherProjects();
  // await recalculatePhaseWarnings();
  // await migrateEstimatedHoursToExecutionPhases();
  // await consolidateMigratedHoursPhases();
  // await runStartupScript(
  //   "backfillCollectionGroupingFields",
  //   backfillCollectionGroupingFields,
  //   { runOnce: true },
  // );
  await runStartupScript(
    "populateVatTypes",
    populateVatTypes,
    { runOnce: true },
  );
  await runStartupScript(
    "backfillPhaseVatPercentages",
    backfillPhaseVatPercentages,
    { runOnce: true },
  );
  await runStartupScript(
    "markRecentProjectsAsDirty",
    markRecentProjectsAsDirty,
    { runOnce: true },
  );
  await runStartupScript(
    "copyCanAssignActivitiesToDocuments",
    copyCanAssignActivitiesToDocuments,
    { runOnce: true },
  );
  await runStartupScript(
    "backfillTransferRouteData",
    backfillTransferRouteData,
    { runOnce: true },
  );

  // await reconcileDateContaminatedCollectionOrders();
  // await reconcileDuplicateCollectionOrders();
  // await reconcileDeliveredCollectionOrders();
  // await cleanupEmptyCollectionOrders();
};
