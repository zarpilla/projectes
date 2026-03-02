'use strict';
const path = require("path");
const validator = require("xsd-schema-validator");

const FACE_FAKE_SEND_ENABLED =
	process.env.FACE_FAKE_SEND_ENABLED === undefined
		? true
		: process.env.FACE_FAKE_SEND_ENABLED === "true";
const FACE_FAKE_RESULT = process.env.FACE_FAKE_RESULT || "ok";
const FACE_FAKE_SOAP_URL =
	process.env.FACE_FAKE_SOAP_URL || "https://face.invalid/soap";
const FACE_XSD_TIMEOUT_MS = Number(process.env.FACE_XSD_TIMEOUT_MS || 0);
const FACE_XSD_VALIDATION_ENABLED = process.env.FACE_XSD_VALIDATION_ENABLED === "true";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

const toNumber = (value) => {
	const n = Number(value || 0);
	return Number.isFinite(n) ? n : 0;
};

const round2 = (value) => Math.round(toNumber(value) * 100) / 100;

const formatAmount = (value) => round2(value).toFixed(2);

const escapeXml = (value) =>
	String(value === null || value === undefined ? "" : value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&apos;");

const formatDate = (value) => {
	if (!value) {
		return new Date().toISOString().substring(0, 10);
	}

	if (typeof value === "string") {
		return value.substring(0, 10);
	}

	return new Date(value).toISOString().substring(0, 10);
};

const getInvoiceLineAmounts = (line) => {
	const quantity = toNumber(line.quantity || 1);
	const base = toNumber(line.base);
	const discount = toNumber(line.discount);
	const vat = toNumber(line.vat);

	const extension = round2(base * quantity * (1 - discount / 100));
	const vatAmount = round2(extension * (vat / 100));

	return {
		quantity,
		base,
		vat,
		extension,
		vatAmount,
	};
};

const buildUblInvoiceXml = ({ invoice, me, contact, dir3 }) => {
	const issueDate = formatDate(invoice.emitted || invoice.created_at);
	const dueDate = invoice.paybefore ? formatDate(invoice.paybefore) : null;
	const invoiceId = invoice.code || `INV-${invoice.id}`;
	const currency = "EUR";
	const lines = Array.isArray(invoice.lines) ? invoice.lines : [];

	const supplierName = me && me.name ? me.name : "";
	const supplierNif = me && me.nif ? me.nif : "";
	const supplierAddress = me && me.address ? me.address : "";
	const supplierCity = me && me.city ? me.city : "";
	const supplierPostcode = me && me.postcode ? me.postcode : "";
	const supplierCountry = me && me.country ? me.country : "ES";

	const customerName =
		(contact && contact.name) ||
		(invoice.contact_info && invoice.contact_info.name) ||
		"";
	const customerNif =
		(contact && contact.nif) ||
		(invoice.contact_info && invoice.contact_info.nif) ||
		"";
	const customerAddress =
		(contact && contact.address) ||
		(invoice.contact_info && invoice.contact_info.address) ||
		"";
	const customerCity =
		(contact && contact.city) ||
		(invoice.contact_info && invoice.contact_info.city) ||
		"";
	const customerPostcode =
		(contact && contact.postcode) ||
		(invoice.contact_info && invoice.contact_info.postcode) ||
		"";
	const customerCountry =
		(contact && contact.country) ||
		(invoice.contact_info && invoice.contact_info.country) ||
		"ES";
	const dir3Oc = dir3 && dir3.oc ? dir3.oc : "";
	const dir3Og = dir3 && dir3.og ? dir3.og : "";
	const dir3Ut = dir3 && dir3.ut ? dir3.ut : "";

	let totalBase = 0;
	let totalVat = 0;

	const invoiceLinesXml = lines
		.map((line, index) => {
			const { quantity, base, vat, extension, vatAmount } = getInvoiceLineAmounts(
				line
			);

			totalBase += extension;
			totalVat += vatAmount;

			const itemName = line.concept || `Línia ${index + 1}`;
			const taxCategoryId = vat > 0 ? "S" : "E";

			return [
				"  <cac:InvoiceLine>",
				`    <cbc:ID>${index + 1}</cbc:ID>`,
				`    <cbc:InvoicedQuantity unitCode=\"C62\">${formatAmount(quantity)}</cbc:InvoicedQuantity>`,
				`    <cbc:LineExtensionAmount currencyID=\"${currency}\">${formatAmount(extension)}</cbc:LineExtensionAmount>`,
				"    <cac:TaxTotal>",
				`      <cbc:TaxAmount currencyID=\"${currency}\">${formatAmount(vatAmount)}</cbc:TaxAmount>`,
				"    </cac:TaxTotal>",
				"    <cac:Item>",
				`      <cbc:Name>${escapeXml(itemName)}</cbc:Name>`,
				"      <cac:ClassifiedTaxCategory>",
				`        <cbc:ID>${taxCategoryId}</cbc:ID>`,
				`        <cbc:Percent>${formatAmount(vat)}</cbc:Percent>`,
				"        <cac:TaxScheme>",
				"          <cbc:ID>VAT</cbc:ID>",
				"        </cac:TaxScheme>",
				"      </cac:ClassifiedTaxCategory>",
				"    </cac:Item>",
				"    <cac:Price>",
				`      <cbc:PriceAmount currencyID=\"${currency}\">${formatAmount(base)}</cbc:PriceAmount>`,
				"    </cac:Price>",
				"  </cac:InvoiceLine>",
			].join("\n");
		})
		.join("\n");

	totalBase = round2(invoice.total_base || totalBase);
	totalVat = round2(invoice.total_vat || totalVat);
	const taxInclusive = round2(totalBase + totalVat);
	const payable = round2(invoice.total || taxInclusive);

	const xmlParts = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
		'  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
		'  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">',
		"  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>",
		"  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>",
		`  <cbc:ID>${escapeXml(invoiceId)}</cbc:ID>`,
		`  <cbc:IssueDate>${issueDate}</cbc:IssueDate>`,
		...(dueDate ? [`  <cbc:DueDate>${dueDate}</cbc:DueDate>`] : []),
		"  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>",
		`  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>`,
		"  <cac:AccountingSupplierParty>",
		"    <cac:Party>",
		`      <cbc:EndpointID>${escapeXml(supplierNif)}</cbc:EndpointID>`,
		"      <cac:PartyIdentification>",
		`        <cbc:ID>${escapeXml(supplierNif)}</cbc:ID>`,
		"      </cac:PartyIdentification>",
		"      <cac:PartyName>",
		`        <cbc:Name>${escapeXml(supplierName)}</cbc:Name>`,
		"      </cac:PartyName>",
		"      <cac:PostalAddress>",
		`        <cbc:StreetName>${escapeXml(supplierAddress)}</cbc:StreetName>`,
		`        <cbc:CityName>${escapeXml(supplierCity)}</cbc:CityName>`,
		`        <cbc:PostalZone>${escapeXml(supplierPostcode)}</cbc:PostalZone>`,
		"        <cac:Country>",
		`          <cbc:IdentificationCode>${escapeXml(supplierCountry || "ES")}</cbc:IdentificationCode>`,
		"        </cac:Country>",
		"      </cac:PostalAddress>",
		"      <cac:PartyTaxScheme>",
		`        <cbc:CompanyID>${escapeXml(supplierNif)}</cbc:CompanyID>`,
		"        <cac:TaxScheme>",
		"          <cbc:ID>VAT</cbc:ID>",
		"        </cac:TaxScheme>",
		"      </cac:PartyTaxScheme>",
		"      <cac:PartyLegalEntity>",
		`        <cbc:RegistrationName>${escapeXml(supplierName)}</cbc:RegistrationName>`,
		"      </cac:PartyLegalEntity>",
		"    </cac:Party>",
		"  </cac:AccountingSupplierParty>",
		"  <cac:AccountingCustomerParty>",
		"    <cac:Party>",
		`      <cbc:EndpointID>${escapeXml(customerNif)}</cbc:EndpointID>`,
		"      <cac:PartyIdentification>",
		`        <cbc:ID>${escapeXml(customerNif)}</cbc:ID>`,
		"      </cac:PartyIdentification>",
		"      <cac:PartyIdentification>",
		`        <cbc:ID schemeID=\"DIR3-OC\">${escapeXml(dir3Oc)}</cbc:ID>`,
		"      </cac:PartyIdentification>",
		"      <cac:PartyIdentification>",
		`        <cbc:ID schemeID=\"DIR3-OG\">${escapeXml(dir3Og)}</cbc:ID>`,
		"      </cac:PartyIdentification>",
		"      <cac:PartyIdentification>",
		`        <cbc:ID schemeID=\"DIR3-UT\">${escapeXml(dir3Ut)}</cbc:ID>`,
		"      </cac:PartyIdentification>",
		"      <cac:PartyName>",
		`        <cbc:Name>${escapeXml(customerName)}</cbc:Name>`,
		"      </cac:PartyName>",
		"      <cac:PostalAddress>",
		`        <cbc:StreetName>${escapeXml(customerAddress)}</cbc:StreetName>`,
		`        <cbc:CityName>${escapeXml(customerCity)}</cbc:CityName>`,
		`        <cbc:PostalZone>${escapeXml(customerPostcode)}</cbc:PostalZone>`,
		"        <cac:Country>",
		`          <cbc:IdentificationCode>${escapeXml(customerCountry || "ES")}</cbc:IdentificationCode>`,
		"        </cac:Country>",
		"      </cac:PostalAddress>",
		"      <cac:PartyTaxScheme>",
		`        <cbc:CompanyID>${escapeXml(customerNif)}</cbc:CompanyID>`,
		"        <cac:TaxScheme>",
		"          <cbc:ID>VAT</cbc:ID>",
		"        </cac:TaxScheme>",
		"      </cac:PartyTaxScheme>",
		"      <cac:PartyLegalEntity>",
		`        <cbc:RegistrationName>${escapeXml(customerName)}</cbc:RegistrationName>`,
		"      </cac:PartyLegalEntity>",
		"    </cac:Party>",
		"  </cac:AccountingCustomerParty>",
		"  <cac:TaxTotal>",
		`    <cbc:TaxAmount currencyID=\"${currency}\">${formatAmount(totalVat)}</cbc:TaxAmount>`,
		"  </cac:TaxTotal>",
		"  <cac:LegalMonetaryTotal>",
		`    <cbc:LineExtensionAmount currencyID=\"${currency}\">${formatAmount(totalBase)}</cbc:LineExtensionAmount>`,
		`    <cbc:TaxExclusiveAmount currencyID=\"${currency}\">${formatAmount(totalBase)}</cbc:TaxExclusiveAmount>`,
		`    <cbc:TaxInclusiveAmount currencyID=\"${currency}\">${formatAmount(taxInclusive)}</cbc:TaxInclusiveAmount>`,
		`    <cbc:PayableAmount currencyID=\"${currency}\">${formatAmount(payable)}</cbc:PayableAmount>`,
		"  </cac:LegalMonetaryTotal>",
		invoiceLinesXml,
		"</Invoice>",
	];

	return xmlParts.filter(Boolean).join("\n");
};

