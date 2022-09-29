"use strict";
const projectController = require("../../project/controllers/project");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

let previousProjectId = 0;

module.exports = {
  lifecycles: {
    async afterFindOne(result, params, populate) {
      if (!result.pdf) {
        const config = await strapi.query("config").findOne();
        const pdf = `${config.front_url}invoice/${params.id}`;
        result.pdf = pdf;
      }
    },
    async beforeCreate(data) {
      data = await calculateTotals(data);
      await projectController.enqueueProjects({
        current: data.project,
        previous: null,
      });
    },
    async afterCreate(result) {
      await setPDFAfterCreation(result.id);
      projectController.updateQueuedProjects();
    },
    async beforeUpdate(params, data) {
      const invoice = await strapi.query("emitted-invoice").findOne(params);
      if (invoice.updatable === false && !(data.updatable_admin === true)) {
        throw new Error("Invoice NOT updatable");
      }
      data.updatable_admin = false;
      data = await calculateTotals(data);
      let p1 = data && data.project ? data.project : null;
      let p2 = invoice && invoice.project ? invoice.project.id : null;
      if (p1 || p2) {
        await projectController.enqueueProjects({
          current: p1,
          previous: p2,
        });
      }
    },
    async afterUpdate(result, params, data) {
      projectController.updateQueuedProjects();
    },
    async beforeDelete(params) {
      const invoice = await strapi.query("emitted-invoice").findOne(params);
      if (invoice.updatable === false) {
        throw new Error("Invoice NOT updatable");
      }
      if (invoice.project) {
        await projectController.enqueueProjects({
          current: null,
          previous: invoice.project.id,
        });
      }
    },
    async afterDelete(result, params) {
      projectController.updateQueuedProjects();
    },
  },
};

let calculateTotals = async (data) => {
  if (data._internal) {
    return;
  }
  data.total_base = 0;
  data.total_vat = 0;
  data.total_irpf = 0;
  data.total = 0;

  if (!data.code) {
    const serial = await strapi.query("serie").findOne({ id: data.serial });
    if (!data.number) {
      const quotes = await strapi
        .query("emitted-invoice")
        .find({ serial: data.serial, _limit: -1 });
      data.number = quotes.length + 1;
    }
    const zeroPad = (num, places) => String(num).padStart(places, "0");
    const places = serial.leadingZeros || 1;
    data.code = `${serial.name}-${zeroPad(data.number, places)}`;
  }

  if (data.lines) {
    let total_base = 0;
    let total_vat = 0;
    let total_irpf = 0;
    data.lines.forEach((i) => {
      let base = (i.base ? i.base : 0) * (i.quantity ? i.quantity : 0);
      if (i.discount) {
        base = base * (1 - i.discount / 100.0);
      }
      let vat = (base * (i.vat ? i.vat : 0)) / 100.0;
      let irpf = (base * (i.irpf ? i.irpf : 0)) / 100.0;

      total_base += base;
      total_vat += vat;
      total_irpf += irpf;
    });

    data.total_base = total_base;
    data.total_vat = total_vat;
    data.total_irpf = total_irpf;

    data.total = data.total_base + data.total_vat - data.total_irpf;
  }

  return data;
};

let setPDFAfterCreation = async (id) => {
  const config = await strapi.query("config").findOne();
  const pdf = `${config.front_url}invoice/${id}`;
  await strapi.query("emitted-invoice").update(
    { id: id },
    {
      pdf: pdf,
      _internal: true,
    }
  );
};
