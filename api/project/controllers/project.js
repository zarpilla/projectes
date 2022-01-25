'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */


let doProjectInfoCalculations = async (data, id) => {
    
    if (!id) {
        return
    }

    data.total_incomes = 0;
    data.total_expenses = 0;
    data.total_expenses_hours = 0;
    data.total_estimated_hours = 0
    data.estimated_balance = 0
    data.total_estimated_expenses = 0

    if (data.expenses && data.expenses.length) {
        let total_expenses = 0
        data.expenses.forEach(i => {
            i.total_amount = (i.quantity ? i.quantity : 0 ) * (i.amount ? i.amount : 0);
            i.tax_amount = i.total_amount * (i.tax_pct ? i.tax_pct : 0) / 100.0;
            i.total_amount = i.total_amount + i.tax_amount
            total_expenses += i.total_amount;
        })
        data.total_expenses = total_expenses;
    }

    if (data.incomes && data.incomes.length) {
        let total_incomes = 0
        data.incomes.forEach(i => {
            i.total_amount = (i.quantity ? i.quantity : 0 ) * (i.amount ? i.amount : 0);
            total_incomes += i.total_amount;
        })
        data.total_incomes = total_incomes
    }

    var estimated_hours = 0
    var total_incomes = 0
    var total_estimated_hours_price = 0
    let total_expenses = 0
    // console.log('data.phases', data.phases)
    if (data.phases && data.phases.length) {
        for (var i = 0; i < data.phases.length; i++) {
            const phase = data.phases[i]
            // var phase_estimated_hours = 0
            if (phase.subphases && phase.subphases.length) {
                for (var j = 0; j < phase.subphases.length; j++) {
                    const subphase = phase.subphases[j]
                    var subphase_estimated_hours = 0
                    var subphase_total_amount = 0
                    if (subphase.quantity && subphase.amount) {
                        subphase.total_amount = subphase.quantity * subphase.amount
                        total_incomes += subphase.quantity * subphase.amount
                    }
                    if (subphase.estimated_hours) {
                        for (var k = 0; k < subphase.estimated_hours.length; k++) {
                            const hours = subphase.estimated_hours[k]
                            subphase_estimated_hours += hours.quantity
                            // console.log('hours', hours)
                            estimated_hours += hours.quantity
                            if (hours.quantity && hours.amount) {
                                hours.total_amount = hours.quantity * hours.amount
                                total_estimated_hours_price += hours.total_amount
                            }
                        }
                        subphase.total_estimated_hours = subphase_estimated_hours
                    }
                }
            }
            if (phase.expenses && phase.expenses.length) {
                for (var j = 0; j < phase.expenses.length; j++) {
                    const expense = phase.expenses[j]
                    if (expense.quantity && expense.amount) {
                        expense.total_amount = expense.quantity * expense.amount
                        total_expenses += expense.quantity * expense.amount
                    }
                }
                data.total_expenses = total_expenses;
            }
        }

        data.total_expenses = total_expenses;
        data.total_incomes = total_incomes;
        data.total_estimated_hours = estimated_hours;
    }

    const promises = []

    promises.push(strapi.query('emitted-invoice').find({ project: id, _limit: -1 }))
    promises.push(strapi.query('received-grant').find({ project: id, _limit: -1 }))
    promises.push(strapi.query('received-invoice').find({ project: id, _limit: -1 }))
    promises.push(strapi.query('activity').find({ project: id, _limit: -1 }))
    promises.push(strapi.query('ticket').find({ project: id, _limit: -1 }))
    promises.push(strapi.query('diet').find({ project: id, _limit: -1 }))
    promises.push(strapi.query('emitted-grant').find({ project: id, _limit: -1 }))

    const results = await Promise.all(promises)

    const emittedInvoices = results[0];
    const receivedGrants = results[1];
    const receivedInvoices = results[2];
    const activities = results[3];
    const tickets = results[4];
    const diets = results[5];
    const emittedGrants = results[6];

    data.total_real_hours = _.sumBy(activities, 'hours')   
    data.total_real_incomes = _.sumBy(emittedInvoices, 'total_base') + _.sumBy(receivedGrants, 'total')
    data.total_real_expenses = _.sumBy(receivedInvoices, 'total_base') + _.sumBy(tickets, 'total') + _.sumBy(diets, 'total') + _.sumBy(emittedGrants, 'total')
    const activities_price = activities.map(a => { return { cost: a.hours * a.cost_by_hour } })    
    data.total_real_hours_price = _.sumBy(activities_price, 'cost')
    data.total_real_incomes_expenses = data.total_real_incomes - data.total_real_expenses - data.total_real_hours_price
    
    if (data.structural_expenses_pct) {
        data.total_expenses = data.total_expenses + data.structural_expenses_pct / 100 * data.total_incomes
        data.incomes_expenses = data.total_incomes - data.total_expenses - data.total_estimated_expenses
        data.total_real_expenses = data.total_real_expenses + data.structural_expenses_pct / 100 * data.total_real_incomes
        data.total_real_incomes_expenses = data.total_real_incomes - data.total_real_expenses - data.total_real_hours_price
    }

    if (data.structural_expenses === true) {
        const indirects = await strapi.query('project').find({ structural_expenses_pct_gt: 0 });
        const indirectIncomes = _.sumBy(indirects.map(i => { return { indirect: i.structural_expenses_pct / 100 * i.total_incomes } }), 'indirect')
        const indirectIncomesReal = _.sumBy(indirects.map(i => { return { indirect: i.structural_expenses_pct / 100 * i.total_real_incomes } }), 'indirect')
        data.total_incomes = data.total_incomes + indirectIncomes
        data.incomes_expenses = data.incomes_expenses + indirectIncomes
        data.total_real_incomes = data.total_real_incomes + indirectIncomesReal
    }

    data.total_real_incomes_expenses = data.total_real_incomes - data.total_real_expenses - data.total_real_hours_price

    data.total_estimated_hours_price = total_estimated_hours_price
    data.balance = data.total_incomes - data.total_expenses - data.total_expenses_hours
    data.estimated_balance = data.total_incomes - data.total_expenses - data.total_estimated_expenses
    data.incomes_expenses = data.total_incomes - data.total_expenses - data.total_estimated_hours_price

    if (!data.leader || !data.leader.id) {
        delete data.leader
    }
    return data
}


