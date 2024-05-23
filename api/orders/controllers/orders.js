"use strict";
var MicroInvoice = require("../../../utils/microinvoice");
var fs = require("fs");
const sharp = require("sharp");
const moment = require("moment");
const crypto = require("crypto");
const QRCode = require('qrcode');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */



const formatCurrency = (val) => {
  if (!val) {
    return "-";
  }
  return val
    .toFixed(2)
    .replace(/\d(?=(\d{3})+\.)/g, "$&;")
    .replace(/\./g, ",")
    .replace(/;/g, ".");
};


module.exports = {
  createCSV: async (ctx) => {
    const order = ctx.request.body;
    delete order.id;
    order.pickup = order.pickup.id;
    order.delivery_type = order.delivery_type.id;
    order.owner = order.owner.id;
    order.route = order.route.id;
    order.route_rate = order.route_rate.id;
    order.status = "pending";
    order.comments = order.notes;
    if (order.contact && order.contact.id) {
      order.contact = order.contact.id;
    } else {
      if (order.contact) {
        if (!order.contact.time_slot_1_ini) {
          order.contact.time_slot_1_ini = null;
        }
        if (!order.contact.time_slot_1_end) {
          order.contact.time_slot_1_end = null;
        }
        if (!order.contact.time_slot_2_ini) {
          order.contact.time_slot_2_ini = null;
        }
        if (!order.contact.time_slot_2_end) {
          order.contact.time_slot_2_end = null;
        }
      }

      if (order.contact && !order.contact.contact_nif) {
        order.contact.owner = order.owner;
        const contact = await strapi.services.contacts.create(order.contact);
        order.contact = contact.id;
      } else {
        order.contact.contact_nif = order.contact.contact_nif.trim();
        const contact = await strapi.services.contacts.find({
          owner: order.owner,
          nif: order.contact.nif,
        });
        if (contact.length > 0) {
          order.contact = contact[0].id;
        } else {
          order.contact.owner = order.owner;

          // console.log('order.contact 1', order.contact)
          const contact = await strapi.services.contacts.create(order.contact);
          order.contact = contact.id;
        }
      }
    }

    if (!order.contact_time_slot_1_ini) {
      order.contact_time_slot_1_ini = null;
    }
    if (!order.contact_time_slot_1_end) {
      order.contact_time_slot_1_end = null;
    }
    if (!order.contact_time_slot_2_ini) {
      order.contact_time_slot_2_ini = null;
    }
    if (!order.contact_time_slot_2_end) {
      order.contact_time_slot_2_end = null;
    }
    const createdOrder = await strapi.services.orders.create(order);

    return createdOrder;
  },
  invoice: async (ctx) => {
    const { orders } = ctx.request.body;

    const year = new Date().getFullYear();
    const serial = await strapi.query("serie").find({ name: year });
    if (serial.length === 0) {
      ctx.send(
        { done: false, message: "ERROR. No hi ha sèrie per a l'any " + year },
        500
      );
      return;
    }

    const ordersEntities = await strapi.query("orders").find({ id_in: orders });

    const uniqueOwners = ordersEntities
      .map((o) => o.owner.id)
      .filter((value, index, self) => self.indexOf(value) === index);

    const allContacts = [];
    for (const owner of uniqueOwners) {
      const contacts = await strapi
        .query("contacts")
        .find({ users_permissions_user: owner });
      if (contacts.length === 0) {
        ctx.badRequest("name is missing", { foo: "bar" });
        ctx.send(
          {
            done: false,
            message: "ERROR. No hi ha contactes per a l'usuari " + owner,
          },
          500
        );
        return;
      }
      const contact = contacts[0];
      allContacts.push(contact);
    }

    const invoices = [];
    for (const owner of uniqueOwners) {
      const contact = allContacts.find(
        (c) => c.users_permissions_user.id === owner
      );
      const contactOrders = ordersEntities.filter((o) => o.owner.id === owner);
      const uniqueProjects = ordersEntities
        .filter((o) => o.owner.id === owner)
        .map((o) => o.route.project)
        .filter((value, index, self) => self.indexOf(value) === index);
      const emittedInvoice = {
        emitted: new Date(),
        serial: serial[0].id,
        contact: contact.id,
        lines: contactOrders.map((o) => {
          return {
            concept: `Comanda #${o.id.toString().padStart(4, "0")}# ${
              o.route.name
            } ${o.pickup.name} ${o.refrigerated ? "Refrigerada" : ""}`,
            base: o.price,
            quantity: 1,
            price: o.price,
            vat: 21,
            irpf: 0,
            discount: 0,
          };
        }),
        projects: uniqueProjects,
      };
      const invoice = await strapi
        .query("emitted-invoice")
        .create(emittedInvoice);
      invoices.push(invoice);
      for (const o of contactOrders) {
        await strapi
          .query("orders")
          .update({ id: o.id }, { invoice: invoice.id, status: "invoiced" });
      }
      for (const p of uniqueProjects) {
        // const total = contactOrders.filter((o) => o.route.project === p).reduce((acc, o) => {
        //   return acc + o.price;
        // }, 0);

        const project = await strapi.query("project").findOne({ id: p });

        if (!project.phases || project.phases.length === 0) {
          ctx.send(
            {
              done: false,
              message: "ERROR. No hi ha fases per al projecte " + project.name,
            },
            500
          );
        }

        const phase = project.phases[project.phases.length - 1];

        for (const o of contactOrders.filter((o) => o.route.project === p )){
          phase.incomes.push({
            concept: `Comanda #${o.id.toString().padStart(4, "0")}# - ${contact.name}`,
            quantity: 1,
            amount: o.price,
            total_amount: o.price,
            date: new Date(),
            income_type: 1,
            invoice: invoice.id,
          })
        }

        await strapi.query("project").update({ id: p }, { phases: project.phases });

      }
    }

    ctx.send({
      orders: orders,
      ordersEntities,
      serial,
      uniqueOwners,
      allContacts,
      invoices,
    });
  },


  pdf: async (ctx) => {
    const { id, doc } = ctx.params;

    const invoice = await strapi.query("orders").findOne({ id });

    console.log('invoice', invoice)

    const me = await strapi.query("me").findOne();
    const config = await strapi.query("config").findOne();

    console.log('config', config.front_url)

    const qrCodeImage = await QRCode.toDataURL(`${config.front_url}order/${id}`);

    const logoUrl = `./public${me.logo.url}`;

    console.log('logoUrl', logoUrl, qrCodeImage)

    var logo = qrCodeImage;

    // if (logoUrl.endsWith(".svg")) {
    // logo = `./public/uploads/orders/qr-${id}.jpg`;
      
    // }

    // await sharp(qrCodeImage).png().toFile(logo);

    const logoWidth = 100;
    const ratio = 1;

    const invoiceHeader = [
      {
        label: "Número",
        value: invoice.id.toString().padStart(4, "0"),
      },
      {
        label: "Data",
        value: moment(invoice.route_date, "YYYY-MM-DD").format("DD-MM-YYYY"),
      },
    ];

    // if (invoice.paybefore) {
    //   invoiceHeader.push({
    //     label: "Venciment",
    //     value: moment(invoice.paybefore, "YYYY-MM-DD").format("DD-MM-YYYY"),
    //   });
    // } else if (
    //   invoice.paid &&
    //   invoice.paid_date &&
    //   doc === "received-expense"
    // ) {
    //   invoiceHeader.push({
    //     label: "Pagada",
    //     value: moment(invoice.paid_date, "YYYY-MM-DD").format("DD-MM-YYYY"),
    //   });
    // }

    const showDate = false;
    const showQuantity = false;
    const showVat = true //invoice.lines.find((l) => l.vat > 0) !== undefined;
    const showIrpf = false//invoice.lines.find((l) => l.irpf > 0) !== undefined;

    const detailsHeader = [];

    let columnsWidth =
      0.35 +
      (showDate ? 0.1 : 0) +
      (showQuantity ? 0.08 * 2 : 0) +
      0.19 +
      (showVat ? 0.1 : 0) +
      (showIrpf ? 0.1 : 0) +
      0.1;

    let columnsRatio = 1 / columnsWidth;

    detailsHeader.push({
      value: "Concepte",
      width: 0.35 * columnsRatio,
    });
    if (showDate) {
      detailsHeader.push({
        value: "Data",
        width: 0.12 * columnsRatio,
      });
    }
    if (showQuantity) {
      detailsHeader.push({
        value: "Q.",
        width: 0.07 * columnsRatio,
      });
    }
    if (showQuantity) {
      detailsHeader.push({
        value: "Base",
        width: 0.09 * columnsRatio,
      });
    }
    detailsHeader.push({
      value: "Base imposable",
      width: 0.18 * columnsRatio,
    });
    if (showVat) {
      detailsHeader.push({
        value: "IVA",
        width: 0.1 * columnsRatio,
      });
    }
    if (showIrpf) {
      detailsHeader.push({
        value: "IRPF",
        width: 0.1 * columnsRatio,
      });
    }
    detailsHeader.push({
      value: "Subtotal",
      width: 0.1 * columnsRatio,
    });

    const parts = [];

    //for (var i = 0; i < invoice.lines.length; i++) {
      const line = invoice //invoice.lines[i];
      line.quantity = 1;
      line.vat = 21;
      line.base = line.price;
      line.irpf = 0;
      const part = [];

      if (line.quantity && line.price) {
        var concept = `Entrega ${invoice.owner.fullname} - ${invoice.route.name} ${invoice.pickup.name} ${invoice.refrigerated ? "Refrigerada" : ""} - ${invoice.units} ${invoice.units > 1 ? 'caixes' : 'caixa'} - ${invoice.kilograms} kg)`;
        // if (line.comments) {
        //   concept += "\n\n" + line.comments;
        // }
        part.push({
          value: concept,
          width: 0.31 * columnsRatio,
        });
        if (showDate) {
          part.push({
            value: line.date,
            width: 0.12 * columnsRatio,
          });
        }
        if (showQuantity) {
          part.push({
            value: line.quantity,
            width: 0.07 * columnsRatio,
          });
        }

        if (showQuantity) {
          part.push({
            value: line.price,
            width: 0.09 * columnsRatio,
            price: true,
          });
        }

        part.push({
          value: line.quantity * line.price,
          price: true,
          width: 0.18 * columnsRatio,
        });
        if (showVat) {
          part.push({
            value:
              formatCurrency((line.quantity * line.price * line.vat) / 100) +
              ` EUR (${line.vat}%)`,
            // price: true,
            width: 0.14 * columnsRatio,
          });
        }
        if (showIrpf) {
          part.push({
            value:
              formatCurrency(
                (-1 * line.quantity * line.base * line.irpf) / 100
              ) + ` EUR (${line.irpf}%)`,
            // price: true,
            width: 0.1 * columnsRatio,
          });
        }
        part.push({
          value:
            line.quantity * line.price -
            (line.quantity * line.price * line.irpf) / 100 +
            (line.quantity * line.price * line.vat) / 100,
          price: true,
          width: 0.1 * columnsRatio,
        });
        parts.push(part);
      }
    //}

    const total = [];
    total.push({
      label: "Base imposable",
      value: invoice.price,
      price: true,
    });
    if (showVat) {
      total.push({
        label: "IVA",
        value: invoice.price * 0.21,
        price: true,
      });
    }
    if (showIrpf) {
      total.push({
        label: "IRPF",
        value: -1 * 0,
        price: true,
      });
    }
    total.push({
      label: "TOTAL",
      value: invoice.price * 1.21,
      price: true,
    });

    const legal = [];
    let more = invoice.contact.phone ? `Telèfon: ${invoice.contact.phone}` : ''    
    if (invoice.fragile) {
      more += "\n" + "Fràgil";
    }      
    if (invoice.contact_time_slot_1_ini && invoice.contact_time_slot_1_end) {
      more += "\n" + "De " + invoice.contact_time_slot_1_ini + "h a " + invoice.contact_time_slot_1_end + "h";
    }
    if (invoice.contact_time_slot_2_ini && invoice.contact_time_slot_2_end) {
      more += "\n" + "De " + invoice.contact_time_slot_2_ini + "h a " + invoice.contact_time_slot_2_end + "h";
    }
    invoice.comments = more + "\n\n" + invoice.comments;
    if (invoice.comments) {      
      legal.push({
        value: invoice.comments,
        color: "secondary",
      });
    }
    if (invoice?.payment_method?.invoice_text && doc === "emitted-invoice") {
      legal.push({
        value: invoice?.payment_method?.invoice_text,
        weight: "bold",
        color: "primary",
      });
    }
    if (me.order_footer) {
      legal.push({
        value: me.order_footer,
        color: "secondary",
      });
    }

    let myInvoice = new MicroInvoice({
      style: {
        header: {
          image: {
            path: logo,
            width: logoWidth,
            height: logoWidth,
          },
        },
      },
      data: {
        invoice: {
          name: "Comanda",

          header: invoiceHeader,

          currency: "EUR",

          customer: [
            {
              label:
                "ENTREGA",
              value: [
                invoice.contact.name,
                invoice.contact.nif,
                invoice.contact.address,
                invoice.contact.postcode + " " + invoice.contact.city,
              ],
            },
          ],

          seller: [
            {
              label:
                "EMISSOR",
              value: [
                me.name,
                me.nif,
                me.address,
                me.postcode + " " + me.city,
                me.email,
              ],
            },
          ],

          legal: legal,

          details: {
            header: detailsHeader,

            parts: parts,

            total: total,
          },
        },
      },
    });

    if (!fs.existsSync("./public/uploads/orders")) {
      fs.mkdirSync("./public/uploads/orders");
    }
    const hash = crypto
      .createHash("md5")
      .update(`${myInvoice.options.data.invoice.name}-${invoice.code}-${id}`)
      .digest("hex");
    const docName = `./public/uploads/orders/${
      myInvoice.options.data.invoice.name
    }-${invoice.contact.name}-${invoice.code}-H${hash.substring(16)}.pdf`;
    await myInvoice.generate(docName);

    // strapi
    //   .query(doc)
    //   .update(
    //     { id: invoice.id },
    //     { pdf: docName.substring("./public".length), _internal: true }
    //   );

    return { url: docName.substring("./public".length) };
  },

};
