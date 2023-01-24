'use strict';

const _ = require('lodash');
const projectController = require('../controllers/project');

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async afterFindOne(result, params, populate) {
            // result = await calculateProjectInfo(result, params)
        },
        async afterCreate(result) {
            data.dirty = true
        },
        async beforeUpdate(params, data) {
            if (data._internal) {
                return
            }
            data.dirty = true
        },        
      },
};

let calculateProjectInfo = async (result, params) => {
    const data = await projectController.calculateProjectInfo(result, params.id)
    return data
}
