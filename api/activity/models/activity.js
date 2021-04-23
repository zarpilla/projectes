'use strict';

const _ = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {

            data = await calculateTotals(0, data)

        },
        async beforeUpdate(params, data) {        
            //console.log('params', params)
            data = await calculateTotals(params.id, data)
        },

        async beforeDelete(params) {        
            console.log('params', params)
            // data = await calculateTotals(params.id, data)
        },

        async afterDelete(result, params) {        
            console.log('result', result)
            console.log('params', params)
            // data = await calculateTotals(params.id, data)
            await calculateTotalsForProject(result.project.id, 0, 0)
        },
      },
};


let calculateTotals = async (id, data) => {

    if (id === 0) {
        // const projectActivities = await strapi.query('activity').find({ project: data.project });
        // console.log('projectActivities', projectActivities)

        // const projectHours = projectActivities.map(a => { return a.hours })
        // projectHours.push(data.hours)
        // const projectHoursSum = _.sum(projectHours);

        // strapi.query('project').update(
        //     { id: data.project },
        //     {
        //         dedicated_hours: projectHoursSum,
        //         total_dedicated_hours: projectHoursSum,
        //     });

        await calculateTotalsForProject(data.project, 0, data.hours)
            
    }
    else {
        const oldActivity = await strapi.query('activity').findOne({ id: id });
        console.log('oldActivity', oldActivity)
        console.log('data.project', data.project)

        // old project to update 
        // oldActivity.project.id
        if (oldActivity.project.id !== data.project) {
            const oldProjectId = oldActivity.project.id
            console.log('old', oldActivity.project.id)
            console.log('new', data.project)

            //const projectHoursSum = _.sum(projectHours);

            // const oldActivities = await strapi.query('activity').find({ project: oldProjectId });
            // const oldActivitiesWithoutCurrent = oldActivities.filter(a => a.id !== id)
            // const oldProjectHours = oldActivitiesWithoutCurrent.map(a => { return a.hours })
            // const oldProjectHoursSum = _.sum(oldProjectHours);

            // strapi.query('project').update(
            //     { id: oldProjectId },
            //     {
            //         dedicated_hours: oldProjectHoursSum,
            //         total_dedicated_hours: oldProjectHoursSum,
            //     });

            await calculateTotalsForProject(oldProjectId, id, 0)


            // const newActivities = await strapi.query('activity').find({ project: data.project });
            // const newProjectHours = newActivities.map(a => { return a.hours })
            // newProjectHours.push(data.hours)
            // const newProjectHoursSum = _.sum(newProjectHours);

            // strapi.query('project').update(
            //     { id: data.project },
            //     {
            //         dedicated_hours: newProjectHoursSum,
            //         total_dedicated_hours: newProjectHoursSum,
            //     });

            await calculateTotalsForProject(data.project, 0, data.hours)

        }
        else {
            console.log('same', data.project)
            console.log('hours', data.hours)
            console.log('exclude', id)

            await calculateTotalsForProject(data.project, id, data.hours)

            // const projectActivities = await strapi.query('activity').find({ project: data.project });

            // const projectActivitiesWithoutCurrent = projectActivities.filter(a => a.id !== id)
            // const projectHours = projectActivitiesWithoutCurrent.map(a => { return a.hours })
            // projectHours.push(data.hours)
            // const projectHoursSum = _.sum(projectHours);

            // strapi.query('project').update(
            //     { id: data.project },
            //     {
            //         dedicated_hours: projectHoursSum,
            //         total_dedicated_hours: projectHoursSum,
            //     });
        }

    }

    
    return data;

}

let calculateTotalsForProject = async (projectId, excludeActivityId, addedHours) => {

    const projectActivities = await strapi.query('activity').find({ project: projectId });
    // console.log('projectActivities', projectActivities)
    const projectActivitiesWithoutCurrent = projectActivities.filter(a => a.id.toString() !== excludeActivityId.toString())
    console.log('projectActivitiesWithoutCurrent', projectActivitiesWithoutCurrent)
    const projectHours = projectActivitiesWithoutCurrent.map(a => { return a.hours })
    projectHours.push(addedHours)
    const projectHoursSum = _.sum(projectHours);

    await strapi.query('project').update(
        { id: projectId },
        {
            dedicated_hours: projectHoursSum,
            total_dedicated_hours: projectHoursSum,
        });
}