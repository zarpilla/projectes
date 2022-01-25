'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */


module.exports = {
    lifecycles: {
        async afterFindOne(result, params, populate) {
            if (!result.pdf) {
                const config = await strapi.query('config').findOne();
                const pdf = `${config.front_url}quote/${params.id}`
                result.pdf = pdf
            }            
        },
        async beforeCreate(data) {
            data = await calculateTotals(data)            

        },
        async afterCreate(result) {
            // data = await calculateTotals(data)
            // data = await setPDFPath(0, data)            
            console.log('result', result)
            await setPDFAfterCreation(result.id)

        },
        async beforeUpdate(params, data) {
            console.log('params', params)
            data = await calculateTotals(data)
        }
      },
};


let calculateTotals = async (data) => {
    if (data._internal) {
        return
    }
    data.total_base = 0;
    data.total_vat = 0;
    data.total_irpf = 0;
    data.total = 0

    if (!data.code) {
        const serial = await strapi.query('serie').findOne({ id: data.serial });
        const quotes = await strapi.query('quote').find({ serial: data.serial, _limit: -1 });
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
            let irpf = 0; // base * (i.irpf ? i.irpf : 0) / 100.0;

            total_base += base
            total_vat += vat
            total_irpf += irpf

        })

        data.total_base = total_base
        data.total_vat = total_vat
        data.total_irpf = total_irpf

        data.total = data.total_base + data.total_vat - data.total_irpf
    }

    // if (!data.pdf) {
    //     const config = await strapi.query('config').findOne();
    //     const pdf = `${config.front_url}quote/${data.id}`
    //     data.pdf = pdf
    // }

    return data;

}

let setPDFAfterCreation = async (id) => {
    const config = await strapi.query('config').findOne();
    const pdf = `${config.front_url}quote/${id}`
    await strapi.query('quote').update(
        { id: id },
        {
            pdf: pdf,
            _internal: true
        });
}