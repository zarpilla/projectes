'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const _ = require('lodash');
var MicroInvoice = require("../../../utils/microinvoice");
var fs = require('fs');
const sharp = require("sharp")
const moment = require("moment")
const crypto = require('crypto')

const getEntityInfo = async (entity) => {
    const documents = await strapi.query(entity).find({ vat_paid_date_null: true, total_vat_gt: 0, _limit: -1 });
    return { documents: documents, total_vat: _.sumBy(documents, 'total_vat') }
}

const payEntity = async (documents, entity, vat_paid_date) => {
    for (let i = 0; i < documents.length; i++) {
        await strapi.query(entity).update({ id: documents[i].id }, { vat_paid_date: vat_paid_date, _internal: true });
    }
    return documents
}


const formatCurrency = (val) => {
    if (!val) { return '-' }
    return val.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&;').replace(/\./g, ',').replace(/;/g, '.')
}

module.exports = {

    pdf: async ctx => {
        const { id, doc } = ctx.params;

        const invoice = await strapi
            .query(doc)
            .findOne({ id });

        const me = await strapi
            .query("me")
            .findOne();

        // console.log('invoice', invoice)

        const logoUrl = `./public${me.logo.url}`

        var logo = logoUrl

        if (logoUrl.endsWith('.svg')) {
            logo = './public/uploads/invoice-logo.jpg'
            await sharp(logoUrl)
                .png()
                .toFile(logo)
        }

        const width = 100
        const ratio = me.logo.width / width

        const invoiceHeader = [{
            label: "Número",
            value: invoice.code
        }, {
            label: "Data",
            value: moment(invoice.emitted, "YYYY-MM-DD").format("DD-MM-YYYY")
        }]

        if (invoice.paybefore) {
            invoiceHeader.push({
                label: "Venciment",
                value: moment(invoice.paybefore, "YYYY-MM-DD").format("DD-MM-YYYY")
            })
        } else if (invoice.paid && invoice.paid_date && doc === 'received-expense') {
            invoiceHeader.push({
                label: "Pagada",
                value: moment(invoice.paid_date, "YYYY-MM-DD").format("DD-MM-YYYY")
            })
        }

        const showDate = invoice.lines.find(l => l.date) !== undefined
        const showQuantity = invoice.lines.find(l => l.quantity > 1) !== undefined
        const showVat = invoice.lines.find(l => l.vat > 0) !== undefined
        const showIrpf = invoice.lines.find(l => l.irpf > 0) !== undefined

        const detailsHeader = []

        let columnsWidth = 0.35 + (showDate ? 0.1 : 0) + (showQuantity ? 0.08 * 2 : 0) + 0.19 + (showVat ? 0.1 : 0) + (showIrpf ? 0.1 : 0) + 0.1

        let columnsRatio = 1 / columnsWidth

        detailsHeader.push({
            value: "Concepte",
            width: 0.35 * columnsRatio
        })
        if (showDate) {
            detailsHeader.push({
                value: "Data",
                width: 0.12 * columnsRatio
            })
        }
        if (showQuantity) {
            detailsHeader.push({
                value: "Q.",
                width: 0.07 * columnsRatio
            })
        }
        if (showQuantity) {
            detailsHeader.push({
                value: "Base",
                width: 0.09 * columnsRatio
            })
        }
        detailsHeader.push({
            value: "Base imposable",
            width: 0.18 * columnsRatio
        })
        if (showVat) {
            detailsHeader.push({
                value: "IVA",
                width: 0.1 * columnsRatio
            })
        }
        if (showIrpf) {
            detailsHeader.push({
                value: "IRPF",
                width: 0.1 * columnsRatio
            })
        }
        detailsHeader.push({
            value: "Subtotal",
            width: 0.1 * columnsRatio
        })

        const parts = []

        for (var i = 0; i < invoice.lines.length; i++) {
            const line = invoice.lines[i]
            const part = []

            if (line.quantity && line.base) {
                var concept = line.concept
                if (line.comments) {
                    concept += '\n\n' + line.comments
                }
                part.push({
                    value: concept,
                    width: 0.35 * columnsRatio
                })
                if (showDate) {
                    part.push({
                        value: line.date,
                        width: 0.12 * columnsRatio
                    })
                }
                if (showQuantity) {
                    part.push({
                        value: line.quantity,
                        width: 0.07 * columnsRatio
                    })
                }

                if (showQuantity) {
                    part.push({
                        value: line.base,
                        width: 0.09 * columnsRatio, price: true,
                    })
                }

                part.push({
                    value: line.quantity * line.base, price: true,
                    width: 0.18 * columnsRatio
                })
                if (showVat) {
                    part.push({
                        value: formatCurrency(line.quantity * line.base * line.vat / 100) + ` EUR (${line.vat}%)`,
                        // price: true,
                        width: 0.1 * columnsRatio
                    })
                }
                if (showIrpf) {
                    part.push({
                        value: formatCurrency(-1 * line.quantity * line.base * line.irpf / 100) + ` EUR (${line.irpf}%)`,
                        // price: true,
                        width: 0.1 * columnsRatio
                    })
                }
                part.push({
                    value: line.quantity * line.base - (line.quantity * line.base * line.irpf / 100) + (line.quantity * line.base * line.vat / 100), price: true,
                    width: 0.1 * columnsRatio
                })
                parts.push(part)
            }
        }

        const total = []
        total.push({
            label: "Base imposable",
            value: invoice.total_base,
            price: true
        })
        if (showVat) {
            total.push({
                label: "IVA",
                value: invoice.total_vat,
                price: true
            })
        }
        if (showIrpf) {
            total.push({
                label: "IRPF",
                value: -1 * invoice.total_irpf,
                price: true
            })
        }
        total.push({
            label: "TOTAL",
            value: invoice.total,
            price: true
        })

        const legal = []
        if (invoice.comments) {
            legal.push({
                value: invoice.comments,
                color: "secondary"
            })
        }
        if (invoice?.payment_method?.invoice_text && doc === 'emitted-invoice') {
            legal.push({
                value: invoice?.payment_method?.invoice_text,
                weight: "bold",
                color: "primary"
            })
        }
        if (me.invoice_footer) {
            legal.push({
                value: me.invoice_footer,
                color: "secondary"
            })
        }

        let myInvoice = new MicroInvoice({
            style: {
                header: {
                    image: {
                        path: logo,
                        width: width, //250,
                        height: me.logo.height / ratio
                    }
                }
            },
            data: {
                invoice: {
                    name: invoice.document_type?.name ? invoice.document_type?.name : (doc === "quote" ? "Pressupost" : "Factura" ) ,

                    header: invoiceHeader,

                    currency: 'EUR',

                    customer: [{
                        label: doc !== 'emitted-invoice' ? "PROVEÏDOR" : "CLIENT",
                        value: [
                            invoice.contact.name,
                            invoice.contact.nif,
                            invoice.contact.address,
                            invoice.contact.postcode + " " + invoice.contact.city
                        ]
                    }
                    ],

                    seller: [{
                        label: doc !== 'emitted-invoice' ? "CLIENT" : "PROVEÏDOR",
                        value: [
                            me.name,
                            me.nif,
                            me.address,
                            me.postcode + " " + me.city,
                            me.email
                        ]
                    }],

                    legal: legal,

                    details: {
                        header: detailsHeader,

                        parts: parts,

                        total: total
                    }
                }
            }
        });

        if (!fs.existsSync('./public/uploads/documents')){
            fs.mkdirSync('./public/uploads/documents');
        }
        const hash = crypto.createHash('md5').update(`${myInvoice.options.data.invoice.name}-${invoice.code}-${id}`).digest("hex")
        const docName = `./public/uploads/documents/${myInvoice.options.data.invoice.name}-${invoice.contact.name}-${invoice.code}-H${hash.substring(16)}.pdf`
        await myInvoice.generate(docName)        
                
        return { url: docName.substring('./public'.length) }
    },

    payVat: async ctx => {
        const eInvoiceInfo = await getEntityInfo('emitted-invoice')
        const incomeInfo = await getEntityInfo('received-income')
        const rInvoiceInfo = await getEntityInfo('received-invoice')
        const expenseInfo = await getEntityInfo('received-expense')
        const me = await strapi.query('me').findOne()
        if (me.options.deductible_vat_pct) {
            const total_vat = (rInvoiceInfo.total_vat + expenseInfo.total_vat - eInvoiceInfo.total_vat - incomeInfo.total_vat) * me.options.deductible_vat_pct / 100.0
            const vat_paid_date = new Date()
            if (total_vat !== 0) {
                await strapi.query('treasury').create({ comment: 'IVA Saldat', total: total_vat, date: vat_paid_date })

                await payEntity(eInvoiceInfo.documents, 'emitted-invoice', vat_paid_date)
                await payEntity(incomeInfo.documents, 'received-income', vat_paid_date)
                await payEntity(rInvoiceInfo.documents, 'received-invoice', vat_paid_date)
                await payEntity(expenseInfo.documents, 'received-expense', vat_paid_date)
            }
        }
        return { done: true, emittedInvoices: eInvoiceInfo.documents, receivedIncomes: incomeInfo.documents, receivedInvoices: rInvoiceInfo.documents, receivedExpenses: expenseInfo.documents }
    }
};
