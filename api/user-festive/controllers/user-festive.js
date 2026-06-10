'use strict';

const { sanitizeEntity } = require('strapi-utils');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  /**
   * Retrieve records with populated relations
   */
  async find(ctx) {
    let entities;
    if (ctx.query._q) {
      entities = await strapi.services['user-festive'].search(ctx.query);
    } else {
      entities = await strapi.services['user-festive'].find(ctx.query);
    }

    return entities.map(entity =>
      sanitizeEntity(entity, { model: strapi.models['user-festive'] })
    );
  },

  /**
   * Retrieve a record with populated relations
   */
  async findOne(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.services['user-festive'].findOne({ id });

    return sanitizeEntity(entity, { model: strapi.models['user-festive'] });
  },
};
