'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {};


'use strict';

const _ = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            if (data.delivery_type && data.delivery_type.id) {
                const deliveryTypes = await strapi.services['delivery-type'].find();
                const deliveryType = deliveryTypes.find(d => d.id === data.delivery_type.id)
                if (deliveryType && deliveryType.refrigerated) {
                    data.refrigerated = 1
                } else {
                    data.refrigerated = 0
                }
            }
            else if (data.delivery_type) {
                const deliveryTypes = await strapi.services['delivery-type'].find();
                const deliveryType = deliveryTypes.find(d => d.id === data.delivery_type)
                if (deliveryType && deliveryType.refrigerated) {
                    data.refrigerated = 1
                } else {
                    data.refrigerated = 0
                }
            }
            if (data.status === 'lastmile') {
                data.last_mile = true
            }
        },        
        async beforeUpdate(params, data) {
            if (data.status === 'delivered' && !data.delivery_date) {
                data.delivery_date = new Date()
            }
            if (data.status === 'lastmile') {
                data.last_mile = true
            }
            if (data.delivery_type && data.delivery_type.id) {
                const deliveryTypes = await strapi.services['delivery-type'].find();
                const deliveryType = deliveryTypes.find(d => d.id === data.delivery_type.id)
                if (deliveryType && deliveryType.refrigerated) {
                    data.refrigerated = 1
                } else {
                    data.refrigerated = 0
                }
            }
            else if (data.delivery_type) {
                const deliveryTypes = await strapi.services['delivery-type'].find();
                const deliveryType = deliveryTypes.find(d => d.id === data.delivery_type)
                if (deliveryType && deliveryType.refrigerated) {
                    data.refrigerated = 1
                } else {
                    data.refrigerated = 0
                }
            }
        },   

        // afterFind: async (results, params, populate) => {
        //     results.forEach((res, i) => {                
        //         res.refrigerated = 1
        //     })
        // },
        // async afterFindOne(result, params, populate) {
        //     if (result && !result.pdf) {
        //       const config = await strapi.query("config").findOne();
        //       const pdf = `${config.front_url}invoice/${params.id}`;
        //       result.pdf = pdf;
        //     }
        //   },
    }
};


