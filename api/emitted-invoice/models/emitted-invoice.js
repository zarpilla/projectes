"use strict";
const projectController = require("../../project/controllers/project");
const emittedInvoiceController = require("../controllers/emitted-invoice");
const entity = "emitted-invoice";
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

let previousProjectId = 0;

module.exports = {
  lifecycles: {
    // async afterFindOne(result, params, populate) {
    //   if (result && !result.pdf) {
    //     const config = await strapi.query("config").findOne();
    //     const pdf = `${config.front_url}invoice/${params.id}`;
    //     result.pdf = pdf;
    //   }
    // },
    async beforeCreate(data) {
      data = await calculateTotals(data);
    },
    async afterCreate(result) {
      const ctx = { params: { id: result.id, doc: "emitted-invoice" } };
      await emittedInvoiceController.pdf(ctx);
    },
    async beforeUpdate(params, data) {
      const invoice = await strapi.query(entity).findOne(params);
      if (invoice.updatable === false && !(data.updatable_admin === true)) {
        throw new Error("received-expense NOT updatable");
      }
      if (!data._internal) {
        data.updatable_admin = false;
        data = await calculateTotals(data);
      }
    },
    async afterUpdate(result, params, data) {
      const me = await strapi.query("me").findOne();
      const invoice = await strapi.query(entity).findOne(params);
      if (
        me.verifactu &&
        (me.verifactu === "test" || me.verifactu === "real")
      ) {
        if (invoice && invoice.state === "real") {
          const verifactuChain = await strapi
            .query("verifactu-chain")
            .find({ emitted_invoice: invoice.id });
          if (verifactuChain.length === 0) {
            const user =
              invoice.user_real && typeof invoice.user_real === "object"
                ? invoice.user_real && invoice.user_real.id
                  ? invoice.user_real.id
                  : 0
                : invoice.user_real;

            const chain = {
              emitted_invoice: invoice.id,
              users_permissions_user: user,
              invoice_json: JSON.stringify(invoice),
              state: "pending",
              mode: me.verifactu,
            };
            const result = await strapi.query("verifactu-chain").create(chain);
            const chainId = result.id;
            console.log("verifactu-chain created", chainId);
          }
        }
      }

      if (invoice && !invoice.pdf) {
        try {
          const ctx = { params: { id: params.id, doc: "emitted-invoice" } };
          await emittedInvoiceController.pdf(ctx);
        } catch (err) {
          console.error("Error generating PDF after update:", err);
        }
      }
    },
    async beforeDelete(params) {
      // const invoice = await strapi.query(entity).findOne(params);
      // if (invoice && invoice.updatable === false) {
      //   throw new Error("received-expense NOT updatable");
      // }
      throw new Error("received-expense NOT updatable");
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

  if (data.code === "ESBORRANY" && data.state === "real") {
    data.user_real = data.user_last;
    const serial = await strapi.query("serie").findOne({ id: data.serial });
    if (!data.number) {
      var emitted_invoice_number = 1;
      if (serial.emitted_invoice_number) {
        emitted_invoice_number = serial.emitted_invoice_number + 1;
      } else {
        const quotes = await strapi
          .query("emitted-invoice")
          .find({ serial: data.serial, _limit: -1 });
        emitted_invoice_number = quotes.length + 1;
      }
      await strapi
        .query("serie")
        .update(
          { id: data.serial },
          { emitted_invoice_number: emitted_invoice_number }
        );
      data.number = emitted_invoice_number;
    }
    const zeroPad = (num, places) => String(num).padStart(places, "0");
    const places = serial.leadingZeros || 1;
    data.code = `${serial.name}-${zeroPad(data.number, places)}`;
  } else if (data.state == "draft" || !data.state) {
    data.state = "draft";
    data.code = `ESBORRANY`;
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
