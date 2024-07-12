'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async beforeCreate(data) {
            console.log('beforeCreate', data)

            const me = await strapi.query('me').findOne()
            if (!me.contact_form_email) {
                throw new Error('contact_form_email not set')
            }

            const to = [me.contact_form_email, data.email]
            const from = strapi.config.get("plugins.email.settings.defaultFrom", "");
            const subject = `[ESSSTRAPIS] Contacte a través del formulari`
            const userData = await strapi.query('user', 'users-permissions').findOne(data.user)            
            const html = `
            <b>Contacte a través del formulari</b><br><br>
            PROVEÏDORA: ${userData.fullname || userData.username} (${userData.id})<br>
            CORREU: ${data.email} <br> 
            NOM: ${data.name} <br>             
            MISSATGE: ${data.message} <br><br> 
            --<br>
            Missatge automàtic. Gràcies per contactar amb nosaltres.<br>
            ${me.name}<br>
            --<br>`
            //console.log('me', me)
            

            await strapi.plugins["email"].services.email.send({
                to,
                from,
                subject,
                html
              });

        }
    }
};

