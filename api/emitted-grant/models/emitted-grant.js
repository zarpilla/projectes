'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {

            data = await calculateTotals(data)

        },
        async beforeUpdate(params, data) {
            const invoice = await strapi.query('emitted-grant').findOne(params);
            if (invoice.updatable === false && !(data.updatable_admin === true)) {
                throw new Error('Invoice NOT updatable')
            }
            data.updatable_admin = false
            // console.log('invoice data', data)
            data = await calculateTotals(data)
        },        
        async beforeDelete(params) {
            const invoice = await strapi.query('emitted-grant').findOne(params);
            if (invoice.updatable === false) {
                throw new Error('Invoice NOT updatable')
            }
        },
      },
};


let calculateTotals = async (data) => {    
    data.total = 0
console.log('data', data)
    if (!data.code) {
        const serial = await strapi.query('serie').findOne({ id: data.serial });
        const quotes = await strapi.query('emitted-grant').find({ serial: data.serial });
        data.number = quotes.length + 1
        data.code = `${serial.name}-${(quotes.length + 1)}`
    }

    data.total = ( data.total_base || 0) + ( data.total_vat || 0) - (data.total_irpf || 0)

    return data;

}