let projectsQueue = []


let updateProjectInfo = async id => {        
    const data = await strapi.query('project').findOne({ id });
    const info = await doProjectInfoCalculations(data, id)
    // console.log('info', info)
    await strapi.query('project').update({ id: id }, info);
    console.log('updateProjectInfo', id)
    return { id };
}


module.exports = {

    async findWithBasicInfo(ctx) {        
        // Calling the default core action
        let projects
        if (ctx.query._q) {
            projects = await await strapi.query('project').search(ctx.query);
        }
        else {
            projects = await await strapi.query('project').find(ctx.query);
        }
         
        // Removing some info
        const newArray = projects.map(({ phases, activities, emitted_invoices, received_invoices, tickets, diets, emitted_grants, received_grants, quotes, ingressos_rebuts, ...item }) => item)
        return newArray.map(entity => sanitizeEntity(entity, { model: strapi.models.project }));        
    },

    // async find(ctx) {
    //     const projects = await await strapi.query('project').find(ctx.query);
    //     return projects;
    // },

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
    },

    calculateProjectInfo: async (data, id) => {           
        return doProjectInfoCalculations(data, id)
    },

    enqueueProjects: async projects => {
        projectsQueue.push(projects)
    },

    updateQueuedProjects: async () => {
        const projects = projectsQueue.pop()
        console.log('projects', projects)
        if (projects.current) {
            console.log('projects.current', projects.current)
            await updateProjectInfo(projects.current)            
        }
        if (projects.previous && projects.current !== projects.previous) {
            console.log('projects.previous', projects.previous)
            await updateProjectInfo(projects.previous)
        }
        
    }
};
