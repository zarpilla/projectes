'use strict';

const { scheduleFromPhaseRow } = require('../../project/services/totalsRefreshScheduler');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async afterCreate(result) {
            await scheduleFromPhaseRow(result);
        },
        async afterUpdate(result, params, data) {
            await scheduleFromPhaseRow(result);
            if (data && (data.project_phase || data.project_original_phase)) {
                await scheduleFromPhaseRow(data);
            }
        },
        async beforeDelete(params) {
            const row = await strapi.query('phase-expense').findOne(params);
            await scheduleFromPhaseRow(row);
        },
      },
};
