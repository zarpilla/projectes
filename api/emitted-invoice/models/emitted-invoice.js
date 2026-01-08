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
      data.state = "draft";
      data.code = `ESBORRANY`;
      
      // Handle payment_method and bank_account
      if (!data.payment_method) {
        // Get the first payment method from the database
        const firstPaymentMethod = await strapi.query("payment-method").findOne({}, ["bank_account"]);
        if (firstPaymentMethod) {
          data.payment_method = firstPaymentMethod.id;
        }
      }
      
      // If payment_method is set, get its bank_account
      if (data.payment_method) {
        const paymentMethod = await strapi.query("payment-method").findOne(
          { id: data.payment_method },
          ["bank_account"]
        );
        if (paymentMethod && paymentMethod.bank_account) {
          data.bank_account = paymentMethod.bank_account.id || paymentMethod.bank_account;
        }
      }
      
      // Fill contact_info from contact if contact_info is null or undefined
      data = await fillContactInfo(data);
      
      data = await calculateTotals(data);
    },
    async afterCreate(result) {
      const ctx = { params: { id: result.id, doc: "emitted-invoice" } };
      await emittedInvoiceController.pdf(ctx);
    },
    async beforeUpdate(params, data) {
      const invoice = await strapi.query(entity).findOne(params);
      if (invoice.updatable === false && !(data.updatable_admin === true)) {
        throw new Error("emitted-invoice NOT updatable");
      }
      
      // Clean up any undefined/null/empty user fields early to prevent SQL errors
      // Use hasOwnProperty to check if the field exists and remove it if invalid
      if ('user_real' in data) {
        if (!data.user_real || data.user_real === '' || data.user_real === null || data.user_real === undefined) {
          delete data.user_real;
        }
      }
      if ('user_draft' in data) {
        if (!data.user_draft || data.user_draft === '' || data.user_draft === null || data.user_draft === undefined) {
          delete data.user_draft;
        }
      }
      
      // Handle payment_method and bank_account changes
      if (data.payment_method && data.payment_method !== invoice.payment_method) {
        const paymentMethod = await strapi.query("payment-method").findOne(
          { id: data.payment_method },
          ["bank_account"]
        );
        if (paymentMethod && paymentMethod.bank_account) {
          data.bank_account = paymentMethod.bank_account.id || paymentMethod.bank_account;
        }
      }
      
      // Fill contact_info from contact if contact_info is null or undefined
      data = await fillContactInfo(data);
      
      if (invoice.state === "real") {
        data.lines = invoice.lines;
        data.contact = invoice.contact;
        data.emitted = invoice.emitted;
        data.serial = invoice.serial;
        // Only set user fields if they have valid values from the existing invoice
        if (invoice.user_real && invoice.user_real !== '' && invoice.user_real !== null) {
          data.user_real = invoice.user_real;
        }
        if (invoice.user_draft && invoice.user_draft !== '' && invoice.user_draft !== null) {
          data.user_draft = invoice.user_draft;
        }
        data.comments = invoice.comments;
        // data.number = invoice.number;
        data.code = invoice.code;
      }
      if (!data._internal) {
        data.updatable_admin = false;
        data = await handleState(data);
        data = await calculateTotals(data);        
      } else {
        delete data.user_real;
      }
      
      // Final cleanup - remove any invalid user fields that may have been added
      if ('user_real' in data) {
        if (!data.user_real || data.user_real === '' || data.user_real === null || data.user_real === undefined) {
          delete data.user_real;
        }
      }
      if ('user_draft' in data) {
        if (!data.user_draft || data.user_draft === '' || data.user_draft === null || data.user_draft === undefined) {
          delete data.user_draft;
        }
      }
    },
    async afterUpdate(result, params, data) {
      const verifactu = await strapi.query("verifactu").findOne();
      const invoice = await strapi.query(entity).findOne(params);
      if (
        verifactu &&
        (verifactu.mode === "test" || verifactu.mode === "real") &&
        invoice.verifactu
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
              mode: verifactu.mode,
            };
            await strapi.query("verifactu-chain").create(chain);
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
      const invoice = await strapi.query(entity).findOne(params);
      if (invoice.state === "real") {
        throw new Error("Cannot delete a real invoice");
      }
      // check orders
      const orders = await strapi
        .query("orders")
        .find({ emitted_invoice: params.id });
      if (orders && orders.length > 0) {
        // throw new Error("Cannot delete emitted invoice with associated orders");
        for await (const o of orders) {
          await strapi
            .query("orders")
            .update(
              { id: o.id },
              { emitted_invoice: null, status: "delivered" }
            );
        }
      }
    },
  },
};

let handleState = async (data) => {
  if (data._internal) {
    return data;
  }

  if (data.code === "ESBORRANY" && data.state === "real") {
    data.user_real = data.user_last;
    const serial = await strapi.query("serie").findOne({ id: data.serial });
    if (!data.number) {
      var emitted_invoice_number = 1;
      emitted_invoice_number = serial.emitted_invoice_number + 1;

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

  return data;
};

let calculateTotals = async (data) => {
  if (data._internal) {
    return data;
  }

  if (data.lines) {
    data.total_base = 0;
    data.total_vat = 0;
    data.total_irpf = 0;
    data.total = 0;

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

let fillContactInfo = async (data) => {
  // Only fill contact_info if it's null or undefined
  if (data.contact_info === null || data.contact_info === undefined) {
    if (data.contact) {
      // Get the contact ID (handle both object and ID cases)
      const contactId = typeof data.contact === 'object' ? data.contact.id : data.contact;
      
      if (contactId) {
        // Fetch the contact data
        const contact = await strapi.query("contacts").findOne({ id: contactId });
        
        if (contact) {
          // Map contact fields to contact_info structure
          data.contact_info = {
            name: contact.name || null,
            nif: contact.nif || null,
            address: contact.address || null,
            postcode: contact.postcode || null,
            city: contact.city || null,
            state: contact.state || null,
            country: contact.country || null
          };
        }
      }
    }
  }
  
  return data;
};
