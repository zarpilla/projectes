'use strict';

const _ = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async afterFindOne(result, params, populate) {
            // console.log('afterFindOne')
            result = await doTotalCalculations(result, params)
        },
        afterFind: async (results, params, populate) => {
            const promises = results.map(r => doTotalCalculations(r, { id: r.id }))
            const updatedResults = await Promise.all(promises)
            results.forEach((result, i) => {
                result = updatedResults[i]
            })
        },
        async beforeCreate(data) {
            // data = await calculateTotals(null, data)
        },
        async beforeUpdate(params, data) {
            // data = await calculateTotals(params, data)
            data = await doTotalCalculations(data, params)
        },
        // async afterCreate(result, data) {

        //     data = await calculateTotals(data)

        // },
        // async afterUpdate(result, params, data) {        
            
        //     data = await calculateTotals(data)
        // },
      },
};


let doTotalCalculations = async (result, params) => {

    const data = result

    data.total_incomes = 0;
    data.total_expenses = 0;
    data.total_expenses_hours = 0;
    // data.total_real_hours = data.total_real_hours
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
    
    

    result = data
    
    const emittedInvoices = await strapi.query('emitted-invoice').find({ project: params.id });
    const receivedGrants = await strapi.query('received-grant').find({ project: params.id });
    const receivedInvoices = await strapi.query('received-invoice').find({ project: params.id });
    const activities = await strapi.query('activity').find({ project: params.id });
    // console.log('activities', activities)
    const tickets = await strapi.query('ticket').find({ project: params.id });
    const diets = await strapi.query('diet').find({ project: params.id });
    const emittedGrants = await strapi.query('emitted-grant').find({ project: params.id });
    result.total_real_hours = _.sumBy(activities, 'hours')
    result.total_real_incomes = _.sumBy(emittedInvoices, 'total_base') + _.sumBy(receivedGrants, 'total')
    result.total_real_expenses = _.sumBy(receivedInvoices, 'total_base') + _.sumBy(tickets, 'total') + _.sumBy(diets, 'total') + _.sumBy(emittedGrants, 'total')
    //result.total_real_incomes_expenses = result.total_real_incomes - result.total_real_expenses                
    const activities_price = activities.map(a => { return { cost: a.hours * a.cost_by_hour } })    
    result.total_real_hours_price = _.sumBy(activities_price, 'cost')
    result.total_real_incomes_expenses = result.total_real_incomes - result.total_real_expenses - result.total_real_hours_price
    
    // console.log('result', result)

    if (result.structural_expenses_pct) {
        // console.log('result.total_expenses', result.total_expenses)
        result.total_expenses = result.total_expenses + result.structural_expenses_pct / 100 * result.total_incomes
        // console.log('result.total_expenses 2 a', result.total_expenses)
        // console.log('result.total_expenses 2 b', result.structural_expenses_pct / 100 * result.total_incomes)
        result.incomes_expenses = result.total_incomes - result.total_expenses - result.total_estimated_expenses

        result.total_real_expenses = result.total_real_expenses + result.structural_expenses_pct / 100 * result.total_real_incomes
        result.total_real_incomes_expenses = result.total_real_incomes - result.total_real_expenses - result.total_real_hours_price
    }

    if (result.structural_expenses === true) {
        const indirects = await strapi.query('project').find({ structural_expenses_pct_gt: 0 });
        const indirectIncomes = _.sumBy(indirects.map(i => { return { indirect: i.structural_expenses_pct / 100 * i.total_incomes } }), 'indirect')
        const indirectIncomesReal = _.sumBy(indirects.map(i => { return { indirect: i.structural_expenses_pct / 100 * i.total_real_incomes } }), 'indirect')
        // console.log('estructura', indirects)
        result.total_incomes = result.total_incomes + indirectIncomes
        result.incomes_expenses = result.incomes_expenses + indirectIncomes
        result.total_real_incomes = result.total_real_incomes + indirectIncomesReal
    }

    result.total_real_incomes_expenses = result.total_real_incomes - result.total_real_expenses - result.total_real_hours_price

    result.total_estimated_hours_price = total_estimated_hours_price // result.total_estimated_expenses
    result.balance = data.total_incomes - result.total_expenses - result.total_expenses_hours
    result.estimated_balance = result.total_incomes - result.total_expenses - result.total_estimated_expenses
    result.incomes_expenses = result.total_incomes - result.total_expenses - result.total_estimated_hours_price

    return result
}


