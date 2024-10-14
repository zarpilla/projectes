"use strict";
const { sanitizeEntity } = require("strapi-utils");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  async basic(ctx) {
    // Calling the default core action
    let contacts;

    if (ctx.query._q) {
      contacts = await strapi.query("contacts").search(ctx.query);
    } else {
      contacts = await strapi.query("contacts").find(ctx.query);
    }

    // Removing some info
    const basicContacts = contacts.map(
      ({ projects, projectes, ...item }) => item
    );

    return basicContacts.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models.contacts })
    );
  },
  async withorders(ctx) {
    // Calling the default core action
    const contacts = [];

    console.log("ctx.user", ctx.state.user);

    const orders = await strapi.query("orders").find({ owner: ctx.state.user.id, _limit: -1 });

    for (const order of orders) {
      if (order.contact) {
        const contact = contacts.find(c => c.id === order.contact.id);
        if (!contact) {
          contacts.push(order.contact);
          order.contact.num_orders = 1;
        } else {
          contact.num_orders = contact.num_orders + 1;
        }
      }
    }

    return contacts

  },
};
