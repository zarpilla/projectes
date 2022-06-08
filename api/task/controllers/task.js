"use strict";
const moment = require("moment");
const _ = require("lodash");

let sendEmail = async (data, config) => {
  if (!data) {
    return;
  }

  let emailFrom = strapi.config.get("plugins.email.settings.defaultFrom", "");

  let text = `Atenció, tens <a target='_blank' href='${config.front_url}tasks'>tasques o checklists</a> amb la data límit superada:<br><br>`;
  data.rows.forEach((r) => {
    text += ` - ${r.name}: ${moment(r.date, "YYYY-MM-DD").format(
      "DD/MM/YYYY"
    )}<br>`; // " - " + r.name +  "<br>";
  });

  // send an email by using the email plugin
  if (data.email === process.env.TASK_EMAIL_TO || process.env.TASK_EMAIL_TO === '*') {
    await strapi.plugins["email"].services.email.send({
      to: data.email,
      from: emailFrom,
      subject: "[STRAPI COOP] Tasques amb la data límit superada",
      html: text,
    });
  }
  return text;
};

module.exports = {
  async email(ctx) {
    const messages = [];

    const tasks = await strapi
      .query("task")
      .find({ task_state_ne: 3, archived_eq: false, _limit: -1 });

    const expired = tasks.filter(
      (t) => t.due_date <= moment().format("YYYY-MM-DD")
    );

    expired.forEach((e) => {
      e.users_permissions_users.forEach((u) => {
        messages.push({
          id: e.id,
          name: e.name,
          project: e.project?.name,
          username: u.username,
          email: u.email,
          scope: "task",
          date: e.due_date,
        });
      });
    });

    const checklists = tasks.filter(
      (t) =>
        t.checklist &&
        t.checklist.length &&
        t.checklist.find(
          (c) =>
            c.done === false &&
            c.due_date &&
            c.due_date <= moment().format("YYYY-MM-DD")
        )
    );

    checklists.forEach((e) => {
      e.users_permissions_users.forEach((u) => {
        messages.push({
          id: e.id,
          name: e.name,
          project: e.project?.name,
          username: u.username,
          email: u.email,
          scope: "task-checklist",
          date: e.due_date,
        });
        e.checklist.forEach((c) => {
          if (c.done === false && c.due_date <= moment().format("YYYY-MM-DD")) {
            messages.push({
              id: e.id,
              name: e.name,
              project: e.project?.name,
              username: c.user?.username,
              email: c.user?.email,
              scope: "checklist",
              date: c.due_date,
            });
          }
        });
      });
    });

    const emails = _(messages)
      .groupBy("email")
      .map((rows, email) => {
        return {
          email: email,
          rows: _.uniqBy(rows, "id"),
        };
      })
      .value();

    const config = await strapi.query("config").findOne({});

    const sentEmails = [];

    if (emails.length) {
      for (var i = 0; i < emails.length; i++) {
        const msg = await sendEmail(emails[i], config);
        sentEmails.push(msg);
      }
    }

    return { expired, checklists, messages, emails, sentEmails };
  },
};