const validateXmlAgainstXsd = async (xml) => {
	const xsdPath = path.join(
		__dirname,
		"..",
		"schemas",
		"ubl-invoice-basic-2.1.xsd"
	);

	return new Promise((resolve, reject) => {
		let settled = false;
		const timeout =
			FACE_XSD_TIMEOUT_MS > 0
				? setTimeout(() => {
						if (!settled) {
							settled = true;
							reject(
								new Error(
									`XSD validation timeout after ${FACE_XSD_TIMEOUT_MS}ms`
								)
							);
						}
				  }, FACE_XSD_TIMEOUT_MS)
				: null;

		validator.validateXML(xml, xsdPath, (err, result) => {
			if (settled) {
				return;
			}
			settled = true;
			if (timeout) {
				clearTimeout(timeout);
			}

			if (err) {
				reject(err);
				return;
			}

			if (!result || result.valid !== true) {
				const messages = result && result.messages ? result.messages : "Unknown XSD validation error";
				reject(new Error(Array.isArray(messages) ? messages.join(" | ") : messages));
				return;
			}

			resolve(true);
		});
	});
};

const fakeSendToFace = async ({ queueId, invoiceId, mode, xml }) => {
	const result = ["ok", "warning", "error"].includes(FACE_FAKE_RESULT)
		? FACE_FAKE_RESULT
		: "error";
	const requestBody = [
		"<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\">",
		"  <soapenv:Header/>",
		"  <soapenv:Body>",
		xml,
		"  </soapenv:Body>",
		"</soapenv:Envelope>",
	].join("\n");

	const response = {
		type: "fake-face-send",
		queueId,
		invoiceId,
		mode,
		result,
		message:
			result === "ok"
				? "FACe fake sender accepted invoice"
				: result === "warning"
					? "FACe fake sender accepted invoice with warnings"
					: "FACe fake sender rejected invoice",
		date: new Date().toISOString(),
	};

	return {
		status: result,
		requestUrl: FACE_FAKE_SOAP_URL,
		requestBody,
		responseBody: JSON.stringify(response, null, 2),
	};
};

