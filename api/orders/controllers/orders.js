'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
    createCSV: async (ctx) => {
        const order = ctx.request.body;
        delete order.id
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
            if (order.contact && !order.contact.contact_nif) {                
                order.contact.owner = order.owner
                console.log('order.contact 0', order.contact)
                const contact = await strapi.services.contacts.create(order.contact);
                order.contact = contact.id
            } else {
                order.contact.contact_nif = order.contact.contact_nif.trim()
                const contact = await strapi.services.contacts.find({ owner: order.owner, nif: order.contact.nif });
                if (contact.length > 0) {
                    order.contact = contact[0].id
                } else {
                    order.contact.owner = order.owner

                    console.log('order.contact 1', order.contact)
                    const contact = await strapi.services.contacts.create(order.contact);
                    order.contact = contact.id                
                }
            }
        }
        const createdOrder = await strapi.services.orders.create(order);


        return createdOrder
    }
};
