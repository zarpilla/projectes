'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {

            data = await calculateCodeName(data)

        },
        async beforeUpdate(params, data) {        
            
            data = await calculateCodeName(data)
        },
      },
};


let calculateCodeName = async (data) => {
    data.code_name = `${data.code} - ${data.name}` 
};