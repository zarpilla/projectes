"use strict";
const { scheduleFromEntityProjects } = require("../../project/services/totalsRefreshScheduler");
const entity = "received-grant";
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      data = await calculateTotals(data);
    },
    async afterCreate(result) {
      scheduleFromEntityProjects(result);
    },
    async beforeUpdate(params, data) {
      const invoice = await strapi.query(entity).findOne(params);
      if (invoice.updatable === false && !(data.updatable_admin === true)) {
        throw new Error("received-grant NOT updatable");
      }
      data.updatable_admin = false;
      data = await calculateTotals(data);
    },
    async afterUpdate(result, params, data) {
      scheduleFromEntityProjects(result);
      scheduleFromEntityProjects(data);
    },
    async beforeDelete(params) {
      const invoice = await strapi.query(entity).findOne(params);
      if (invoice.updatable === false) {
        throw new Error("received-grant NOT updatable");
      }
      scheduleFromEntityProjects(invoice);
    },
  },
};

let calculateTotals = async (data) => {
  data.total = 0;

  if (!data.code) {
    const serial = await strapi.query("serie").findOne({ id: data.serial });
    if (!data.number) {
      const quotes = await strapi
        .query("received-grant")
        .find({ serial: data.serial, _limit: -1 });
      data.number = quotes.length + 1;
    }
    const zeroPad = (num, places) => String(num).padStart(places, "0");
    const places = serial.leadingZeros || 1;
    data.code = `${serial.name}-${zeroPad(data.number, places)}`;
  }

  data.total =
    (data.total_base || 0) + (data.total_vat || 0) - (data.total_irpf || 0);

  return data;
};
