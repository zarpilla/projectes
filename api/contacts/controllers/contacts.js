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
  async orders(ctx) {
    // Calling the default core action
    const contacts = [];

    const orders = await strapi.query("orders").find({ _limit: -1 });

    for (const order of orders) {
      if (order.contact) {
        const contact = contacts.find((c) => c.id === order.contact.id);
        if (!contact) {
          contacts.push({ id: order.contact.id, num_orders: 1 });
          // order.contact.num_orders = 1;
        } else {
          contact.num_orders = contact.num_orders + 1;
        }
      }
    }

    return contacts;
  },
  async withorders(ctx) {
    // Calling the default core action
    const contacts = [];

    let contactFilter = {};
    if (ctx.query.contact_id) {
      contactFilter = { contact: ctx.query.contact_id };
    }

    const orders = await strapi
      .query("orders")
      .find({ owner: ctx.state.user.id, ...contactFilter, _limit: -1 });

    for (const order of orders) {
      if (order.contact) {
        const contact = contacts.find((c) => c.id === order.contact.id);
        if (!contact) {
          contacts.push(order.contact);
          order.contact.num_orders = 1;
        } else {
          contact.num_orders = contact.num_orders + 1;
        }
        const contact2 = contacts.find((c) => c.id === order.contact.id);
        contact2.can_edit =
          contact2.can_edit || ["delivered", "invoiced"].includes(order.status);
      }
    }

    return contacts;
  },
};
