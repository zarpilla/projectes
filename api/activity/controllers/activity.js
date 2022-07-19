'use strict';
const moment = require('moment')
// const axios = require('axios')
const ical = require('node-ical')


/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
    // GET /hello
    importCalendar: async ctx => {
        const { id } = ctx.params;
        const user = await strapi.query('user', 'users-permissions').findOne({ id });
        if (user && user.ical && user.ical.startsWith('http')) {            
            const resp = await ical.async.fromURL(user.ical)
            const events = []
            for(let k in resp) {
                if (resp[k].type === 'VEVENT')
                events.push(resp[k])
            }
            ctx.send({ ical: events })
            return
        }
        ctx.send({ ical: [] })
    },

    import: async ctx => {
        //const now = moment().add(-7, 'days').format('YYYY-MM-DD')
        //const activities = await strapi.services.activity.find();

        // const projects = await strapi.services.project.find();
        // const projects2 = projects.filter(p => p.dedication && p.dedication.length > 0);

        // for(var i = 0; i < projects2.length; i++) {
        //     const project = projects2[i]
        //     for(var j = 0; j < project.dedication.length; j++) {
        //         const d = project.dedication[j]
        //         // console.log('dedication', d)
        //         await strapi.services.activity.create({
        //             description: d.comment,
        //             hours: d.hours,
        //             project: project.id,
        //             users_permissions_user: d.users_permissions_user ? d.users_permissions_user.id : null,
        //             date: d.date,
        //             dedication_type: d.dedication_type ? d.dedication_type.id : null
        //         })
        //     }
        // }

        //return sanitizeEntity(entity, { model: strapi.models.article });
        //ctx.send(now);
        // ctx.send(projects2)
    },
  };
