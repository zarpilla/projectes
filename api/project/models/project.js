'use strict';

const _ = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async afterFindOne(result, params, populate) {
            if (!result.pdf) {
                const emittedInvoices = await strapi.query('emitted-invoice').find({ project: params.id });
                const receivedGrants = await strapi.query('received-grant').find({ project: params.id });
                const receivedInvoices = await strapi.query('received-invoice').find({ project: params.id });
                const tickets = await strapi.query('ticket').find({ project: params.id });
                const diets = await strapi.query('diet').find({ project: params.id });
                const emittedGrants = await strapi.query('emitted-grant').find({ project: params.id });
                result.total_real_incomes = _.sumBy(emittedInvoices, 'total_base') + _.sumBy(receivedGrants, 'total')
                result.total_real_expenses = _.sumBy(receivedInvoices, 'total_base') + _.sumBy(tickets, 'total') + _.sumBy(diets, 'total') + _.sumBy(emittedGrants, 'total')
                result.total_real_incomes_expenses = result.total_real_incomes - result.total_real_expenses
            }            
        },
        async beforeCreate(data) {
            data = await calculateTotals(data)
        },
        async beforeUpdate(params, data) {
            data = await calculateTotals(data)
        },
        // async afterCreate(result, data) {

        //     data = await calculateTotals(data)

        // },
        // async afterUpdate(result, params, data) {        
            
        //     data = await calculateTotals(data)
        // },
      },
};


let calculateTotals = async (data) => {
    if (data._internal) {
        return
    }
    console.log('calculateTotals ini', data)
    
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
    
    data.balance = data.total_incomes - data.total_expenses - data.total_expenses_hours
    data.estimated_balance = data.total_incomes - data.total_expenses - data.total_estimated_expenses
    data.incomes_expenses = data.total_incomes - data.total_expenses
    console.log('calculateTotals end', data)
    
    return data;

}