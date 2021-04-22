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
            
            data = await calculateTotals(data)
        },
      },
};


let calculateTotals = async (data) => {
    data.total_base = 0;
    data.total_vat = 0;
    data.total_irpf = 0;
    data.total = 0

    const count = await strapi.query('invoice').count({ serial: data.serial });

    if (!data.code) {
        data.number = count + 1    
        data.code = `${data.serial}-${count + 1}`
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