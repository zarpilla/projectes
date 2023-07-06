'use strict';
const { sanitizeEntity } = require("strapi-utils");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {

    async basic(ctx) {
        // Calling the default core action
        let contacts;
    
        if (ctx.query._q) {
            contacts = await strapi.query("contacts").search(ctx.query);
        } else {
            contacts = await strapi.query("contacts").find(ctx.query);
        }
    
        // Removing some info
        const basicContacts = contacts
          .map(
            ({
              projects,
              projectes,
              ...item
            }) => item
          );

    
        return basicContacts.map((entity) =>
          sanitizeEntity(entity, { model: strapi.models.contacts })
        );
      },
};
