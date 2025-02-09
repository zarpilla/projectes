'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
    findAssigned: async (ctx) => {
        const phases = await strapi.query('phase-expense').find(ctx.query, ["expense", "invoice"]);

        // return ids of incomes and invoices
        const ids = phases.map(phase => {
            return {
                expense: phase.expense && phase.expense.id ? phase.expense.id : null,
                invoice: phase.invoice && phase.invoice.id ? phase.invoice.id : null
            }
        });

        // 
        
        return {
            expenses: ids.filter(id => id.expense).map(expense => expense.expense),
            invoices: ids.filter(id => id.invoice).map(invoice => invoice.invoice)
        }
    }
};
