"use strict";

const _ = require("lodash");
const projectController = require("../controllers/project");

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async afterCreate(result, params) {
      
      // Check if we have phases to create (extracted in beforeCreate)
      if (params._originalPhases || params._executionPhases) {
        
        // Create project_original_phases
        if (params._originalPhases && params._originalPhases.length > 0) {
          for (const phase of params._originalPhases) {
            await projectController.createPhaseWithNested(
              result.id,
              'project-original-phases',
              phase
            );
          }
        }
        
        // Create project_phases
        if (params._executionPhases && params._executionPhases.length > 0) {
          for (const phase of params._executionPhases) {
            await projectController.createPhaseWithNested(
              result.id,
              'project-phases',
              phase
            );
          }
        }        
      }
      
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
      
      // In Strapi 3.x beforeCreate, data is in params, not data parameter
      const actualData = params;
      
      
      // CRITICAL FIX: Extract phases before Strapi processes the create
      // Strapi's ORM can't handle complex nested creates, so we handle them manually in afterCreate
      if (actualData.project_original_phases && actualData.project_original_phases.length > 0) {
        params._originalPhases = actualData.project_original_phases;
        delete params.project_original_phases;
        delete params.project_original_phases_info;
      }
      
      if (actualData.project_phases && actualData.project_phases.length > 0) {
        params._executionPhases = actualData.project_phases;
        delete params.project_phases;
        delete params.project_phases_info;
      }      
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
    async afterFind(results, params, populate) {
      // Calculate aggregated totals for mother projects
      if (results && results.length > 0) {
        for (const project of results) {
          if (project.is_mother) {
            await calculateMotherProjectTotals(project);
          }
        }
      }
    },
    async afterFindOne(result, params, populate) {
      // Calculate aggregated totals for mother project
      if (result && result.is_mother) {
        await calculateMotherProjectTotals(result);
      }
    },
  },
};

// Helper function to calculate mother project totals from children
async function calculateMotherProjectTotals(motherProject) {
  try {
    // Get all children of this mother project
    const children = await strapi
      .query("project")
      .find({ mother: motherProject.id, _limit: -1 });
    
    if (!children || children.length === 0) {
      return;
    }
    
    // Initialize all totals to 0
    motherProject.total_original_incomes = 0;
    motherProject.total_original_expenses = 0;
    motherProject.total_original_hours = 0;
    motherProject.total_original_hours_price = 0;
    motherProject.total_original_expenses_vat = 0;
    motherProject.original_incomes_expenses = 0;
    
    motherProject.total_estimated_incomes = 0;
    motherProject.total_estimated_expenses = 0;
    motherProject.total_estimated_hours = 0;
    motherProject.total_estimated_hours_price = 0;
    motherProject.total_estimated_expenses_vat = 0;
    motherProject.estimated_incomes_expenses = 0;
    
    motherProject.total_real_incomes = 0;
    motherProject.total_real_expenses = 0;
    motherProject.total_real_hours = 0;
    motherProject.total_real_hours_price = 0;
    motherProject.total_real_expenses_vat = 0;
    motherProject.total_real_incomes_expenses = 0;
    
    // Backwards compatibility
    motherProject.total_incomes = 0;
    motherProject.total_expenses = 0;
    motherProject.incomes_expenses = 0;
    
    // Sum up values from all children
    for (const child of children) {
      // Original dimension
      motherProject.total_original_incomes += parseFloat(child.total_original_incomes || 0);
      motherProject.total_original_expenses += parseFloat(child.total_original_expenses || 0);
      motherProject.total_original_hours += parseFloat(child.total_original_hours || 0);
      motherProject.total_original_hours_price += parseFloat(child.total_original_hours_price || 0);
      motherProject.total_original_expenses_vat += parseFloat(child.total_original_expenses_vat || 0);
      motherProject.original_incomes_expenses += parseFloat(child.original_incomes_expenses || 0);
      
      // Estimated dimension
      motherProject.total_estimated_incomes += parseFloat(child.total_estimated_incomes || 0);
      motherProject.total_estimated_expenses += parseFloat(child.total_estimated_expenses || 0);
      motherProject.total_estimated_hours += parseFloat(child.total_estimated_hours || 0);
      motherProject.total_estimated_hours_price += parseFloat(child.total_estimated_hours_price || 0);
      motherProject.total_estimated_expenses_vat += parseFloat(child.total_estimated_expenses_vat || 0);
      motherProject.estimated_incomes_expenses += parseFloat(child.estimated_incomes_expenses || 0);
      
      // Real dimension
      motherProject.total_real_incomes += parseFloat(child.total_real_incomes || 0);
      motherProject.total_real_expenses += parseFloat(child.total_real_expenses || 0);
      motherProject.total_real_hours += parseFloat(child.total_real_hours || 0);
      motherProject.total_real_hours_price += parseFloat(child.total_real_hours_price || 0);
      motherProject.total_real_expenses_vat += parseFloat(child.total_real_expenses_vat || 0);
      motherProject.total_real_incomes_expenses += parseFloat(child.total_real_incomes_expenses || 0);
      
      // Backwards compatibility
      motherProject.total_incomes += parseFloat(child.total_incomes || child.total_estimated_incomes || 0);
      motherProject.total_expenses += parseFloat(child.total_expenses || child.total_estimated_expenses || 0);
      motherProject.incomes_expenses += parseFloat(child.incomes_expenses || child.estimated_incomes_expenses || 0);
    }
  } catch (error) {
    console.error(`Error calculating mother project totals for project ${motherProject.id}:`, error);
  }
}
