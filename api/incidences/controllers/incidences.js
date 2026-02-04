'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { sanitizeEntity } = require('strapi-utils');

module.exports = {
    async update(ctx) {
        const { id } = ctx.params;

        let entity;
        
        // Add the current user ID to the params so lifecycle hooks can access it
        if (ctx.state.user) {
            ctx.params.id_user = ctx.state.user.id;
        }

        entity = await strapi.services.incidences.update({ id }, ctx.request.body);

        return sanitizeEntity(entity, { model: strapi.models.incidences });
    }
};
