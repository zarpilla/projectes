'use strict';

const _ = require('lodash');
const projectController = require('../controllers/project');

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        // async beforeFindOne(params, populate) {
        //     // result = await calculateProjectInfo(result, params)
        // },
        async afterFindOne(result, params, populate) {
            // console.log('afterFindOne', result, params)
            result = await calculateProjectInfo(result, params)
        },
        // afterFind: async (results, params, populate) => {
        //     const promises = results.map(r => doTotalCalculations(r, { id: r.id }))
        //     const updatedResults = await Promise.all(promises)
        //     results.forEach((result, i) => {
        //         result = updatedResults[i]
        //     })
        // },
        // async beforeUpdate(params, data) {
        //     data = await updateProjectInfo(data, params)
        // }        
        async afterCreate(result) {
            // console.log('result', result)
            await projectController.enqueueProjects({ current: result.id, previous: null })
            await projectController.updateQueuedProjects()
        },
        async beforeUpdate(params, data) {
            await projectController.enqueueProjects({ current: params.id, previous: null })
        },
        async afterUpdate(result, params, data) {
            // console.log('data', data)
            if (data._internal) {
                return
            }
            await projectController.updateQueuedProjects()
        },
      },
};

let calculateProjectInfo = async (result, params) => {
    const data = await projectController.calculateProjectInfo(result, params.id)
    return data
}
