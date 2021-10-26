'use strict';

const _ = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            data = await calculatePrice(0, data)
        },
        async beforeUpdate(params, data) {
            data = await calculatePrice(params.id, data)
        },

        async beforeDelete(params) {        
            // console.log('params', params)
        },

        async afterDelete(result, params) {        
        },
      },
};

let calculatePrice = async (id, data) => {
    const dedications = await strapi.query('daily-dedication').find({ users_permissions_user: data.users_permissions_user });
    if (dedications.length) {
        const dedication = dedications.find(d => d.from <= data.date && d.to >= data.date)
        if (dedication) {
            data.cost_by_hour = dedication.costByHour
        }
    }    
    return data
}
/*
let calculateTotals = async (id, data) => {

    if (id === 0) {

        data = await setHourPrice(data, data.project)
        await calculateTotalsForProject(data.project, 0, data.hours, data.invoice_hours_price)
            
    }
    else {
        const oldActivity = await strapi.query('activity').findOne({ id: id });

        if (oldActivity.project.id !== data.project) {
            const oldProjectId = oldActivity.project.id
            
            let oldProjectData = {}
            oldProjectData = await setHourPrice(oldProjectData, oldProjectId)

            await calculateTotalsForProject(oldProjectId, id, 0, oldProjectData.invoice_hours_price)

            data = await setHourPrice(data, data.project)

            await calculateTotalsForProject(data.project, 0, data.hours, data.invoice_hours_price)

        }
        else {
            
            data = await setHourPrice(data, data.project)
            
            await calculateTotalsForProject(data.project, id, data.hours, data.invoice_hours_price)
        }

    }

    
    return data;

}

let setHourPrice = async (data, projectId) => {
    const project = await strapi.query('project').findOne({ id: projectId });
    // console.log('project.invoice_hours_price', project.invoice_hours_price)
    if (project.invoice_hours_price) {
        data.invoice_hours_price = project.invoice_hours_price
    }
    else {
        data.invoice_hours_price = 0
    }
    return data
}

let calculateTotalsForProject = async (projectId, excludeActivityId, addedHours, invoice_hours_price) => {
    // console.log('calculateTotalsForProject')
    const projectActivities = await strapi.query('activity').find({ project: projectId });
    // console.log('projectActivities', projectActivities)
    const projectActivitiesWithoutCurrent = projectActivities.filter(a => a.id.toString() !== excludeActivityId.toString())    
    const projectHours = projectActivitiesWithoutCurrent.map(a => { return a.hours })
    projectHours.push(addedHours)
    const projectHoursSum = _.sum(projectHours);

    const projectHoursPrice = projectActivitiesWithoutCurrent.map(a => { return a.hours * a.invoice_hours_price })
    projectHoursPrice.push(addedHours * invoice_hours_price)
    const projectHoursPriceSum = _.sum(projectHoursPrice);

    const project = await strapi.query('project').findOne({ id: projectId });
    
    if (project.invoice_hours_price) {
        project.total_incomes = projectHoursPriceSum
        project.incomes_expenses = project.total_incomes - project.total_expenses

        await strapi.query('project').update(
            { id: projectId },
            {
                // dedicated_hours: projectHoursSum,
                total_real_hours: projectHoursSum,
                //total_incomes: projectHoursPriceSum,
                total_incomes: project.total_incomes,
                incomes_expenses: project.incomes_expenses,
                balance: project.total_incomes - project.total_expenses - project.total_expenses_hours,
                estimated_balance: project.total_incomes - project.total_expenses - project.total_estimated_expenses,
                _internal: true
            });
    }
    else {
        
        await strapi.query('project').update(
            { id: projectId },
            {
                dedicated_hours: projectHoursSum,
                total_real_hours: projectHoursSum,                
                _internal: true
            });

    }

}

*/