"use strict";
const _ = require("lodash");
const moment = require("moment");

const checkMultidelivery = async (id, date, contactId) => {
  const ordersOfDateAndContact = await strapi.query("orders").find({
    estimated_delivery_date: moment(date).format("YYYY-MM-DD"),
    contact: contactId,
    _limit: -1,
  })

  const others = ordersOfDateAndContact.filter((o) => o.id.toString() !== id.toString());
    
  return {
    others,
    multidelivery: others.length > 0,
  };
};

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      if (data.delivery_type && data.delivery_type.id) {
        const deliveryTypes = await strapi.services["delivery-type"].find();
        const deliveryType = deliveryTypes.find(
          (d) => d.id === data.delivery_type.id
        );
        if (deliveryType && deliveryType.refrigerated) {
          data.refrigerated = 1;
        } else {
          data.refrigerated = 0;
        }
      } else if (data.delivery_type) {
        const deliveryTypes = await strapi.services["delivery-type"].find();
        const deliveryType = deliveryTypes.find(
          (d) => d.id === data.delivery_type
        );
        if (deliveryType && deliveryType.refrigerated) {
          data.refrigerated = 1;
        } else {
          data.refrigerated = 0;
        }
      }
      if (data.status === "lastmile") {
        data.last_mile = true;
      }

      if (data.status !== "invoiced" && data.contact) {
        const { multidelivery, others } = await checkMultidelivery(
          0,
          data.estimated_delivery_date,
          data.contact
        );

        if (multidelivery && !data.multidelivery_discount) {
            const me = await strapi.query("me").findOne();
            if (me && me.orders_options && me.orders_options.multidelivery_discount) {
                data.multidelivery_discount = me.orders_options.multidelivery_discount || 0
            }

            for await (const order of others) {                
                if (order.multidelivery_discount !== data.multidelivery_discount) {
                    const orderToUpdate = {
                        id: order.id,
                        multidelivery_discount: data.multidelivery_discount || 0,
                    }
                    await strapi.query("orders").update({ id: orderToUpdate.id }, orderToUpdate);
                }
            }

        }
      }
    },
    async beforeUpdate(params, data) {
      if (data.status === "delivered" && !data.delivery_date) {
        data.delivery_date = data.estimated_delivery_date
          ? data.estimated_delivery_date
          : new Date();
      }
      if (data.status === "lastmile") {
        data.last_mile = true;
      }
      if (data.delivery_type && data.delivery_type.id) {
        const deliveryTypes = await strapi.services["delivery-type"].find();
        const deliveryType = deliveryTypes.find(
          (d) => d.id === data.delivery_type.id
        );
        if (deliveryType && deliveryType.refrigerated) {
          data.refrigerated = 1;
        } else {
          data.refrigerated = 0;
        }
      } else if (data.delivery_type) {
        const deliveryTypes = await strapi.services["delivery-type"].find();
        const deliveryType = deliveryTypes.find(
          (d) => d.id === data.delivery_type
        );
        if (deliveryType && deliveryType.refrigerated) {
          data.refrigerated = 1;
        } else {
          data.refrigerated = 0;
        }
      }
      if (data.incidence && !data.incidence_solved) {
        const me = await strapi.query("me").findOne();
        if (!me.contact_form_email) {
          throw new Error("contact_form_email not set");
        }

        const to = [data.email];
        me.contact_form_email.split(",").forEach((email) => {
          to.push(email);
        });
        const from = strapi.config.get(
          "plugins.email.settings.defaultFrom",
          ""
        );
        const subject = `[ESSSTRAPIS] Incidència amb una comanda`;
        const userData = await strapi
          .query("user", "users-permissions")
          .findOne({ id: data.user });
        const html = `
                <b>Incidència amb una comanda</b><br><br>
                PROVEÏDORA: ${userData.fullname || userData.username} (${
          userData.id
        })<br>
                COMANDA: #${params.id.toString().padStart(4, "0")} <br>
                INCIDÈNCIA: ${data.incidence_description} <br>                
                --<br>
                Missatge automàtic.<br>                
                --<br>`;

        await strapi.plugins["email"].services.email.send({
          to,
          from,
          subject,
          html,
        });
      }

      if (data.status !== "invoiced" && data.contact) {
        
        // multidelivery discount
        const { multidelivery, others } = await checkMultidelivery(
          params.id,
          data.estimated_delivery_date,
          data.contact
        );

        if (multidelivery && !data.multidelivery_discount) {
            const me = await strapi.query("me").findOne();
            if (me && me.orders_options && me.orders_options.multidelivery_discount) {
                data.multidelivery_discount = me.orders_options.multidelivery_discount || 0
            }

            for await (const order of others) {                
                if (order.multidelivery_discount !== data.multidelivery_discount) {
                    const orderToUpdate = {
                        id: order.id,
                        multidelivery_discount: data.multidelivery_discount || 0,
                    }
                    await strapi.query("orders").update({ id: orderToUpdate.id }, orderToUpdate);
                }
            }
        } else if (!multidelivery && data.multidelivery_discount) {
          data.multidelivery_discount = 0;
        }
      }
    },
    async afterCreate(result, data) {
      if (data.status !== "invoiced" && data.contact && data.contact.id) {
        const multidelivery = await checkMultidelivery(
          result.id,
          data.estimated_delivery_date,
          data.contact
        );
      }
    },

    afterFind: async (results, params, populate) => {
        results.forEach((res, i) => {
            res.finalPrice = res.price * (1 - (res.multidelivery_discount || 0) / 100) * (1 - (res.contact_pickup_discount || 0) / 100);
        })
    },
    // async afterFindOne(result, params, populate) {
    //     if (result && !result.pdf) {
    //       const config = await strapi.query("config").findOne();
    //       const pdf = `${config.front_url}invoice/${params.id}`;
    //       result.pdf = pdf;
    //     }
    //   },
  },
};
