"use strict";

const _ = require("lodash");
const projectController = require("../controllers/project");

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async afterCreate(result) {
      await projectController.enqueueProjects({
        current: result.id,
        previous: null,
      });
      await projectController.updateQueuedProjects();
    },
    async beforeCreate(params, data) {
      // await projectController.enqueueProjects({ current: params.id, previous: null })
    },
    async beforeUpdate(params, data) {
      if (data.project_original_phases && data.project_original_phases_info) {
        await projectController.updatePhases(
          params.id,
          "project-original-phases",
          data.project_original_phases,
          data.project_original_phases_info.deletedPhases || [],
          data.project_original_phases_info.deletedIncomes || [],
          data.project_original_phases_info.deletedExpenses || [],
          data.project_original_phases_info.deletedHours || []
        );
      }

      if (data.project_phases && data.project_phases_info) {
        await projectController.updatePhases(
          params.id,
          "project-phases",
          data.project_phases,
          data.project_phases_info.deletedPhases || [],
          data.project_phases_info.deletedIncomes || [],
          data.project_phases_info.deletedExpenses || [],
          []
        );
      }

      delete data.project_original_phases;
      delete data.project_original_phases_info;
      delete data.project_phases;
      delete data.project_phases_info;

    await projectController.enqueueProjects({ current: params.id, previous: null })

    },
    async afterUpdate(result, params, data) {
      if (data._internal) {
        return;
      }
      await projectController.updateQueuedProjects();
    },
  },
};
