"use strict";
const { sanitizeEntity } = require("strapi-utils");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async findWithHours(ctx) {
    const projectOriginalPhases = await strapi
      .query("project-original-phases")
      .find(ctx.query, [
        "incomes",
        "incomes.estimated_hours",
        "incomes.income_type",
        "incomes.invoice",
        "incomes.income",
        "incomes.estimated_hours.users_permissions_user",
        "expenses",
        "expenses.invoice",
        "expenses.expense",
        "expenses.expense_type",
      ]);

    return projectOriginalPhases;
  },
};
