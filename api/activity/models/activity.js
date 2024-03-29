'use strict';
const _ = require('lodash');
const projectController = require('../../project/controllers/project');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            data = await calculatePrice(0, data)            
            await projectController.setDirty(data.project)
        },        
        async beforeUpdate(params, data) {
            data = await calculatePrice(params.id, data)
            if (data && data.project) {
                await projectController.setDirty(data.project)
            }
        },        
        // async beforeDelete(params) {        
        //     const activity = await strapi.query('activity').findOne(params);   
        //     if (activity.project && activity.project.id) {
        //         await projectController.setDirty(activity.project.id)
        //     }                
        // },        
      },
};

let calculatePrice = async (id, data) => {    
    if (data && !data.cost_by_hour && data.users_permissions_user) {
        const dedications = await strapi.query('daily-dedication').find({ users_permissions_user: data.users_permissions_user, _limit: -1 });
        if (dedications.length) {
            const dedication = dedications.find(d => d.from <= data.date && d.to >= data.date)
            if (dedication) {
                data.cost_by_hour = dedication.costByHour || 0
            }
        }
    }    
    return data
}
