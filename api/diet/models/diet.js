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
            // await 
            projectController.updateQueuedProjects()
        },
        async beforeUpdate(params, data) {
            const invoice = await strapi.query('diet').findOne(params);
            if (invoice.updatable === false && !(data.updatable_admin === true)) {
                throw new Error('diet not updatable')
            }
            data.updatable_admin = false
            data = await calculateTotals(data)
            await projectController.enqueueProjects({ current: data?.project, previous: invoice?.project?.id })
        },
        async afterUpdate(result, params, data) {            
            // await
            projectController.updateQueuedProjects()
        },
        async beforeDelete(params) {
            const invoice = await strapi.query('diet').findOne(params);
            if (invoice.updatable === false) {
                throw new Error('diet not updatable')
            }
            await projectController.enqueueProjects({ current: null, previous: invoice.project?.id })
        },
        async afterDelete(result, params) {
            // await 
            projectController.updateQueuedProjects()
        }
      },
};


let calculateTotals = async (data) => {
    data.total_base = 0;
    data.total_vat = 0;
    data.total_irpf = 0;
    data.total = 0

    if (!data.code) {
        const serial = await strapi.query('serie').findOne({ id: data.serial });
        if (!data.number) {
            const quotes = await strapi.query('diet').find({ serial: data.serial, _limit: -1 });
            data.number = quotes.length + 1
        }
        const zeroPad = (num, places) => String(num).padStart(places, '0')
        const places = serial.leadingZeros || 1
        data.code = `${serial.name}-${zeroPad(data.number, places)}`
    }

    if (data.lines) {
        let total_base = 0
        let total_vat = 0
        let total_irpf = 0
        data.lines.forEach(i => {
            let base = (i.base ? i.base : 0 ) * (i.quantity ? i.quantity : 0);
            if (i.discount) {
                base = base * (1 - i.discount / 100.0)
            }
            let vat = base * (i.vat ? i.vat : 0) / 100.0;
            let irpf = base * (i.irpf ? i.irpf : 0) / 100.0;

            total_base += base
            total_vat += vat
            total_irpf += irpf

        })

        data.total_base = total_base
        data.total_vat = total_vat
        data.total_irpf = total_irpf

        data.total = data.total_base + data.total_vat - data.total_irpf
    }

    return data;

}

