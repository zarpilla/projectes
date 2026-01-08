"use strict";
const projectController = require("../../project/controllers/project");
const entity = "received-invoice"
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
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
      // result.projects.forEach((p) => {
      //   projectController.setDirty(p.id);
      // });
    },
    async beforeUpdate(params, data) {
      const invoice = await strapi.query(entity).findOne(params);
      if (invoice.updatable === false && !(data.updatable_admin === true)) {
        throw new Error("received-invoice NOT updatable");
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
      
      if (!data._internal) {
        data.updatable_admin = false;
        data = await calculateTotals(data);
      }
    },
    async afterUpdate(result, params, data) {
      // if (result.projects) {
      //   result.projects.forEach((p) => {
      //     projectController.setDirty(p.id);
      //   });
      // }
      // if (data.projects) {
      //   data.projects.forEach((p) => {
      //     projectController.setDirty(p.id);
      //   });
      // }
    },
    async beforeDelete(params) {
      const invoice = await strapi.query(entity).findOne(params);
      if (invoice && invoice.updatable === false) {
        throw new Error("received-invoice NOT updatable");
      }
      // if (invoice && invoice.project) {
      //   await projectController.setDirty(invoice.project.id);
      // }
    }
  },
};

let calculateTotals = async (data) => {
  data.total_base = 0;
  data.total_vat = 0;
  data.total_irpf = 0;
  data.total = 0;

  if (!data.code) {
    const serial = await strapi.query("serie").findOne({ id: data.serial });
    if (!data.number) {
      const quotes = await strapi
        .query("received-invoice")
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
