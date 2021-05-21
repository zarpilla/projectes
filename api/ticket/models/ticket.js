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
            const invoice = await strapi.query('ticket').findOne(params);
            if (invoice.updatable === false && !(data.updatable_admin === true)) {
                throw new Error('Ticket NOT updatable')
            }
            data.updatable_admin = false
            // console.log('invoice data', data)
            data = await calculateTotals(data)
        },        
        async beforeDelete(params) {
            const invoice = await strapi.query('ticket').findOne(params);
            if (invoice.updatable === false) {
                throw new Error('Ticket updatable')
            }
        },
      },
};


let calculateTotals = async (data) => {
    data.total_base = 0;
    data.total_vat = 0;
    data.total_irpf = 0;
    data.total = 0

    if (!data.code) {
        const serial = await strapi.query('serie').findOne({ id: data.serial });
        const quotes = await strapi.query('ticket').find({ serial: data.serial });
        data.number = quotes.length + 1
        data.code = `${serial.name}-${(quotes.length + 1)}`
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
