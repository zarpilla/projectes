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
      // If the new project has a mother, update the mother's is_mother field
      if (result.mother) {
        const motherId = result.mother.id || result.mother;
        const motherChildCount = await strapi
          .query("project")
          .count({ mother: motherId });
        await strapi
          .query("project")
          .update(
            { id: motherId },
            { is_mother: motherChildCount > 0, _internal: true }
          );
      }
      
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
      
      // Store old mother value if mother field is being changed
      if (data.mother !== undefined) {
        const currentProject = await strapi
          .query("project")
          .findOne({ id: id }, ["mother"]);
        data._oldMotherId = currentProject?.mother?.id || currentProject?.mother || null;
      }
      
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
      
      // Handle mother field changes to update is_mother on affected projects
      if (data.mother !== undefined && data._oldMotherId !== undefined) {
        const oldMotherId = data._oldMotherId;
        const newMotherId = data.mother?.id || data.mother || null;
        
        // If mother changed, update both old and new mother's is_mother field
        if (oldMotherId !== newMotherId) {
          // Update old mother if it exists
          if (oldMotherId) {
            const oldMotherChildCount = await strapi
              .query("project")
              .count({ mother: oldMotherId });
            await strapi
              .query("project")
              .update(
                { id: oldMotherId },
                { is_mother: oldMotherChildCount > 0, _internal: true }
              );
          }
          
          // Update new mother if it exists
          if (newMotherId) {
            const newMotherChildCount = await strapi
              .query("project")
              .count({ mother: newMotherId });
            await strapi
              .query("project")
              .update(
                { id: newMotherId },
                { is_mother: newMotherChildCount > 0, _internal: true }
              );
          }
        }
      }
      
      //await projectController.updateQueuedProjects();
    },
    async afterDelete(result) {
      // If the deleted project had a mother, update the mother's is_mother field
      if (result.mother) {
        const motherId = result.mother.id || result.mother;
        const motherChildCount = await strapi
          .query("project")
          .count({ mother: motherId });
        await strapi
          .query("project")
          .update(
            { id: motherId },
            { is_mother: motherChildCount > 0, _internal: true }
          );
      }
    },
  },
};
