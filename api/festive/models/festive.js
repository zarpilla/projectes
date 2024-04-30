"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const service = require("../../project/services/project");

module.exports = {
  lifecycles: {
    async afterCreate(data) {
        
    service.setFestivesDirty(true);
    },
    async afterUpdate(params, data) {
        service.setFestivesDirty(true);
    },
    async afterDelete(params) {
        service.setFestivesDirty(true);
    },
  },
};
