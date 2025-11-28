'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async beforeDelete(params, populate) {
      // Prevent deletion of bank accounts - they should never be deleted
      throw strapi.errors.badRequest('Bank accounts cannot be deleted for data integrity purposes');
    }
  }
};
