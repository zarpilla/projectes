'use strict';

const taskController = require('../../api/task/controllers/task');
const projectController = require('../../api/project/controllers/project');

/**
 * Cron config that gives you an opportunity
 * to run scheduled jobs.
 *
 * The cron format consists of:
 * [SECOND (optional)] [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK]
 *
 * See more details here: https://strapi.io/documentation/developer-docs/latest/setup-deployment-guides/configurations.html#cron-tasks
 */

module.exports = {
  /**
   * Every day at 3am.
   */
  '0 3 * * *': async () => {
    await taskController.email()  
  },

  /**
   * Every 2 minutes.
   */

  '*/2 * * * *': async () => {
    try {
      await projectController.updateDirtyProjects();
    } catch (error) {
      console.error('[CRON] Error in updateDirtyProjects:', error);
    }
  },

  
};
