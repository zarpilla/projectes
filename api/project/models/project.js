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

      // Load the FULL project with all relations to ensure accurate calculation
      // The 'data' parameter only contains fields being updated, not the complete project
      const fullProject = await strapi
        .query("project")
        .findOne({ id: id }, [
          "activities",
          "activities.activity_type",
          "project_phases",
          "project_phases.incomes",
          "project_phases.incomes.estimated_hours",
          "project_phases.incomes.income_type",
          "project_phases.incomes.estimated_hours.users_permissions_user",
          "project_phases.incomes.invoice",
          "project_phases.incomes.income",
          "project_phases.expenses",
          "project_phases.expenses.expense_type",
          "project_phases.expenses.invoice",
          "project_phases.expenses.expense",
          "project_original_phases",
          "project_original_phases.incomes",
          "project_original_phases.incomes.estimated_hours",
          "project_original_phases.incomes.income_type",
          "project_original_phases.incomes.estimated_hours.users_permissions_user",
          "project_original_phases.incomes.invoice",
          "project_original_phases.incomes.income",
          "project_original_phases.expenses",
          "project_original_phases.expenses.expense_type",
          "project_original_phases.expenses.invoice",
          "project_original_phases.expenses.expense",
        ]);

      // Merge updated fields from 'data' into fullProject for calculation
      // IMPORTANT: Don't overwrite relations (phases, activities) unless they were explicitly updated
      // This prevents stale frontend data from being used in calculations
      const { 
        project_phases, 
        project_original_phases, 
        activities,
        project_phases_info,
        project_original_phases_info,
        _project_phases_updated,
        _project_original_phases_updated,
        ...dataToMerge 
      } = data;
      
      Object.assign(fullProject, dataToMerge);

      // Calculate all financial fields based on complete project data
      const calculatedData = await projectController.calculateProject(fullProject, id);
      Object.assign(data, calculatedData);
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
