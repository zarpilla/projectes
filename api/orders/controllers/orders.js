"use strict";
var MicroInvoiceOrder = require("../../../utils/microinvoice-order");
var fs = require("fs");
const sharp = require("sharp");
const moment = require("moment");
const crypto = require("crypto");
const QRCode = require("qrcode");
const PDFMerge = require("pdf-merge");
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
  infoAll: async (ctx) => {
    const { year, month, ...query } = ctx.query;

    if (year && !isNaN(year)) {
      query["estimated_delivery_date_gte"] = `${year}-01-01`;
      query["estimated_delivery_date_lte"] = `${year}-12-31`;
    }

    if (month && !isNaN(month)) {
      query["estimated_delivery_date_gte"] = `${year}-${String(month).padStart(
        2,
        "0"
      )}-01`;
      const lastDayNumberOfMonth = moment(
        `${year}-${month}`,
        "YYYY-MM"
      ).daysInMonth();
      query["estimated_delivery_date_lte"] = `${year}-${String(month).padStart(
        2,
        "0"
      )}-${String(lastDayNumberOfMonth).padStart(2, "0")}`;
    }

    const orders = await strapi.query("orders").find(query);
    const ordersInfo = orders
      .filter((o) => o.status !== "cancelled")
      .map((o) => {
        const date =
          o.estimated_delivery_date || o.delivery_date || o.route_date;
        return {
          id: o.id,
          count: 1,
          owner: o.owner ? o.owner.fullname || o.owner.username : "-",
          //route_date: o.route_date,
          contact_id: o.contact ? o.contact.id : "-",
          contact: o.contact ? o.contact.name : "-",
          city: o.contact_city || "-",
          units: o.units || 0,
          kilograms: o.kilograms || 0,
          created_at: o.created_at,
          route: o.route ? o.route.short_name || o.route?.name : "-",
          refrigerated: o.refrigerated,
          fragile: o.fragile,
          route_rate: o.route_rate ? o.route_rate.name : "-",
          price:
            ((o.price || 0) - (o.volume_discount || 0)) *
            (1 - (o.multidelivery_discount || 0) / 100) *
            (1 - (o.contact_pickup_discount || 0) / 100),
          pickup: o.pickup ? o.pickup.name : "-",
          delivery_type: o.delivery_type ? o.delivery_type.name : "-",
          status: o.status,
          lastmile: o.last_mile ? "Sí" : "No",
          date: date,
          month: moment(date).format("MM"),
          year: moment(date).format("YYYY"),
          multidelivery: o.multidelivery_discount ? "Sí" : "No",
          pickup_discount: o.contact_pickup_discount ? "Sí" : "No",
        };
      });

    let ordersInfoFiltered = ordersInfo;
    if (year) {
      ordersInfoFiltered = ordersInfoFiltered.filter((o) => o.year === year);
    }
    if (month) {
      ordersInfoFiltered = ordersInfoFiltered.filter(
        (o) => parseInt(o.month) === parseInt(month)
      );
    }
    ctx.send(ordersInfoFiltered);
    return;
  },
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
    const { orders, project } = ctx.request.body;

    const uniqueProjects = [project];
    const year = new Date().getFullYear();
    const serial = await strapi.query("serie").find({ name: year });
    if (serial.length === 0) {
      ctx.send(
        { done: false, message: "ERROR. No hi ha sèrie per a l'any " + year },
        500
      );
      return;
    }

    const verifactu = await strapi.query("verifactu").findOne();

    const verifactuEnabled =
      verifactu.mode === "test" || verifactu.mode === "real";

    const ordersEntities = await strapi
      .query("orders")
      .find({ id_in: orders, _limit: -1 });

    const uniqueOwners = ordersEntities
      .map((o) => o.owner.id)
      .filter((value, index, self) => self.indexOf(value) === index);

    const payment_methods = await strapi.query("payment-method").find({});
    const payment_method = payment_methods.length > 0 ? payment_methods[0].id : null;

    const allContacts = [];
    for await (const owner of uniqueOwners) {
      const contacts = await strapi
        .query("contacts")
        .find({ users_permissions_user: owner });
      if (contacts.length === 0) {
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
    for await (const owner of uniqueOwners) {
      const contact = allContacts.find(
        (c) => c.users_permissions_user.id === owner
      );
      const contactOrders = ordersEntities.filter((o) => o.owner.id === owner);
      // const uniqueProjects = ordersEntities
      //   .filter((o) => o.owner.id === owner)
      //   .map((o) => o.route.project)
      //   .filter((value, index, self) => self.indexOf(value) === index);
      const emittedInvoice = {
        emitted: new Date(),
        serial: serial[0].id,
        contact: contact.id,
        verifactu: verifactuEnabled,
        payment_method: payment_method,
        lines: contactOrders.map((o) => {
          return {
            concept: `Comanda ${o.estimated_delivery_date} | ${o.id
              .toString()
              .padStart(4, "0")} | ${o.route.name}`,
            base: o.price - (o.volume_discount || 0),
            quantity: 1,
            price: o.price,
            vat: 21,
            irpf: 0,
            discount:
              (o.multidelivery_discount || 0) +
              (o.contact_pickup_discount || 0),
          };
        }),
        projects: [project],
      };

      // validate project phases
      for await (const p of uniqueProjects) {
        const project = await strapi
          .query("project")
          .findOne({ id: p }, [
            "project_phases",
            "project_phases.incomes",
            "project_phases.incomes.invoice",
            "project_phases.incomes.income",
          ]);

        if (!project.project_phases || project.project_phases.length === 0) {
          ctx.send(
            {
              done: false,
              message: "ERROR. No hi ha fases per al projecte " + project.name,
            },
            500
          );
          return;
        } else {
          const phase =
            project.project_phases[project.project_phases.length - 1];
          if (!phase.incomes) {
            ctx.send(
              {
                done: false,
                message:
                  "ERROR. No hi ha fases per al projecte " + project.name,
              },
              500
            );
            return;
          }
        }
      }

      const invoice = await strapi
        .query("emitted-invoice")
        .create(emittedInvoice);
      invoices.push(invoice);
      for await (const o of contactOrders) {
        await strapi
          .query("orders")
          .update({ id: o.id }, { invoice: invoice.id, status: "invoiced" });
      }
      for await (const p of uniqueProjects) {
        const project = await strapi
          .query("project")
          .findOne({ id: p }, [
            "project_phases",
            "project_phases.incomes",
            "project_phases.incomes.invoice",
            "project_phases.incomes.income",
          ]);

        if (!project.project_phases || project.project_phases.length === 0) {
          ctx.send(
            {
              done: false,
              message: "ERROR. No hi ha fases per al projecte " + project.name,
            },
            500
          );
        }

        const phase = project.project_phases[project.project_phases.length - 1];
        let price = 0;
        for (const o of contactOrders) {
          price +=
            ((o.price || 0) - (o.volume_discount || 0)) *
            (1 - (o.multidelivery_discount || 0) / 100) *
            (1 - (o.contact_pickup_discount || 0) / 100);
        }

        if (!phase.incomes) {
          phase.incomes = [];
          phase.dirty = true;
        }

        phase.incomes.push({
          concept: `Factura #${invoice.code}# - ${
            contact.trade_name || contact.name
          }`,
          quantity: 1,
          amount: price,
          total_amount: price,
          date: new Date(),
          income_type: 1,
          invoice: invoice.id,
          paid: true,
          date_estimate_document: new Date(),
          dirty: true,
        });

        await strapi.query("project").update(
          { id: p },
          {
            project_phases: project.project_phases,
            project_phases_info: {},
            _project_phases_updated: true,
          }
        );
      }

      for await (const o of ordersEntities) {
        await strapi.query("orders").update(
          { id: o.id },
          {
            emitted_invoice: invoice.id,
            emitted_invoice_datetime: new Date(),
          }
        );
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

    const me = await strapi.query("me").findOne();
    const config = await strapi.query("config").findOne();

    const qrCodeImage = await QRCode.toDataURL(
      `${config.front_url}order/${id}`
    );

    var qr = qrCodeImage;

    const qrWidth = 100;

    const logoWidth = 100;
    const ratio = me.logo.width / logoWidth;

    // console.log('invoice', invoice)

    const contacts = await strapi
      .query("contacts")
      .find({ users_permissions_user: invoice.owner.id });
    if (contacts.length === 0) {
      ctx.send(
        {
          done: false,
          message: `ERROR. L'usuària ${invoice.owner.username} no te cap contacte associat. Ves a contactes i crea un nou contacte associat a l'usuària a través del camp 'Persona'.`,
        },
        500
      );
      return;
    }
    const provider = contacts[0];

    const invoiceHeader = [
      {
        label: "NÚMERO",
        value: invoice.id.toString().padStart(4, "0"),
      },
      {
        label: "DATA",
        value: moment(invoice.estimated_delivery_date, "YYYY-MM-DD").format(
          "DD-MM-YYYY"
        ),
      },
    ];

    const logoUrl = `./public${me.logo.url}`;

    var logo = logoUrl;

    if (logoUrl.endsWith(".svg")) {
      logo = "./public/uploads/invoice-logo.jpg";
      await sharp(logoUrl).png().toFile(logo);
    }

    const legal = [];

    legal.push({
      value: "NOTES:",
      color: "primary",
      weight: "bold",
    });
    let more = "";

    more =
      invoice.contact && invoice.contact.notes
        ? invoice.contact.notes + "\n"
        : invoice.contact_notes
        ? invoice.contact_notes + "\n"
        : "";

    more += invoice.contact_legal_form
      ? invoice.contact_legal_form.name + " - "
      : "";
    if (invoice.fragile) {
      more += "Fràgil" + " - ";
    }

    if (invoice.contact_time_slot_1_ini && invoice.contact_time_slot_1_end) {
      more +=
        "De " +
        invoice.contact_time_slot_1_ini +
        "h a " +
        invoice.contact_time_slot_1_end +
        "h" +
        " - ";
    }
    if (invoice.contact_time_slot_2_ini && invoice.contact_time_slot_2_end) {
      more +=
        "De " +
        invoice.contact_time_slot_2_ini +
        "h a " +
        invoice.contact_time_slot_2_end +
        "h";
    }

    if (more.endsWith(" - ")) {
      more = more.substring(0, more.length - 3);
    }
    invoice.comments = more + "\n" + (invoice.comments ? invoice.comments : "");

    legal.push({
      value: invoice.comments,
      color: "secondary",
    });

    legal.push({
      value: "DETALLS:",
      color: "primary",
      weight: "bold",
    });

    var concept = `${invoice.route.name.trim()}${
      invoice.estimated_delivery_date
        ? " - " + invoice.estimated_delivery_date
        : ""
    } - ${invoice.pickup.name} ${invoice.refrigerated ? "Refrigerada" : ""} - ${
      invoice.units
    } ${invoice.units > 1 ? "caixes" : "caixa"} - ${invoice.kilograms} kg`;

    legal.push({
      value: concept,
      color: "secondary",
    });
    const parts = [];
    if (invoice.lines && invoice.lines.length > 0) {
      legal.push({
        value: "RECOLLIDA:",
        color: "primary",
        weight: "bold",
      });
      // each lines can contain N boxes, ie. lines = [{units: 3, name: "name of the person 1", nif: "NIF of the person 1"}, {units: 1, name: "name of the person 2", nif: "NIF of the person 2"}]
      // In the first page, the order will show:
      // CAIXA 1/3 - name of the person 1 - NIF of the person 1
      // In the 2nd page, the order will show:
      // CAIXA 2/3 - name of the person 1 - NIF of the person 1
      // In the 3rd page, the order will show:
      // CAIXA 3/3 - name of the person 1 - NIF of the person 1
      // In the 4th page, the order will show:
      // CAIXA 1/1 - name of the person 2 - NIF of the person 2
      for (const line of invoice.lines) {
        if (line.units && line.units > 0) {
          for (let i = 0; i < line.units; i++) {
            parts.push({
              value: `CAIXA ${i + 1}/${line.units} - ${line.name} - ${
                line.nif
              }`,
              color: "secondary",
            });
          }
        }
      }
    }

    const urls = [];

    const invoiceHeaderBoxes = [...invoiceHeader];

    // Build transfer pickup text if both origin and destination exist
    let transferPickupText = null;
    if (invoice.transfer_pickup_origin && invoice.transfer_pickup_destination) {
      const originAlias = invoice.transfer_pickup_origin.alias || invoice.transfer_pickup_origin.name;
      const destinationAlias = invoice.transfer_pickup_destination.alias || invoice.transfer_pickup_destination.name;
      transferPickupText = `${originAlias} -> ${destinationAlias}`;
    }

    let myInvoice = new MicroInvoiceOrder({
      style: {
        header: {
          image: {
            path: logo,
            width: logoWidth,
            height: me.logo.height / ratio,
          },
          qr: {
            path: qr,
            width: qrWidth,
            height: qrWidth,
          },
        },
      },
      data: {
        pages: invoice.units,
        invoice: {
          name: "COMANDA",

          header: invoiceHeaderBoxes,

          currency: "EUR",

          customer: [
            {
              label: "ENTREGA",
              value: [
                invoice.contact.trade_name + " - " + invoice.contact.name,
                invoice.contact.nif,
                invoice.contact.address,
                invoice.contact.postcode + " " + invoice.contact.city,
                `Tel: ${invoice.contact.phone}`,
              ],
            },
          ],

          seller: [
            {
              label: "EMISSORA",
              value: [
                me.name,
                me.phone,
                // me.address,
                // me.postcode + " " + me.city,
                me.email,
              ],
            },
          ],

          provider: [
            {
              label: "PROVEÏDORA",
              value: [
                provider.name,
                // provider.nif,
                // provider.address,
                // provider.postcode + " " + provider.city,
                provider.phone,
              ],
            },
          ],

          transfer: transferPickupText ? [
            {
              label: "TRANSFER",
              value: [transferPickupText],
            },
          ] : null,

          legal: legal,

          details: {
            // header: detailsHeader,
            parts: parts,
            // total: total,
          },
        },
      },
    });

    if (!fs.existsSync("./public/uploads/orders")) {
      fs.mkdirSync("./public/uploads/orders");
    }
    const hash = crypto
      .createHash("md5")
      .update(
        `${myInvoice.options.data.invoice.name}-${invoice.createdAt}-${id}`
      )
      .digest("hex");
    const docName = `./public/uploads/orders/${id}-H${hash.substring(16)}.pdf`;
    await myInvoice.generate(docName);

    urls.push(docName.substring("./public".length));
    //}

    return { urls };
  },

  pdfmultiple: async (ctx) => {
    const { orders } = ctx.request.body;

    // print multiple orders in a single pdf
    const ordersEntities = await strapi.query("orders").find({ id_in: orders });

    const me = await strapi.query("me").findOne();
    const config = await strapi.query("config").findOne();

    const qrWidth = 60;
    const logoWidth = 100;
    const ratio = me.logo.width / logoWidth;

    const logoUrl = `./public${me.logo.url}`;
    let logo = logoUrl;

    if (logoUrl.endsWith(".svg")) {
      logo = "./public/uploads/invoice-logo.jpg";
      await sharp(logoUrl).png().toFile(logo);
    }

    const urls = [];

    for await (const order of ordersEntities) {
      const qrCodeImage = await QRCode.toDataURL(
        `${config.front_url}order/${order.id}`
      );

      const qr = qrCodeImage;

      const contacts = await strapi
        .query("contacts")
        .find({ users_permissions_user: order.owner.id });
      if (contacts.length === 0) {
        ctx.send(
          {
            done: false,
            message: `ERROR. L'usuària ${order.owner.username} no te cap contacte associat. Ves a contactes i crea un nou contacte associat a l'usuària a través del camp 'Persona'.`,
          },
          500
        );
        return;
      }
      const provider = contacts[0];

      const invoiceHeader = [
        {
          label: "COMANDA",
          value: order.id.toString().padStart(4, "0"),
        },
        {
          label: "DATA",
          value: moment(order.estimated_delivery_date, "YYYY-MM-DD").format(
            "DD-MM-YYYY"
          ),
        },
      ];

      const legal = [];

      legal.push({
        value: "NOTES:",
        color: "primary",
        weight: "bold",
      });
      let more = "";

      more =
        order.contact && order.contact.notes
          ? order.contact.notes + "\n"
          : order.contact_notes
          ? order.contact_notes + "\n"
          : "";

      more += order.contact_legal_form
        ? order.contact_legal_form.name + " - "
        : "";
      if (order.fragile) {
        more += "Fràgil" + " - ";
      }

      if (order.contact_time_slot_1_ini && order.contact_time_slot_1_end) {
        more +=
          "De " +
          order.contact_time_slot_1_ini +
          "h a " +
          order.contact_time_slot_1_end +
          "h" +
          " - ";
      }
      if (order.contact_time_slot_2_ini && order.contact_time_slot_2_end) {
        more +=
          "De " +
          order.contact_time_slot_2_ini +
          "h a " +
          order.contact_time_slot_2_end +
          "h";
      }

      if (more.endsWith(" - ")) {
        more = more.substring(0, more.length - 3);
      }

      order.comments = more + "\n" + (order.comments ? order.comments : "");

      legal.push({
        value: order.comments,
        color: "secondary",
      });

      legal.push({
        value: "DETALLS:",
        color: "primary",
        weight: "bold",
      });

      var concept = `${order.route.name.trim()}${
        order.estimated_delivery_date
          ? " - " + order.estimated_delivery_date
          : ""
      } - ${order.pickup.name} ${order.refrigerated ? "Refrigerada" : ""} - ${
        order.units
      } ${order.units > 1 ? "caixes" : "caixa"} - ${order.kilograms} kg`;

      legal.push({
        value: concept,
        color: "secondary",
      });

      const parts = [];
      if (order.lines && order.lines.length > 0) {
        legal.push({
          value: "RECOLLIDA:",
          color: "primary",
          weight: "bold",
        });
        // each lines can contain N boxes, ie. lines = [{units: 3, name: "name of the person 1", nif: "NIF of the person 1"}, {units: 1, name: "name of the person 2", nif: "NIF of the person 2"}]
        // In the first page, the order will show:
        // CAIXA 1/3 - name of the person 1 - NIF of the person 1
        // In the 2nd page, the order will show:
        // CAIXA 2/3 - name of the person 1 - NIF of the person 1
        // In the 3rd page, the order will show:
        // CAIXA 3/3 - name of the person 1 - NIF of the person 1
        // In the 4th page, the order will show:
        // CAIXA 1/1 - name of the person 2 - NIF of the person 2
        for (const line of order.lines) {
          if (line.units && line.units > 0) {
            for (let i = 0; i < line.units; i++) {
              parts.push({
                value: `CAIXA ${i + 1}/${line.units} - ${line.name} - ${
                  line.nif
                }`,
                color: "secondary",
              });
            }
          }
        }
      }

      const invoiceHeaderBoxes = [...invoiceHeader];

      // Build transfer pickup text if both origin and destination exist
      let transferPickupText = null;
      if (order.transfer_pickup_origin && order.transfer_pickup_destination) {
        const originAlias = order.transfer_pickup_origin.alias || order.transfer_pickup_origin.name;
        const destinationAlias = order.transfer_pickup_destination.alias || order.transfer_pickup_destination.name;
        transferPickupText = `${originAlias} -> ${destinationAlias}`;
      }

      let myInvoice = new MicroInvoiceOrder({
        style: {
          header: {
            image: {
              path: logo,
              width: logoWidth,
              height: me.logo.height / ratio,
            },
            qr: {
              path: qr,
              width: qrWidth,
              height: qrWidth,
            },
          },
        },
        data: {
          pages: order.units,
          invoice: {
            name: "COMANDA",

            header: invoiceHeaderBoxes,

            currency: "EUR",

            customer: [
              {
                label: "ENTREGA",
                value: [
                  order.contact.trade_name +
                    (order.contact.name &&
                    order.contact.name !== order.contact.trade_name
                      ? " - " + order.contact.name
                      : ""),
                  order.contact.nif,
                  order.contact.address,
                  order.contact.postcode + " " + order.contact.city,
                  `Tel: ${order.contact.phone}`,
                ],
              },
            ],

            seller: [
              {
                label: "EMISSORA",
                value: [
                  me.name,
                  me.phone,
                  // me.address,
                  // me.postcode + " " + me.city,
                  me.email,
                ],
              },
            ],

            provider: [
              {
                label: "PROVEÏDORA",
                value: [
                  provider.name,
                  // provider.nif,
                  // provider.address,
                  // provider.postcode + " " + provider.city,
                  provider.contact_phone
                    ? "Tel: " + provider.contact_phone
                    : "",
                ],
              },
            ],

            transfer: transferPickupText ? [
              {
                label: "TRANSFER",
                value: [transferPickupText],
              },
            ] : null,

            legal: legal,

            details: {
              // header: detailsHeader,
              parts: parts,
              // total: total,
            },
          },
        },
      });

      if (!fs.existsSync("./public/uploads/orders")) {
        fs.mkdirSync("./public/uploads/orders");
      }
      const hash = crypto
        .createHash("md5")
        .update(
          `${myInvoice.options.data.invoice.name}-${order.createdAt}-${order.id}`
        )
        .digest("hex");
      const docName = `./public/uploads/orders/${order.id}-H${hash.substring(
        16
      )}.pdf`;
      await myInvoice.generate(docName);

      //urls.push(docName.substring("./public".length));
      urls.push(docName);
    }

    // delay 200ms
    await new Promise((resolve) => setTimeout(resolve, 0));

    // get all pdfs and merge them
    const fileName = orders.join("-");
    const mergedPdf = await PDFMerge(urls, { output: "Buffer" });
    const mergedPdfPath = `./public/uploads/orders/orders-${fileName}.pdf`;
    fs.writeFileSync(mergedPdfPath, mergedPdf);

    ctx.send({ urls: mergedPdfPath.substring("./public".length) });
  },
  checkMultidelivery: async (ctx) => {
    const { id, date, contactId, ownerId } = ctx.request.body;

    const owner = await strapi
      .query("user", "users-permissions")
      .findOne({ id: ownerId });

    const ownerFactor = owner.multidelivery_discount === false ? 0 : 1;

    const me = await strapi.query("me").findOne();

    const ordersOfDateAndContact = await strapi.query("orders").find({
      estimated_delivery_date: moment(date).format("YYYY-MM-DD"),
      contact: contactId,
      _limit: -1,
    });

    const others = id
      ? ordersOfDateAndContact.filter(
          (o) => o.id.toString() !== id.toString() && o.status !== "cancelled"
        )
      : ordersOfDateAndContact;

    return {
      multidelivery_discount:
        others.length > 0 ? ownerFactor * me.orders_options.multidelivery_discount : 0,
    };
  },

  async create(ctx) {
    // If _tracking_user is not provided (e.g., from Strapi admin UI), get it from context
    if (!ctx.request.body._tracking_user && ctx.state.user) {
      ctx.request.body._tracking_user = ctx.state.user;
    }
    // Call the core create service
    const entity = await strapi.services.orders.create(ctx.request.body);
    return entity;
  },

  async update(ctx) {
    // If _tracking_user is not provided (e.g., from Strapi admin UI), get it from context
    if (!ctx.request.body._tracking_user && ctx.state.user) {
      ctx.request.body._tracking_user = ctx.state.user;
    }
    const { id } = ctx.params;
    // Call the core update service
    const entity = await strapi.services.orders.update({ id }, ctx.request.body);
    return entity;
  },
};
