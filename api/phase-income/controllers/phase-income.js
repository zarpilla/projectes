'use strict';

const { id } = require("date-fns/locale");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
    findAssigned: async (ctx) => {
        const phases = await strapi.query('phase-income').find(ctx.query, ["income", "invoice"]);

        // return ids of incomes and invoices
        const ids = phases.map(phase => {
            return {
                income: phase.income && phase.income.id ? phase.income.id : null,
                invoice: phase.invoice && phase.invoice.id ? phase.invoice.id : null
            }
        });

        // 
        
        return {
            incomes: ids.filter(id => id.income).map(income => income.income),
            invoices: ids.filter(id => id.invoice).map(invoice => invoice.invoice)
        }
    }
};
