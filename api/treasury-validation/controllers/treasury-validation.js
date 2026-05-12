'use strict';

/**
 * treasury-validation.js controller
 */

const { parseMultipartData, sanitizeEntity } = require('strapi-utils');

module.exports = {
  /**
   * Toggle validation for a treasury movement
   * POST /treasury-validations/toggle
   * Body: { entity_type, entity_id, sub_type?, notes? }
   */
  async toggle(ctx) {
    const { entity_type, entity_id, sub_type, notes } = ctx.request.body;

    if (!entity_type || !entity_id) {
      return ctx.badRequest('entity_type and entity_id are required');
    }

    // Build query to find existing validation
    const query = {
      entity_type,
      entity_id: parseInt(entity_id),
    };

    if (sub_type) {
      query.sub_type = sub_type;
    } else {
      query.sub_type_null = true;
    }

    // Check if validation already exists
    const existing = await strapi.query('treasury-validation').findOne(query);

    if (existing) {
      // Delete validation (unvalidate)
      await strapi.query('treasury-validation').delete({ id: existing.id });
      return ctx.send({
        validated: false,
        message: 'Validation removed'
      });
    } else {
      // Create validation
      const data = {
        entity_type,
        entity_id: parseInt(entity_id),
        sub_type: sub_type || null,
        validated_by: ctx.state.user.id,
        notes: notes || null
      };

      const validation = await strapi.query('treasury-validation').create(data);

      return ctx.send({
        validated: true,
        validation: sanitizeEntity(validation, { model: strapi.models['treasury-validation'] }),
        message: 'Movement validated'
      });
    }
  },

  /**
   * Get all validations
   * GET /treasury-validations
   */
  async find(ctx) {
    let entities;
    
    if (ctx.query._q) {
      entities = await strapi.services['treasury-validation'].search(ctx.query);
    } else {
      entities = await strapi.services['treasury-validation'].find(ctx.query);
    }

    return entities.map(entity =>
      sanitizeEntity(entity, { model: strapi.models['treasury-validation'] })
    );
  },

  /**
   * Get validation by composite key
   * GET /treasury-validations/:entity_type/:entity_id/:sub_type?
   */
  async findByKey(ctx) {
    const { entity_type, entity_id, sub_type } = ctx.params;

    const query = {
      entity_type,
      entity_id: parseInt(entity_id),
    };

    if (sub_type && sub_type !== 'null') {
      query.sub_type = sub_type;
    } else {
      query.sub_type_null = true;
    }

    const validation = await strapi.query('treasury-validation').findOne(query);

    if (!validation) {
      return ctx.notFound('Validation not found');
    }

    return sanitizeEntity(validation, { model: strapi.models['treasury-validation'] });
  },

  /**
   * Delete validation
   * DELETE /treasury-validations/:id
   */
  async delete(ctx) {
    const { id } = ctx.params;

    const validation = await strapi.services['treasury-validation'].delete({ id });

    return sanitizeEntity(validation, { model: strapi.models['treasury-validation'] });
  }
};
