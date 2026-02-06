"use strict";
const moment = require("moment");
const _ = require("lodash");


let sendEmail = async (data, config) => {
  if (!data) {
    return;
  }

  let emailFrom = strapi.config.get("plugins.email.settings.defaultFrom", "");

  let text = "";
  let hasFinalWarnings = false;
  
  // Regular expired tasks (updated in the last 15 days)
  if (data.rows.filter((r) => r.type === "expired" && !r.shouldStop).length > 0) {
    text += `Hi ha <a target='_blank' href='${config.front_url}tasks'>tasques o checklists</a> amb la data límit superada:<br><br>`;
    data.rows
      .filter((r) => r.type === "expired" && !r.shouldStop)
      .forEach((r) => {
        text += ` - ${r.name}: ${moment(r.date, "YYYY-MM-DD").format(
          "DD/MM/YYYY"
        )}<br>`;
      });
    text += "<br><br>";
  }

  // Final warning for tasks expired > 15 days without updates
  if (data.rows.filter((r) => r.type === "expired" && r.shouldStop).length > 0) {
    hasFinalWarnings = true;
    text += `<strong>ÚLTIM AVÍS:</strong> Les següents tasques o checklists porten més de 15 dies amb la data límit superada i no s'han actualitzat. Deixareu de rebre notificacions sobre aquestes tasques:<br><br>`;
    data.rows
      .filter((r) => r.type === "expired" && r.shouldStop)
      .forEach((r) => {
        text += ` - ${r.name}: ${moment(r.date, "YYYY-MM-DD").format(
          "DD/MM/YYYY"
        )}<br>`;
      });
    text += "<br><br>";
  }

  if (data.rows.filter((r) => r.type === "new").length > 0) {
    text += `Hi ha canvis en <a target='_blank' href='${config.front_url}tasks'>tasques o checklists</a>:<br><br>`;
    data.rows
      .filter((r) => r.type === "new")
      .forEach((r) => {
        text += ` - ${r.name}<br>`;
      });
    text += "<br><br>";
  }

  // send an email by using the email plugin
  if (
    data.email === process.env.TASK_EMAIL_TO ||
    process.env.TASK_EMAIL_TO === "*"
  ) {
    const subject = hasFinalWarnings 
      ? "[ESSSTRAPIS] Resum de tasques - ÚLTIM AVÍS"
      : "[ESSSTRAPIS] Resum de tasques";
    
    await strapi.plugins["email"].services.email.send({
      to: data.email,
      from: emailFrom,
      subject: subject,
      html: text,
    });
  }
  return text;
};

module.exports = {
  async email(ctx) {
    const messages = [];
    const fifteenDaysAgo = moment().subtract(15, "days");

    const tasks = await strapi
      .query("task")
      .find({ task_state_ne: 3, archived_eq: false, _limit: -1 });

    const expired = tasks.filter(
      (t) => t.due_date <= moment().format("YYYY-MM-DD")
    );

    // Process expired tasks
    expired.forEach((e) => {
      e.users_permissions_users.forEach((u) => {
        // Check if task was updated in the last 15 days
        const wasRecentlyUpdated = moment(e.updated_at).isAfter(fifteenDaysAgo);
        const shouldStop = !wasRecentlyUpdated;

        messages.push({
          id: e.id,
          name: e.name,
          project: e.project ? e.project.name : "",
          username: u.username,
          email: u.email,
          type: "expired",
          scope: "task",
          date: e.due_date,
          shouldStop: shouldStop,
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

    // Process checklists
    checklists.forEach((e) => {
      const wasRecentlyUpdated = moment(e.updated_at).isAfter(fifteenDaysAgo);
      const shouldStop = !wasRecentlyUpdated;

      e.users_permissions_users.forEach((u) => {
        messages.push({
          id: e.id,
          name: e.name,
          project: e.project ? e.project.name : "",
          username: u.username,
          email: u.email,
          type: "expired",
          scope: "task-checklist",
          date: e.due_date,
          shouldStop: shouldStop,
        });
      });
      
      e.checklist.forEach((c) => {
        if (c.done === false && c.due_date <= moment().format("YYYY-MM-DD")) {
          messages.push({
            id: e.id,
            name: e.name,
            project: e.project ? e.project.name : "",
            username: c.user ? c.user.username : "",
            email: c.user ? c.user.email : "",
            type: "expired",
            scope: "checklist",
            date: c.due_date,
            shouldStop: shouldStop,
          });
        }
      });
    });

    const onedayBefore = moment().add(-1, "days");
    const newTasks = tasks.filter((t) =>
      moment(t.updated_at).isAfter(onedayBefore)
    );

    newTasks.forEach((e) => {
      e.users_permissions_users.forEach((u) => {
        if (
          e.created &&
          e.created.username &&
          u.username !== e.created.username
        ) {
          messages.push({
            id: e.id,
            name: e.name,
            project: e.project ? e.project.name : "",
            username: u.username,
            email: u.email,
            type: "new",
            scope: "task",
            date: e.due_date,
            shouldStop: false,
          });
        }
      });
    });

    const newChecklists = tasks.filter(
      (t) =>
        t.checklist &&
        t.checklist.length &&
        t.checklist.find(
          (c) =>
            c.done === false &&
            moment(c.created_date).isAfter(onedayBefore) &&
            c.created &&
            c.created.username &&
            c.user &&
            c.user.username &&
            c.created.username !== c.user.username
        )
    );

    newChecklists.forEach((e) => {
      e.checklist.forEach((c) => {
        if (
          c.done === false &&
          moment(c.created_date).isAfter(onedayBefore) &&
          c.created &&
          c.created.username &&
          c.user &&
          c.user.username &&
          c.created.username !== c.user.username
        ) {
          messages.push({
            id: e.id,
            name: e.name,
            project: e.project ? e.project.name : "",
            username: c.user.username,
            email: c.user.email,
            type: "new",
            scope: "checklist",
            date: c.due_date,
            shouldStop: false,
          });
        }
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
      for await (const email of emails) {
        const msg = await sendEmail(email, config);
        sentEmails.push(msg);
      }
    }

    return {
      expired,
      checklists,
      messages,
      newTasks,
      newChecklists,
      emails,
      sentEmails,
    };
  },
};
