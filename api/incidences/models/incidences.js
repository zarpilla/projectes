'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
    lifecycles: {
        async afterCreate(result, data) {
            try {
                await sendIncidenceEmail(result, 'created');
            } catch (error) {
                console.error('Error sending incidence creation email:', error);
            }
        },
        
        async beforeUpdate(params, data) {
            // Store the current user ID if available from the controller
            if (params.id_user) {
                this._currentUserId = params.id_user;
            }
        },
        
        async afterUpdate(result, params, data) {
            try {
                await sendIncidenceEmail(result, 'updated', this._currentUserId);
            } catch (error) {
                console.error('Error sending incidence update email:', error);
            }
        }
    }
};

async function sendIncidenceEmail(incidence, action, currentUserId = null) {
    // Get full incidence data with relations
    const fullIncidence = await strapi.query('incidences').findOne({ 
        id: incidence.id 
    }, ['order', 'order.owner', 'created_user', 'closed_user']);
    
    if (!fullIncidence || !fullIncidence.order) {
        console.error('Incidence or order not found');
        return;
    }

    // Get me settings for contact_form_email
    const me = await strapi.query('me').findOne();
    if (!me || !me.contact_form_email) {
        console.error('contact_form_email not set');
        return;
    }

    const order = fullIncidence.order;
    const orderOwner = order.owner;
    const from = strapi.config.get("plugins.email.settings.defaultFrom", "");
    
    // Determine who is performing the action
    let recipients = [];
    
    if (action === 'created') {
        // When created, send to contact_form_email and order owner
        recipients = me.contact_form_email.split(',').map(email => email.trim());
        if (orderOwner && orderOwner.email) {
            recipients.push(orderOwner.email);
        }
    } else if (action === 'updated') {
        // Check if the user updating is the order owner or an admin
        if (currentUserId && orderOwner && currentUserId === orderOwner.id) {
            // Order owner is updating, send to contact_form_email
            recipients = me.contact_form_email.split(',').map(email => email.trim());
        } else {
            // Admin is updating, send to order owner
            if (orderOwner && orderOwner.email) {
                recipients = [orderOwner.email];
            }
        }
    }

    if (recipients.length === 0) {
        console.log('No recipients for incidence email');
        return;
    }

    // Build email content
    let actionLabel = 'actualitzada';
    if (action === 'created') {
        actionLabel = 'creada';
    } else if (fullIncidence.state === 'closed') {
        actionLabel = 'tancada';
    }
    
    const subject = `[${me.name || 'ESSSTRAPIS'}] Incidència ${actionLabel} - Comanda #${order.id}`;
    
    const stateLabels = {
        'open': 'Oberta',
        'wip': 'En Procés',
        'closed': 'Tancada'
    };
    
    let responsesHtml = '';
    if (fullIncidence.incidence_response && fullIncidence.incidence_response.length > 0) {
        responsesHtml = '<br><b>Respostes:</b><br>';
        fullIncidence.incidence_response.forEach((response, index) => {
            responsesHtml += `<br>${index + 1}. ${response.text || 'Sense text'}<br>`;
            if (response.response_date) {
                responsesHtml += `Data: ${new Date(response.response_date).toLocaleString('ca-ES')}<br>`;
            }
        });
    }
    
    const html = `
    <b>Incidència ${action === 'created' ? 'Creada' : 'Actualitzada'}</b><br><br>
    <b>ID Incidència:</b> ${fullIncidence.id}<br>
    <b>Comanda:</b> #${order.id}<br>
    <b>Propietari Comanda:</b> ${orderOwner ? (orderOwner.fullname || orderOwner.username) : 'N/A'} ${orderOwner && orderOwner.email ? `(${orderOwner.email})` : ''}<br>
    <b>Estat:</b> ${stateLabels[fullIncidence.state] || fullIncidence.state}<br>
    <b>Descripció:</b> ${fullIncidence.description || 'N/A'}<br>
    ${fullIncidence.created_user ? `<b>Creat per:</b> ${fullIncidence.created_user.fullname || fullIncidence.created_user.username}<br>` : ''}
    ${fullIncidence.closed_date ? `<b>Data Tancament:</b> ${new Date(fullIncidence.closed_date).toLocaleString('ca-ES')}<br>` : ''}
    ${fullIncidence.closed_user ? `<b>Tancat per:</b> ${fullIncidence.closed_user.fullname || fullIncidence.closed_user.username}<br>` : ''}
    ${responsesHtml}
    <br>--<br>
    Missatge automàtic. Gràcies per la vostra atenció.<br>
    ${me.name || 'ESSSTRAPIS'}<br>
    --<br>`;

    await strapi.plugins["email"].services.email.send({
        to: recipients,
        from,
        subject,
        html
    });
    
    console.log(`Incidence ${action} email sent to:`, recipients);
}
