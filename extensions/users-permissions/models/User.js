'use strict';

/**
 * User.js model
 *
 * @description: A set of functions called "actions" for managing `User`.
 */

module.exports = {
  lifecycles: {
    /**
     * Called before a user is deleted.
     * Prevents deletion if the user has associated activities.
     */
    async beforeDelete(params) {
      // Find the user being deleted
      const user = await strapi.query('user', 'users-permissions').findOne({ id: params.id });
      
      if (!user) {
        return; // User not found, nothing to check
      }

      // Check if user has any activities
      const activities = await strapi.query('activity').find({
        users_permissions_user: params.id,
        _limit: 1
      });

      if (activities.length > 0) {
        // Get the count of activities for a more informative error message
        const activityCount = await strapi.query('activity').count({
          users_permissions_user: params.id
        });
        
        // Prevent deletion by throwing an error
        throw new Error(`Cannot delete user "${user.username}" because they have ${activityCount} associated activities. Please reassign or delete their activities first.`);
      }

      // Optional: Check for other important relationships
      // You can uncomment and modify these checks as needed

      // Check for payroll records
      const payrolls = await strapi.query('payroll').find({
        users_permissions_user: params.id,
        _limit: 1
      });
      if (payrolls.length > 0) {
        const payrollCount = await strapi.query('payroll').count({
          users_permissions_user: params.id
        });
        throw new Error(`Cannot delete user "${user.username}" because they have ${payrollCount} associated payroll records.`);
      }

      // Check for daily dedication records
      const dedications = await strapi.query('daily-dedication').find({
        users_permissions_user: params.id,
        _limit: 1
      });
      if (dedications.length > 0) {
        const dedicationCount = await strapi.query('daily-dedication').count({
          users_permissions_user: params.id
        });
        throw new Error(`Cannot delete user "${user.username}" because they have ${dedicationCount} associated daily dedication records.`);
      }
    },

    /**
     * Called before a user is updated.
     * Could be used to prevent blocking users who have activities if needed.
     */
    async beforeUpdate(params, data) {
      // Optional: Prevent blocking users who have activities
      // if (data.blocked === true) {
      //   const activities = await strapi.query('activity').find({
      //     users_permissions_user: params.id,
      //     _limit: 1
      //   });
      //   
      //   if (activities.length > 0) {
      //     throw new Error('Cannot block user with existing activities. Please reassign their activities first.');
      //   }
      // }
    }
  },
};