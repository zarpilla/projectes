'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {

            data = await calculateTotals(data)

        },
        async beforeUpdate(params, data) {        
            
            data = await calculateTotals(data)
        },
      },
};


let calculateTotals = async (data) => {
    data.total_incomes = 0;
    data.total_expenses = 0;
    data.total_expenses_hours = 0;
    data.total_real_hours = 0
    data.total_estimated_hours = 0
    data.estimated_balance = 0
    data.total_estimated_expenses = 0

    if (data.expenses) {
        let total_expenses = 0
        data.expenses.forEach(i => {
            i.total_amount = (i.quantity ? i.quantity : 0 ) * (i.amount ? i.amount : 0);
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

    if (data.dedication) {
        let total_real_hours = 0
        let total_expenses_hours = 0

        for(let j = 0; j < data.dedication.length; j++) {
            let i = data.dedication[j]
            let costbyhour = 0;
            if (i.costbyhour != null) {
                costbyhour = i.costbyhour
            }
            else {
                let user = await strapi.query('user', 'users-permissions').findOne( i.users_permissions_user );                
                costbyhour = user.costbyhour;
                i.costbyhour = user.costbyhour
            }
            total_real_hours += i.hours;
            total_expenses_hours += i.hours * costbyhour;
        }
        data.total_real_hours = total_real_hours
        data.total_expenses_hours = total_expenses_hours
    }

    data.balance = data.total_incomes - data.total_expenses - data.total_expenses_hours
    data.estimated_balance = data.total_incomes - data.total_expenses - data.total_estimated_expenses
    data.incomes_expenses = data.total_incomes - data.total_expenses

    return data;

}