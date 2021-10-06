'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
    payExpense: async ctx => {
        const { id, expense } = ctx.params;
        const project = await strapi.query('project').findOne({ id });
        var found = false
        if (project && project.id) {
            project.phases.forEach(ph => {
                const expenseItem = ph.expenses.find(e => e.id == expense)
                if (expenseItem) {
                    found = true
                    expenseItem.paid = true
                    if (ctx.request.body.received && ctx.request.body.received.id) {
                        expenseItem.invoice = ctx.request.body.received.id
                    }
                    if (ctx.request.body.ticket && ctx.request.body.ticket.id) {
                        expenseItem.ticket = ctx.request.body.ticket.id
                    }
                    if (ctx.request.body.diet && ctx.request.body.diet.id) {
                        expenseItem.diet = ctx.request.body.diet.id
                    }
                }
            })
            if (found) {
                const projectToUpdate = { phases: project.phases }
                await strapi.query('project').update({ id: id }, projectToUpdate);
            }
        }
        return { id, expense, found };
    },
    payIncome: async ctx => {
        const { id, income } = ctx.params;
        const project = await strapi.query('project').findOne({ id });
        var found = false
        if (project && project.id) {
            project.phases.forEach(ph => {
                const incomeItem = ph.subphases.find(e => e.id == income)
                if (incomeItem) {
                    found = true
                    incomeItem.paid = true
                    if (ctx.request.body.emitted && ctx.request.body.emitted.id) {
                        incomeItem.emitted = ctx.request.body.emitted.id
                    }
                    if (ctx.request.body.ticket && ctx.request.body.grant.id) {
                        incomeItem.grant = ctx.request.body.ticket.id
                    }
                }
            })
            if (found) {
                const projectToUpdate = { phases: project.phases }
                await strapi.query('project').update({ id: id }, projectToUpdate);
            }
        }
        return { id, income, found };
    }
};
