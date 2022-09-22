'use strict';
const projectController = require('../../project/controllers/project');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            data = await calculateTotals(data)
            await projectController.enqueueProjects({ current: data.project, previous: null })
        },
        async afterCreate(result) {
            projectController.updateQueuedProjects()
        },
        async beforeUpdate(params, data) {
            const invoice = await strapi.query('emitted-grant').findOne(params);
            if (invoice.updatable === false && !(data.updatable_admin === true)) {
                throw new Error('Invoice NOT updatable')
            }
            data.updatable_admin = false
            // console.log('invoice data', data)
            data = await calculateTotals(data)
            if (data.project && invoice.project) {
                await projectController.enqueueProjects({ current: data.project, previous: invoice.project.id })
            }
        },
        async afterUpdate(result, params, data) {            
            projectController.updateQueuedProjects()
        },
        async beforeDelete(params) {
            const invoice = await strapi.query('emitted-grant').findOne(params);
            if (invoice.updatable === false) {
                throw new Error('Invoice NOT updatable')
            }
            if (invoice.project) {
                await projectController.enqueueProjects({ current: null, previous: invoice.project.id })
            }
        },
        async afterDelete(result, params) {
            projectController.updateQueuedProjects()
        }
      },
};


let calculateTotals = async (data) => {    
    data.total = 0
    if (!data.code) {
        const serial = await strapi.query('serie').findOne({ id: data.serial });
        if (!data.number) {
            const quotes = await strapi.query('emitted-grant').find({ serial: data.serial, _limit: -1 });
            data.number = quotes.length + 1
        }
        const zeroPad = (num, places) => String(num).padStart(places, '0')
        const places = serial.leadingZeros || 1
        data.code = `${serial.name}-${zeroPad(data.number, places)}`
    }

    data.total = ( data.total_base || 0) + ( data.total_vat || 0) - (data.total_irpf || 0)

    return data;

}