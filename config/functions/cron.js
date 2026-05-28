'use strict';

const taskController = require('../../api/task/controllers/task');
const checkFaceStatus = require('../../api/face-queue/cron/check-status');

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
   * Check FACe invoice status every 30 minutes.
   */
  '*/30 * * * *': checkFaceStatus,

  
};
