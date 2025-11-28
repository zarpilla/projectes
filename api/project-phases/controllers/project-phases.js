"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async find(ctx) {
    const projectPhases = await strapi
      .query("project-phases")
      .find(ctx.query, [
        "incomes",        
        "incomes.income_type",
        "incomes.invoice",
        "incomes.income",
        "incomes.bank_account",
        "expenses",
        "expenses.invoice",
        "expenses.expense",
        "expenses.expense_type",
        "expenses.bank_account",
      ]);

    return projectPhases;
  },
};
