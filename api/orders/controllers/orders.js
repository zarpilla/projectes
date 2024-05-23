"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  createCSV: async (ctx) => {
    const order = ctx.request.body;
    delete order.id;
    order.pickup = order.pickup.id;
    order.delivery_type = order.delivery_type.id;
    order.owner = order.owner.id;
    order.route = order.route.id;
    order.route_rate = order.route_rate.id;
    order.status = "pending";
    order.comments = order.notes;
    if (order.contact && order.contact.id) {
      order.contact = order.contact.id;
    } else {
      if (order.contact) {
        if (!order.contact.time_slot_1_ini) {
          order.contact.time_slot_1_ini = null;
        }
        if (!order.contact.time_slot_1_end) {
          order.contact.time_slot_1_end = null;
        }
        if (!order.contact.time_slot_2_ini) {
          order.contact.time_slot_2_ini = null;
        }
        if (!order.contact.time_slot_2_end) {
          order.contact.time_slot_2_end = null;
        }
      }

      if (order.contact && !order.contact.contact_nif) {
        order.contact.owner = order.owner;
        const contact = await strapi.services.contacts.create(order.contact);
        order.contact = contact.id;
      } else {
        order.contact.contact_nif = order.contact.contact_nif.trim();
        const contact = await strapi.services.contacts.find({
          owner: order.owner,
          nif: order.contact.nif,
        });
        if (contact.length > 0) {
          order.contact = contact[0].id;
        } else {
          order.contact.owner = order.owner;

          // console.log('order.contact 1', order.contact)
          const contact = await strapi.services.contacts.create(order.contact);
          order.contact = contact.id;
        }
      }
    }

    if (!order.contact_time_slot_1_ini) {
      order.contact_time_slot_1_ini = null;
    }
    if (!order.contact_time_slot_1_end) {
      order.contact_time_slot_1_end = null;
    }
    if (!order.contact_time_slot_2_ini) {
      order.contact_time_slot_2_ini = null;
    }
    if (!order.contact_time_slot_2_end) {
      order.contact_time_slot_2_end = null;
    }
    const createdOrder = await strapi.services.orders.create(order);

    return createdOrder;
  },
  invoice: async (ctx) => {
    const { orders } = ctx.request.body;

    const year = new Date().getFullYear();
    const serial = await strapi.query("serie").find({ name: year });
    if (serial.length === 0) {
      ctx.send(
        { done: false, message: "ERROR. No hi ha sèrie per a l'any " + year },
        500
      );
      return;
    }

    const ordersEntities = await strapi.query("orders").find({ id_in: orders });

    const uniqueOwners = ordersEntities
      .map((o) => o.owner.id)
      .filter((value, index, self) => self.indexOf(value) === index);

    const allContacts = [];
    for (const owner of uniqueOwners) {
      const contacts = await strapi
        .query("contacts")
        .find({ users_permissions_user: owner });
      if (contacts.length === 0) {
        ctx.badRequest("name is missing", { foo: "bar" });
        ctx.send(
          {
            done: false,
            message: "ERROR. No hi ha contactes per a l'usuari " + owner,
          },
          500
        );
        return;
      }
      const contact = contacts[0];
      allContacts.push(contact);
    }

    const invoices = [];
    for (const owner of uniqueOwners) {
      const contact = allContacts.find(
        (c) => c.users_permissions_user.id === owner
      );
      const contactOrders = ordersEntities.filter((o) => o.owner.id === owner);
      const uniqueProjects = ordersEntities
        .filter((o) => o.owner.id === owner)
        .map((o) => o.route.project)
        .filter((value, index, self) => self.indexOf(value) === index);
      const emittedInvoice = {
        emitted: new Date(),
        serial: serial[0].id,
        contact: contact.id,
        lines: contactOrders.map((o) => {
          return {
            concept: `Comanda #${o.id.toString().padStart(4, "0")}# ${
              o.route.name
            } ${o.pickup.name} ${o.refrigerated ? "Refrigerada" : ""}`,
            base: o.price,
            quantity: 1,
            price: o.price,
            vat: 21,
            irpf: 0,
            discount: 0,
          };
        }),
        projects: uniqueProjects,
      };
      const invoice = await strapi
        .query("emitted-invoice")
        .create(emittedInvoice);
      invoices.push(invoice);
      for (const o of contactOrders) {
        await strapi
          .query("orders")
          .update({ id: o.id }, { invoice: invoice.id, status: "invoiced" });
      }
      for (const p of uniqueProjects) {
        // const total = contactOrders.filter((o) => o.route.project === p).reduce((acc, o) => {
        //   return acc + o.price;
        // }, 0);

        const project = await strapi.query("project").findOne({ id: p });

        if (!project.phases || project.phases.length === 0) {
          ctx.send(
            {
              done: false,
              message: "ERROR. No hi ha fases per al projecte " + project.name,
            },
            500
          );
        }

        const phase = project.phases[project.phases.length - 1];

        for (const o of contactOrders.filter((o) => o.route.project === p )){
          phase.incomes.push({
            concept: `Comanda #${o.id.toString().padStart(4, "0")}# - ${contact.name}`,
            quantity: 1,
            amount: o.price,
            total_amount: o.price,
            date: new Date(),
            income_type: 1,
            invoice: invoice.id,
          })
        }

        await strapi.query("project").update({ id: p }, { phases: project.phases });

      }
    }

    ctx.send({
      orders: orders,
      ordersEntities,
      serial,
      uniqueOwners,
      allContacts,
      invoices,
    });
  },
};
