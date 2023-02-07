'use strict';

const _ = require('lodash');
const projectController = require('../controllers/project');

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(result, params, populate) {
            result = await calculateProjectInfo(result, params)
        },
        async afterCreate(result) {
            await projectController.enqueueProjects({ current: result.id, previous: null })
            await projectController.updateQueuedProjects()
        },
        async beforeUpdate(params, data) {
            await projectController.enqueueProjects({ current: params.id, previous: null })
        }, 
        async afterUpdate(result, params, data) {
            if (data._internal) {
                return
            }
            await projectController.updateQueuedProjects()
        },       
      },
};