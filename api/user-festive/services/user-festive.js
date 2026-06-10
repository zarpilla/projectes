'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

module.exports = {
  /**
   * Promise to fetch records with populated relations
   */
  find(params, populate = ['festive_type', 'year', 'users_permissions_user']) {
    return strapi.query('user-festive').find(params, populate);
  },

  /**
   * Promise to fetch a record with populated relations
   */
  findOne(params, populate = ['festive_type', 'year', 'users_permissions_user']) {
    return strapi.query('user-festive').findOne(params, populate);
  },
};
