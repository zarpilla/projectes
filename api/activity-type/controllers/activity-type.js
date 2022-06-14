'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
    async updateGlobal(ctx) {
        const acTypes = await strapi.query("activity-type").find({ _limit: -1 });

        for(let i = 0; i < acTypes.length; i++) {
            if (acTypes[i].project && acTypes[i].project.id) {

                const acTypeToUpdate = { id: acTypes[i].id, projects: [acTypes[i].project.id] }

                await strapi.query("activity-type").update({ id: acTypes[i].id }, acTypeToUpdate); 
            }
        }
        return acTypes
    }
};
