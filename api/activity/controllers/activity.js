"use strict";
const { sanitizeEntity } = require("strapi-utils");
const _ = require("lodash");
const moment = require("moment");
const ical = require("node-ical");
const projectController = require("../../project/controllers/project");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  totalByDay: async (ctx) => {
    let activities;
    if (ctx.query._q) {
      activities = await strapi.query("activity").search(ctx.query);
    } else {
      activities = await strapi.query("activity").find(ctx.query);
    }

    const activitiesByDay = activities.map((entity) => {
      const { hours, date, rest } = entity;
      return { hours, date };
    });

    const grouped = _(activitiesByDay)
      .groupBy("date")
      .map((rows, id) => {
        return {
          date: id,
          hours: _.sumBy(rows, "hours"),
        };
      });

    // return activities.map((entity) => {
    //   const { hours, date, rest } = entity
    //   return { hours, date }
    // }
    // );
    ctx.send(grouped);
  },

  importCalendar: async (ctx) => {
    const { id } = ctx.params;
    const user = await strapi
      .query("user", "users-permissions")
      .findOne({ id });

    const events = [];

    if (user && user.ical && user.ical.startsWith("http")) {
      const resp = await ical.async.fromURL(user.ical);

      for (let k in resp) {
        if (resp[k].type === "VEVENT") events.push(resp[k]);
      }
    }

    const me = await strapi.query("me").findOne();

    if (me && me.ical && me.ical.startsWith("http")) {
      const resp = await ical.async.fromURL(me.ical);
      for (let k in resp) {
        if (resp[k].type === "VEVENT") events.push(resp[k]);
      }
    }

    ctx.send({ ical: events });
  },

  move: async (ctx) => {
    const { user, from, to, start, end } = ctx.request.body;
    if (to) {
      const filter = {
        _limit: -1,
        project: from,
        date_gte: start,
        date_lte: end,
      };
      if (user) {
        filter.users_permissions_user = user;
      }
      const activities = await strapi.query("activity").find(filter);
      for (let i = 0; i < activities.length; i++) {
        const activity = activities[i];
        const activityToUpdate = { project: to, _internal: true };
        await strapi
          .query("activity")
          .update({ id: activity.id }, activityToUpdate);
      }
      await projectController.setDirty(to);
      await projectController.setDirty(from);
    }

    ctx.send({ user, from, to, start, end });
  },

  import: async (ctx) => {
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
