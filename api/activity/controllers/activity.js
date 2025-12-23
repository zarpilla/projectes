"use strict";
const { sanitizeEntity } = require("strapi-utils");
const _ = require("lodash");
const moment = require("moment");
const ical = require("node-ical");
const { RRule } = require("rrule");
const projectController = require("../../project/controllers/project");
const { google } = require("googleapis");
const fs = require("fs");

// Polyfill for Headers in Node.js < 18
if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {
    constructor(init) {
      this.headers = {};
      if (init) {
        if (init instanceof Headers) {
          this.headers = { ...init.headers };
        } else if (typeof init === 'object') {
          Object.entries(init).forEach(([key, value]) => {
            this.headers[key.toLowerCase()] = String(value);
          });
        }
      }
    }
    
    append(name, value) {
      const key = name.toLowerCase();
      if (this.headers[key]) {
        this.headers[key] += ', ' + value;
      } else {
        this.headers[key] = String(value);
      }
    }
    
    delete(name) {
      delete this.headers[name.toLowerCase()];
    }
    
    get(name) {
      return this.headers[name.toLowerCase()] || null;
    }
    
    has(name) {
      return name.toLowerCase() in this.headers;
    }
    
    set(name, value) {
      this.headers[name.toLowerCase()] = String(value);
    }
    
    entries() {
      return Object.entries(this.headers)[Symbol.iterator]();
    }
    
    keys() {
      return Object.keys(this.headers)[Symbol.iterator]();
    }
    
    values() {
      return Object.values(this.headers)[Symbol.iterator]();
    }
    
    forEach(callback, thisArg) {
      Object.entries(this.headers).forEach(([key, value]) => {
        callback.call(thisArg, value, key, this);
      });
    }
    
    [Symbol.iterator]() {
      return this.entries();
    }
  };
}

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  getForCalendar: async (ctx) => {
    const activities = await strapi.query("activity").find(ctx.query);

    const activitiesInfo = activities.map((entity) => {
      const { project, users_permissions_user,...activity } = entity      
      const { id, username, email, ical, ...rest } = users_permissions_user
      entity.users_permissions_user = { id, username, email, ical }      
      if (project) {
        if (!project.project_phases) {
          project.project_phases = []
        }
        if (!project.documents) {
          project.documents = []
        }
        if (!project.project_original_phases) {
          project.project_original_phases = []
        }
        const { project_phases, project_original_phases, documents, ...projectData } = project
        entity.project = projectData
      }
      
      return entity
    }
    );
    ctx.send(activitiesInfo);
  },
  totalByDay: async (ctx) => {
    let activities;
    if (ctx.query._q) {
      activities = await strapi.query("activity").search(ctx.query);
    } else {
      activities = await strapi.query("activity").find(ctx.query);
    }

    const activitiesByDay = activities.map((entity) => {
      const { hours, date, ...rest } = entity;
      return { hours: rest.project && rest.project.id ? hours: 0, date };
    });

    const grouped = _(activitiesByDay)
      .groupBy("date")
      .map((rows, id) => {
        return {
          date: id,
          hours: _.sumBy(rows, "hours"),
        };
      });

    ctx.send(grouped);
  },

  importCalendar: async (ctx) => {
    const { id } = ctx.params;
    const { from, to } = ctx.query;

    const me = await strapi.query("me").findOne();
    
    const user = await strapi
      .query("user", "users-permissions")
      .findOne({ id });

    // Set default date range if not provided (e.g., current month)
    const fromDate = from ? moment(from) : moment().startOf('month');
    const toDate = to ? moment(to) : moment().endOf('month');

    // Validate date format
    if (from && !moment(from, 'YYYY-MM-DD', true).isValid()) {
      return ctx.badRequest('Invalid from date format. Use YYYY-MM-DD');
    }
    if (to && !moment(to, 'YYYY-MM-DD', true).isValid()) {
      return ctx.badRequest('Invalid to date format. Use YYYY-MM-DD');
    }

    const google_credentials = me ? me.google_credentials : null;
    const allEvents = [];

    // Helper function to fetch Google Calendar events
    const fetchGoogleCalendarEvents = async (calendarId, userEmail) => {
      try {
        const jsonCredentialsPath = "./public" + google_credentials.url;
        
        if (!fs.existsSync(jsonCredentialsPath)) {
          console.error('Google credentials file not found:', jsonCredentialsPath);
          return [];
        }

        const credentialsContent = fs.readFileSync(jsonCredentialsPath, 'utf8');
        const credentials = JSON.parse(credentialsContent);
        
        // Validate that it's a service account credentials file
        if (!credentials.client_email) {
          console.error('Invalid Google credentials file: missing client_email field');
          console.error('Expected service account credentials file. Got:', Object.keys(credentials));
          return [];
        }

        console.log('Using service account:', credentials.client_email);
        
        const auth = new google.auth.GoogleAuth({
          credentials: credentials,
          scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        });

        const calendar = google.calendar({ version: 'v3', auth });

        const response = await calendar.events.list({
          calendarId: calendarId,
          timeMin: fromDate.toISOString(),
          timeMax: toDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        });

        console.log('Fetched Google Calendar events for calendarId:', calendarId);

        const events = response.data.items || [];
        const formattedEvents = [];

        for (const event of events) {
          // Check if user has declined the event
          let hasDeclined = false;
          let userIsAttendee = false;

          if (event.attendees) {
            for (const attendee of event.attendees) {
              if (attendee.email === userEmail) {
                userIsAttendee = true;
                if (attendee.responseStatus === 'declined') {
                  hasDeclined = true;
                }
                break;
              }
            }
          }

          // Skip declined events
          if (hasDeclined) {
            continue;
          }

          // Convert Google Calendar event to iCal-like format
          const icalEvent = {
            type: 'VEVENT',
            uid: event.id,
            summary: event.summary || '(No title)',
            description: event.description || '',
            start: event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date),
            end: event.end.dateTime ? new Date(event.end.dateTime) : new Date(event.end.date),
            location: event.location || '',
            organizer: event.organizer ? {
              params: { CN: event.organizer.email },
              val: 'mailto:' + event.organizer.email
            } : null,
            attendee: event.attendees ? event.attendees.map(att => ({
              params: {
                CN: att.email,
                PARTSTAT: att.responseStatus === 'accepted' ? 'ACCEPTED' :
                          att.responseStatus === 'declined' ? 'DECLINED' :
                          att.responseStatus === 'tentative' ? 'TENTATIVE' : 'NEEDS-ACTION'
              },
              val: 'mailto:' + att.email
            })) : [],
            status: event.status ? event.status.toUpperCase() : 'CONFIRMED',
            created: event.created ? new Date(event.created) : null,
            lastmodified: event.updated ? new Date(event.updated) : null,
            url: event.htmlLink || '',
            isGoogleCalendar: true,
          };

          // Handle recurring events
          if (event.recurrence) {
            // Google Calendar already expands recurring events when singleEvents=true
            // So we just add the instance
            icalEvent.isRecurring = true;
          }

          formattedEvents.push(icalEvent);
        }

        return formattedEvents;
      } catch (error) {
        console.error('Error fetching Google Calendar events:', error);
        return [];
      }
    };

    // Helper function to expand recurring events
    const expandRecurringEvents = (event, fromDate, toDate) => {
      const expandedEvents = [];
      
      // If it's not a recurring event, check if it falls within the date range
      if (!event.rrule) {
        const eventStart = moment(event.start);
        if (eventStart.isBetween(fromDate, toDate, 'day', '[]')) {
          expandedEvents.push(event);
        }
        return expandedEvents;
      }

      try {
        // Parse the RRULE
        const rruleOptions = RRule.parseString(event.rrule.toString());
        
        // Set the dtstart from the event
        if (event.start) {
          rruleOptions.dtstart = new Date(event.start);
        }

        // Create RRule instance
        const rule = new RRule(rruleOptions);
        
        // Generate occurrences within the date range
        const occurrences = rule.between(
          fromDate.toDate(),
          toDate.toDate(),
          true // include start date
        );

        // Create an event instance for each occurrence
        occurrences.forEach(occurrence => {
          const eventInstance = { ...event };
          
          // Calculate the duration of the original event
          const originalStart = moment(event.start);
          const originalEnd = moment(event.end);
          const duration = originalEnd.diff(originalStart);
          
          // Set new start and end times for this occurrence
          eventInstance.start = occurrence;
          eventInstance.end = new Date(occurrence.getTime() + duration);
          
          // Add a flag to indicate this is a recurring instance
          eventInstance.isRecurring = true;
          eventInstance.recurringDate = moment(occurrence).format('YYYY-MM-DD');
          
          expandedEvents.push(eventInstance);
        });
        
      } catch (error) {
        console.error('Error parsing RRULE:', error);
        // If we can't parse the RRULE, include the original event if it's in range
        const eventStart = moment(event.start);
        if (eventStart.isBetween(fromDate, toDate, 'day', '[]')) {
          expandedEvents.push(event);
        }
      }

      return expandedEvents;
    };

    // Check if we should use Google Calendar integration
    const useGoogleCalendar = google_credentials && google_credentials.url;

    // Process user's personal calendar
    if (user) {
      if (useGoogleCalendar && user.email) {
        // Use Google Calendar API - user's email is their primary calendar ID
        try {
          const googleEvents = await fetchGoogleCalendarEvents(user.email, user.email);
          allEvents.push(...googleEvents);
        } catch (error) {
          console.error('Error fetching user Google Calendar:', error);
        }
      } else if (user.ical && user.ical.startsWith("http")) {
        // Use iCal (fallback or default)
        try {
          const resp = await ical.async.fromURL(user.ical);

          for (let k in resp) {
            if (resp[k].type === "VEVENT") {
              // Check if user has declined the event (even in personal calendar)
              let hasDeclined = false;
              let userIsAttendee = false;
              
              if (resp[k].attendee) {
                // Handle both single attendee and array of attendees
                const attendees = Array.isArray(resp[k].attendee) ? resp[k].attendee : [resp[k].attendee];
                
                for (let attendee of attendees) {
                  if (attendee.params && attendee.params.CN === user.email) {
                    userIsAttendee = true;
                    // Check if the user has declined the event
                    if (attendee.params.PARTSTAT === 'DECLINED') {
                      hasDeclined = true;
                    }
                    break;
                  }
                }
              }
              
              // For personal calendar, only include events where:
              // 1. User has no attendee list (they're the organizer/owner), OR
              // 2. User is an attendee and hasn't declined
              const hasAttendees = resp[k].attendee && resp[k].attendee.length > 0;
              const shouldInclude = hasAttendees ? (userIsAttendee && !hasDeclined) : true;
              
              if (shouldInclude) {
                const expandedEvents = expandRecurringEvents(resp[k], fromDate, toDate);
                allEvents.push(...expandedEvents);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user calendar:', error);
        }
      }
    }

    // Process shared/me calendar (only for iCal, not for Google Calendar)
    if (me && !useGoogleCalendar) {
      if (me.ical && me.ical.startsWith("http")) {
        // Use iCal for shared calendar
        try {
          const resp = await ical.async.fromURL(me.ical);
          
          for (let k in resp) {
            if (resp[k].type === "VEVENT") {
              // Check if user is an attendee and hasn't declined
              let isAttendee = false;
              let hasDeclined = false;
              
              if (resp[k].attendee) {
                // Handle both single attendee and array of attendees
                const attendees = Array.isArray(resp[k].attendee) ? resp[k].attendee : [resp[k].attendee];
                
                for (let attendee of attendees) {
                  if (attendee.params && attendee.params.CN === user.email) {
                    isAttendee = true;
                    // Check if the user has declined the event
                    if (attendee.params.PARTSTAT === 'DECLINED') {
                      hasDeclined = true;
                    }
                    break;
                  }
                }
              }
              
              // Only include events where user is an attendee and hasn't declined
              if (isAttendee && !hasDeclined) {
                const expandedEvents = expandRecurringEvents(resp[k], fromDate, toDate);
                allEvents.push(...expandedEvents);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching shared calendar:', error);
        }
      }
    }

    // Sort events by start date
    allEvents.sort((a, b) => moment(a.start).diff(moment(b.start)));

    ctx.send({ 
      ical: allEvents,
      dateRange: {
        from: fromDate.format('YYYY-MM-DD'),
        to: toDate.format('YYYY-MM-DD')
      },
      totalEvents: allEvents.length
    });
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
