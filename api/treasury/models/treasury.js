'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            const me = await strapi.query('me').findOne();
            if (me && me.bank_account_default && !data.bank_account) {
                data.bank_account = me.bank_account_default;
            }
        }
    }
};
