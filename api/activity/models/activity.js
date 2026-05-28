'use strict';
const _ = require('lodash');
const { scheduleRefresh } = require('../../project/services/totalsRefreshScheduler');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            data = await calculatePrice(0, data)
        },
        async afterCreate(result) {
            if (result && result.project) {
                scheduleRefresh(result.project.id || result.project)
            }
        },
        async beforeUpdate(params, data) {
            data = await calculatePrice(params.id, data)
        },
        async afterUpdate(result, params, data) {
            // Refresh both the new and (if changed) the previous project.
            if (result && result.project) {
                scheduleRefresh(result.project.id || result.project)
            }
            if (data && data.project && result && (
                !result.project ||
                (result.project.id || result.project) !== (data.project.id || data.project)
            )) {
                scheduleRefresh(data.project.id || data.project)
            }
        },
        async beforeDelete(params) {
            const activity = await strapi.query('activity').findOne(params);
            if (activity && activity.project) {
                scheduleRefresh(activity.project.id || activity.project)
            }
        },
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
