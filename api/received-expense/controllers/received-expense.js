"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

// Reuse the same PDF upload handler implemented for received-invoices, since
// both document types share the same fields and parsing pipeline.
const receivedInvoiceController = require("../../received-invoice/controllers/received-invoice");

module.exports = {
  async findBasic(ctx) {
    return await strapi
      .query("received-expense")
      .find(ctx.query, ["contact", "projects", "document_type"]);
  },

  /**
   * POST /received-expenses/upload
   *
   * Delegates to the received-invoice `upload` handler: it parses the uploaded
   * PDF with the same Z.ai pipeline and returns the structured invoice JSON.
   * The client then applies the data to the received-expense form.
   */
  upload: receivedInvoiceController.upload,
};
