'use strict';

const _ = require('lodash');
const projectController = require('../controllers/project');

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            data.dirty = true
        },
        async afterCreate(data) {
            await projectController.updateDirtyProjects(data.id)
        },
        async beforeUpdate(params, data) {
            if (data._internal) {
                return
            }
            data.dirty = true
        }, 
        async afterUpdate(data) {
            await projectController.updateDirtyProjects(data.id)
        },       
      },
};