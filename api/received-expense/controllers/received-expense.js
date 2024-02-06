"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async findBasic(ctx) {
    return await strapi
      .query("received-expense")
      .find(ctx.query, ["contact", "projects", "document_type"]);
  },
};
