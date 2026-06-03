// Test new sign-facturae directly
const { signFacturaeXml } = require('./api/face-queue/services/sign-facturae');
const fs = require('fs');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<facturae:Facturae xmlns:facturae="http://www.facturae.es/Facturae/2009/v3.2/Facturae">
<FileHeader><SchemaVersion>3.2</SchemaVersion><Modality>I</Modality><InvoiceIssuerType>EM</InvoiceIssuerType><Batch><BatchIdentifier>TEST001</BatchIdentifier><InvoicesCount>1</InvoicesCount><TotalInvoicesAmount><TotalAmount>1.21</TotalAmount></TotalInvoicesAmount><TotalOutstandingAmount><TotalAmount>1.21</TotalAmount></TotalOutstandingAmount><TotalExecutableAmount><TotalAmount>1.21</TotalAmount></TotalExecutableAmount><InvoiceCurrencyCode>EUR</InvoiceCurrencyCode></Batch></FileHeader>
<Parties><SellerParty><TaxIdentification><PersonTypeCode>F</PersonTypeCode><ResidenceTypeCode>R</ResidenceTypeCode><TaxIdentificationNumber>39891236J</TaxIdentificationNumber></TaxIdentification><Individual><Name>Jordi</Name><FirstSurname>Sabate</FirstSurname><AddressInSpain><Address>Test</Address><PostCode>08001</PostCode><Town>Barcelona</Town><Province>Barcelona</Province><CountryCode>ESP</CountryCode></AddressInSpain></Individual></SellerParty></Parties>
</facturae:Facturae>`;

(async () => {
	try {
		const signed = await signFacturaeXml(
			xml,
			'/home/jordi/Documents/work/webcoop/projectes/projectes/public/uploads/SABATE_ESTOPA_JORDI_39891236_J_bad1cd15b4.p12',
			'Zarpilla01*'
		);
		fs.writeFileSync('/tmp/test-signed.xml', signed);
		console.log('Signed XML written to /tmp/test-signed.xml');
		console.log('Length:', signed.length);
	} catch (e) {
		console.error('Error:', e.message);
		console.error(e.stack);
	}
})();
