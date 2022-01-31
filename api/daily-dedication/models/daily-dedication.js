'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            const dedications = await strapi.query('daily-dedication').find({ users_permissions_user: data.users_permissions_user, _limit: -1 });            
            const valids = dedications
            const invalids = valids.filter(d => (data.to >= d.from && data.to <= d.to) || (data.from <= d.to && data.to >= d.from))
            if (invalids.length) {
                throw new Error('daily-dedication overlaps')
            }
        },
        async beforeUpdate(params, data) {            
            const dedications = await strapi.query('daily-dedication').find({ users_permissions_user: data.users_permissions_user, _limit: -1 });            
            const valids = dedications.filter(d => d.id !== params.id)
            const invalids = valids.filter(d => (data.to >= d.from && data.to <= d.to) || (data.from <= d.to && data.to >= d.from))
            if (invalids.length) {
                throw new Error('daily-dedication overlaps')
            }
        }
      },
};
