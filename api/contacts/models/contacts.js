'use strict';


/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeDelete(params) {
            const id = params.id;
            const projects = await strapi.query('project').findOne({ 'clients.id': id });
            const intercooperations = await strapi.query('project').findOne({ 'intercooperations.id': id });
            const orders = await strapi.query('orders').findOne({ 'contact.id': id });
            const invoices = await strapi.query('emitted-invoice').findOne({ 'contact.id': id });
            const incomes = await strapi.query('received-income').findOne({ 'contact.id': id });
            const received = await strapi.query('received-invoice').findOne({ 'contact.id': id });
            const expenses = await strapi.query('received-expense').findOne({ 'contact.id': id });
            const leaders = await strapi.query('project').findOne({ 'grantable_leader.id': id });
            const quotes = await strapi.query('quote').findOne({ 'contact.id': id });
            if (projects || intercooperations || orders || invoices || incomes || received || expenses || leaders || quotes) {
                throw new Error('You cannot delete this contact');
            }
          },
        }
};
