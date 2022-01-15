'use strict';

const _ = require('lodash');
const projectController = require('../controllers/project');

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async afterFindOne(result, params, populate) {
            result = await calculateProjectInfo(result, params)
        },
        // afterFind: async (results, params, populate) => {
        //     const promises = results.map(r => doTotalCalculations(r, { id: r.id }))
        //     const updatedResults = await Promise.all(promises)
        //     results.forEach((result, i) => {
        //         result = updatedResults[i]
        //     })
        // },
        async beforeUpdate(params, data) {
            data = await updateProjectInfo(data, params)
        }
      },
};


let updateProjectInfo = async (result, params) => {
    const data = await projectController.calculateProjectInfo(result, params.id)
    return data
}

let calculateProjectInfo = async (result, params) => {    
    const data = await projectController.calculateProjectInfo({ result, id: params.id })
    return data
}
