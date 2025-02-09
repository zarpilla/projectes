'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */
const service = require("../../project/services/project");

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            const dedications = await strapi.query('daily-dedication').find({ users_permissions_user: data.users_permissions_user, _limit: -1 });            
            const valids = dedications
            const invalids = valids.filter(d => (data.to >= d.from && data.to <= d.to) || (data.from <= d.to && data.to >= d.from))
            if (invalids.length) {
                console.error('daily-dedication overlaps', invalids)
                throw new Error('daily-dedication overlaps')
            }
            service.setDailyDedicationsDirty(true);
            // update all activities price between dates
            const activities = await strapi.query('activity').find({ users_permissions_user: data.users_permissions_user, date_gte: data.from , date_lte: data.to, _limit: -1 });
            const activitiesPrice = activities.filter(a => a.cost_by_hour !== data.costByHour);
            for await (const ap of activitiesPrice) {
                if (ap.cost_by_hour !== data.costByHour && data.costByHour !== null) {
                    const activity = { cost_by_hour: data.costByHour };
                    await strapi.query('activity').update({ id: ap.id }, activity);
                }
            }
        },
        async beforeUpdate(params, data) {            
            const dedications = await strapi.query('daily-dedication').find({ users_permissions_user: data.users_permissions_user, _limit: -1 });
            const valids = dedications.filter(d => d.id.toString() !== params.id.toString())
            const invalids = valids.filter(d => (data.to >= d.from && data.to <= d.to) || (data.from <= d.to && data.to >= d.from))
            if (invalids.length) {
                console.error('daily-dedication overlaps', invalids)
                throw new Error('daily-dedication overlaps')
            }
            service.setDailyDedicationsDirty(true);
            // update all activities price between dates
            const activities = await strapi.query('activity').find({ users_permissions_user: data.users_permissions_user, date_gte: data.from , date_lte: data.to, _limit: -1 });
            const activitiesPrice = activities.filter(a => a.cost_by_hour !== data.costByHour);
            for await (const ap of activitiesPrice) {
                if (ap.cost_by_hour !== data.costByHour && data.costByHour !== null) {
                    const activity = { cost_by_hour: data.costByHour };
                    await strapi.query('activity').update({ id: ap.id }, activity);
                }
            }
        },
        async beforeDelete(params) {
            service.setDailyDedicationsDirty(true);
        }
        
      },
};
