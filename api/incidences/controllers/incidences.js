'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { sanitizeEntity } = require('strapi-utils');
const moment = require('moment');

module.exports = {
    async update(ctx) {
        const { id } = ctx.params;

        let entity;
        
        // Add the current user ID to the params so lifecycle hooks can access it
        if (ctx.state.user) {
            ctx.params.id_user = ctx.state.user.id;
        }

        entity = await strapi.services.incidences.update({ id }, ctx.request.body);

        return sanitizeEntity(entity, { model: strapi.models.incidences });
    },
    
    infoAll: async (ctx) => {
        const { year, month, ...query } = ctx.query;

        // Add date filtering based on year/month if provided
        if (year && !isNaN(year)) {
            query['created_at_gte'] = `${year}-01-01`;
            query['created_at_lte'] = `${year}-12-31`;
        }

        if (month && !isNaN(month)) {
            query['created_at_gte'] = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDayNumberOfMonth = moment(`${year}-${month}`, 'YYYY-MM').daysInMonth();
            query['created_at_lte'] = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNumberOfMonth).padStart(2, '0')}`;
        }

        // Fetch incidences with populated order, owner and route
        const incidences = await strapi.query('incidences').find(
            {
                ...query,
                _limit: query._limit || -1,
                _sort: query._sort || 'id:DESC'
            },
            [
                'created_user',
                'closed_user',
                'order',
                'order.owner',
                'order.route'
            ]
        );

        const incidencesInfo = incidences.map((incidence) => {
            const createdAt = incidence.created_at ? moment(incidence.created_at) : null;
            const yearValue = createdAt ? createdAt.year() : null;
            const monthValue = createdAt ? createdAt.month() + 1 : null;

            return {
                id: incidence.id,
                count: 1,
                owner: incidence.order?.owner ? `${incidence.order.owner}` : 'Sense sòcia',
                owner_name: incidence.order?.owner?.fullname || incidence.order?.owner?.username || 'Sense sòcia',
                created_user: incidence.created_user?.fullname || incidence.created_user?.username || 'Desconegut',
                created_user_id: incidence.created_user?.id || null,
                route: incidence.order?.route ? `${incidence.order.route}` : 'Sense ruta',
                route_name: incidence.order?.route?.short_name || incidence.order?.route?.name || 'Sense ruta',
                state: incidence.state === 'open' ? 'Oberta' : 'Tancada',
                state_raw: incidence.state,
                created_at: createdAt ? createdAt.format('YYYY-MM-DD') : null,
                closed_date: incidence.closed_date ? moment(incidence.closed_date).format('YYYY-MM-DD') : null,
                closed_user: incidence.closed_user?.fullname || incidence.closed_user?.username || null,
                description: incidence.description,
                order_id: incidence.order?.id || null,
                year: yearValue ? `${yearValue}` : null,
                month: monthValue ? `${monthValue}` : null
            };
        });

        ctx.send(incidencesInfo);
        return;
    }
};
