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
      // await projectController.enqueueProjects({
      //   current: result.id,
      //   previous: null,
      // });
      // await projectController.updateQueuedProjects();
    },
    async beforeCreate(params, data) {
      // await projectController.enqueueProjects({ current: params.id, previous: null })
    },
    async beforeUpdate(params, data) {
      const id = params.id || data.id;
      let updatedPhases = false;
      if (
        data.project_original_phases &&
        data.project_original_phases_info &&
        data._project_original_phases_updated
      ) {
        updatedPhases = true;
        await projectController.updatePhases(
          id,
          "project-original-phases",
          data.project_original_phases,
          data.project_original_phases_info.deletedPhases || [],
          data.project_original_phases_info.deletedIncomes || [],
          data.project_original_phases_info.deletedExpenses || [],
          data.project_original_phases_info.deletedHours || []
        );
      }

      if (
        data.project_phases &&
        data.project_phases_info &&
        data._project_phases_updated
      ) {
        updatedPhases = true;
        await projectController.updatePhases(
          id,
          "project-phases",
          data.project_phases,
          data.project_phases_info.deletedPhases || [],
          data.project_phases_info.deletedIncomes || [],
          data.project_phases_info.deletedExpenses || [],
          []
        );
      }

      if (updatedPhases) {
        const project_phases = await strapi
          .query("project-phases")
          .find({ project: id }, [
            "incomes",
            "incomes.estimated_hours",
            "incomes.income_type",
            "incomes.estimated_hours.users_permissions_user",
            "incomes.invoice",
            "incomes.income",
            "expenses",
            "expenses.expense_type",
            "expenses.invoice",
            "expenses.expense",
          ]);

        const project_original_phases = await strapi
          .query("project-original-phases")
          .find({ project: id }, [
            "incomes",
            "incomes.estimated_hours",
            "incomes.income_type",
            "incomes.estimated_hours.users_permissions_user",
            "incomes.invoice",
            "incomes.income",
            "expenses",
            "expenses.expense_type",
            "expenses.invoice",
            "expenses.expense",
          ]);

        data.project_phases = project_phases;
        data.project_original_phases = project_original_phases;
      }

      data = await projectController.calculateProject(data, id);
    },
    async afterUpdate(result, params, data) {
      if (data._internal) {
        return;
      }
      //await projectController.updateQueuedProjects();
    },
  },
};