const startFaceProcess = async (faceQueueInput) => {
	if (!faceQueueInput) {
		return;
	}

	const faceQueueId =
		typeof faceQueueInput === "object"
			? faceQueueInput.id
			: faceQueueInput;

	if (!faceQueueId) {
		return;
	}

	const faceQueue = await strapi.query("face-queue").findOne({ id: faceQueueId });

	if (!faceQueue) {
		strapi.log.warn(`[face-queue] startFaceProcess queue not found id=${faceQueueId}`);
		return;
	}

	strapi.log.info(`[face-queue] startFaceProcess id=${faceQueue.id}`);

	const emittedInvoiceId =
		faceQueue.emitted_invoice && typeof faceQueue.emitted_invoice === "object"
			? faceQueue.emitted_invoice.id
			: faceQueue.emitted_invoice;

	if (!emittedInvoiceId) {
		strapi.log.warn(`[face-queue] missing emitted_invoice id=${faceQueue.id}`);
		await strapi.query("face-queue").update(
			{ id: faceQueue.id },
			{
				_internal: true,
				status: "error",
				response_body: "No emitted invoice linked to face-queue record",
			}
		);
		return;
	}

	const invoice = await strapi.query("emitted-invoice").findOne(
		{ id: emittedInvoiceId },
		["lines", "contact", "contact_info"]
	);

	if (!invoice) {
		strapi.log.warn(`[face-queue] emitted invoice not found queue=${faceQueue.id} invoice=${emittedInvoiceId}`);
		await strapi.query("face-queue").update(
			{ id: faceQueue.id },
			{
				_internal: true,
				status: "error",
				response_body: `Emitted invoice not found: ${emittedInvoiceId}`,
			}
		);
		return;
	}

	const invoiceSnapshot = JSON.parse(JSON.stringify(invoice));

	const me = await strapi.query("me").findOne();
	const contactId =
		invoice.contact && typeof invoice.contact === "object"
			? invoice.contact.id
			: invoice.contact;
	const contact = contactId
		? await strapi.query("contacts").findOne({ id: contactId })
		: null;

	if (!contact) {
		strapi.log.warn(`[face-queue] contact not found queue=${faceQueue.id} invoice=${emittedInvoiceId}`);
		await strapi.query("face-queue").update(
			{ id: faceQueue.id },
			{
				_internal: true,
				invoice: invoiceSnapshot,
				status: "error",
				response_body: "FACe pre-validation error: contact not found",
			}
		);
		return;
	}

	const dir3 = {
		oc: contact.face_dir3_oc,
		og: contact.face_dir3_og,
		ut: contact.face_dir3_ut,
	};

	const missingDir3 = [];
	if (!dir3.oc) {
		missingDir3.push("OC");
	}
	if (!dir3.og) {
		missingDir3.push("OG");
	}
	if (!dir3.ut) {
		missingDir3.push("UT");
	}

	if (missingDir3.length > 0) {
		strapi.log.warn(
			`[face-queue] missing DIR3 queue=${faceQueue.id} missing=${missingDir3.join(",")}`
		);
		await strapi.query("face-queue").update(
			{ id: faceQueue.id },
			{
				_internal: true,
				invoice: invoiceSnapshot,
				status: "error",
				response_body: `FACe pre-validation error: missing DIR3 values (${missingDir3.join(", ")})`,
			}
		);
		return;
	}

	const xml = buildUblInvoiceXml({ invoice, me, contact, dir3 });

	if (!xml || !xml.includes("<Invoice") || !xml.includes("</Invoice>")) {
		strapi.log.warn(`[face-queue] invalid generated xml queue=${faceQueue.id}`);
		await strapi.query("face-queue").update(
			{ id: faceQueue.id },
			{
				_internal: true,
				invoice: invoiceSnapshot,
				status: "error",
				response_body: "Invalid generated UBL XML",
			}
		);
		return;
	}

	if (FACE_XSD_VALIDATION_ENABLED) {
		try {
			strapi.log.info(`[face-queue] validating xml queue=${faceQueue.id}`);
			await validateXmlAgainstXsd(xml);
			strapi.log.info(`[face-queue] xml validation ok queue=${faceQueue.id}`);
		} catch (error) {
			strapi.log.error(
				`[face-queue] xml validation error queue=${faceQueue.id}: ${
					error && error.message ? error.message : error
				}`
			);
			await strapi.query("face-queue").update(
				{ id: faceQueue.id },
				{
					_internal: true,
					invoice: invoiceSnapshot,
					status: "error",
					response_body: `XSD validation error: ${
						error && error.message ? error.message : String(error)
					}`,
				}
			);
			return;
		}
	} else {
		strapi.log.info(`[face-queue] xml validation skipped queue=${faceQueue.id}`);
	}

	await strapi.query("face-queue").update(
		{ id: faceQueue.id },
		{
			_internal: true,
			invoice: invoiceSnapshot,
			request_body: xml,
			request_url: FACE_FAKE_SOAP_URL,
			status: "pending",
		}
	);

	strapi.log.info(`[face-queue] xml persisted queue=${faceQueue.id}`);

	if (FACE_FAKE_SEND_ENABLED) {
		const fakeResult = await fakeSendToFace({
			queueId: faceQueue.id,
			invoiceId: emittedInvoiceId,
			mode: faceQueue.mode,
			xml,
		});

		await strapi.query("face-queue").update(
			{ id: faceQueue.id },
			{
				_internal: true,
				invoice: invoiceSnapshot,
				request_url: fakeResult.requestUrl,
				request_body: fakeResult.requestBody,				
				response_body: fakeResult.responseBody,
				status: fakeResult.status,
			}
		);

		strapi.log.info(
			`[face-queue] fake send finished queue=${faceQueue.id} status=${fakeResult.status}`
		);
	}

	strapi.log.info(
		`[face-queue] FACe process started for queue ${faceQueue.id} (invoice ${emittedInvoiceId || "-"})`
	);
};

module.exports = {
	startFaceProcess,
};
