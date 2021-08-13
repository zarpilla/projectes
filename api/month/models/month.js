'use strict';

const _ = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        afterFind: async (results, params, populate) => {
            if (params && !params._sort) {
                const sorted = _.sortBy(results, 'month')
                const sortedbk = JSON.parse(JSON.stringify(sorted))
                // mitate, not reassign
                results.forEach((res, i) => {
                    res.id = sortedbk[i].id
                    res.month = sortedbk[i].month                    
                    res.month_number = sortedbk[i].month_number
                    res.name = sortedbk[i].name
                })
            }
        },
    }
};


