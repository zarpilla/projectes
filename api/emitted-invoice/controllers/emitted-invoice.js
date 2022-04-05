'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const _ = require('lodash');

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

module.exports = {

    payVat: async ctx => {
        const eInvoiceInfo = await getEntityInfo('emitted-invoice')
        const incomeInfo = await getEntityInfo('received-income')
        const rInvoiceInfo = await getEntityInfo('received-invoice')
        const expenseInfo = await getEntityInfo('received-expense')
        const me = await strapi.query('me').findOne()
        if (me.options.deductible_vat_pct) {
            const total_vat = ( rInvoiceInfo.total_vat + expenseInfo.total_vat - eInvoiceInfo.total_vat - incomeInfo.total_vat ) * me.options.deductible_vat_pct / 100.0
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