let calculateTotals = async (params, data) => {
    if (data._internal) {
        return
    }
    //console.log('params', params)
    
    data.total_incomes = 0;
    data.total_expenses = 0;
    data.total_expenses_hours = 0;
    // data.total_real_hours = data.total_real_hours
    data.total_estimated_hours = 0
    data.estimated_balance = 0
    data.total_estimated_expenses = 0

    if (data.expenses) {
        let total_expenses = 0
        data.expenses.forEach(i => {
            i.total_amount = (i.quantity ? i.quantity : 0 ) * (i.amount ? i.amount : 0);
            i.tax_amount = i.total_amount * (i.tax_pct ? i.tax_pct : 0) / 100.0;
            i.total_amount = i.total_amount + i.tax_amount
            total_expenses += i.total_amount;
        })
        data.total_expenses = total_expenses;
    }

    if (data.incomes) {
        let total_incomes = 0
        data.incomes.forEach(i => {
            i.total_amount = (i.quantity ? i.quantity : 0 ) * (i.amount ? i.amount : 0);
            total_incomes += i.total_amount;
        })
        data.total_incomes = total_incomes
    }

    if (data.estimated_hours) {
        let total_estimated_hours = 0
        let total_estimated_expenses = 0
        data.estimated_hours.forEach(i => {
            total_estimated_hours += i.quantity;
            if (i.amount) {
                i.total_amount = (i.quantity ? i.quantity : 0) * (i.amount ? i.amount : 0);
                total_estimated_expenses += i.total_amount;                
            }            
        })
        data.total_estimated_hours = total_estimated_hours;
        data.total_estimated_expenses = total_estimated_expenses;
    }
    // real calcs
    if (params !== null) {
        // const emittedInvoices = await strapi.query('emitted-invoice').find({ project: params.id });
        // const receivedGrants = await strapi.query('received-grant').find({ project: params.id });
        // const receivedInvoices = await strapi.query('received-invoice').find({ project: params.id });
        // const activities = await strapi.query('activity').find({ project: params.id });
        // // console.log('activities', activities)
        // const tickets = await strapi.query('ticket').find({ project: params.id });
        // const diets = await strapi.query('diet').find({ project: params.id });
        // const emittedGrants = await strapi.query('emitted-grant').find({ project: params.id });
        // data.total_real_hours = _.sumBy(activities, 'hours')
        // data.total_real_incomes = _.sumBy(emittedInvoices, 'total_base') + _.sumBy(receivedGrants, 'total')
        // data.total_real_expenses = _.sumBy(receivedInvoices, 'total_base') + _.sumBy(tickets, 'total') + _.sumBy(diets, 'total') + _.sumBy(emittedGrants, 'total')
        
        // const activities_price = activities.map(a => { return { cost: a.hours * a.cost_by_hour } })    
        // data.total_real_hours_price = _.sumBy(activities_price, 'cost')

        // data.total_real_incomes_expenses = data.total_real_incomes - data.total_real_expenses - data.total_real_hours_price

        data = await doTotalCalculations(data, { id: params.id })
    }

    // console.log('data.structural_expenses_pct', data.structural_expenses_pct)

    if (data.structural_expenses_pct) {
        // console.log('data.structural_expenses_pct', data.structural_expenses_pct)
        data.total_expenses = data.total_expenses + data.structural_expenses_pct / 100 * data.total_incomes
    }

    // totals
    data.total_estimated_hours_price = data.total_estimated_expenses
    data.balance = data.total_incomes - data.total_expenses - data.total_estimated_hours_price
    data.estimated_balance = data.total_incomes - data.total_expenses - data.total_estimated_expenses
    data.incomes_expenses = data.total_incomes - data.total_expenses - data.total_estimated_expenses
    
    return data;

}