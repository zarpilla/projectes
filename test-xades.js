// Test xadesjs Facturae signing
const fs = require('fs');
const forge = require('node-forge');
const xadesjs = require('xadesjs');
const { Crypto } = require('@peculiar/webcrypto');

xadesjs.Application.setEngine('NodeJS', new Crypto());
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
xadesjs.setNodeDependencies({ DOMParser, XMLSerializer });
// Set on xmldsigjs's xml-core too
const xmldsigXmlCore = require(require.resolve('xml-core', { paths: [require.resolve('xmldsigjs')] }));
xmldsigXmlCore.setNodeDependencies({ DOMParser, XMLSerializer });

xadesjs.xml.XadesDateTime.prototype.OnGetXml = function (e) {
	const d = this.Value;
	const pad = (n, w = 2) => String(n).padStart(w, '0');
	const offMin = -d.getTimezoneOffset();
	const sign = offMin >= 0 ? '+' : '-';
	const oh = pad(Math.floor(Math.abs(offMin) / 60));
	const om = pad(Math.abs(offMin) % 60);
	e.textContent = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${oh}:${om}`;
};

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<facturae:Facturae xmlns:facturae="http://www.facturae.es/Facturae/2009/v3.2/Facturae">
<FileHeader><SchemaVersion>3.2</SchemaVersion><Modality>I</Modality><InvoiceIssuerType>EM</InvoiceIssuerType><Batch><BatchIdentifier>TEST001</BatchIdentifier><InvoicesCount>1</InvoicesCount><TotalInvoicesAmount><TotalAmount>1.21</TotalAmount></TotalInvoicesAmount><TotalOutstandingAmount><TotalAmount>1.21</TotalAmount></TotalOutstandingAmount><TotalExecutableAmount><TotalAmount>1.21</TotalAmount></TotalExecutableAmount><InvoiceCurrencyCode>EUR</InvoiceCurrencyCode></Batch></FileHeader>
<Parties><SellerParty><TaxIdentification><PersonTypeCode>F</PersonTypeCode><ResidenceTypeCode>R</ResidenceTypeCode><TaxIdentificationNumber>39891236J</TaxIdentificationNumber></TaxIdentification><Individual><Name>Jordi</Name><FirstSurname>Sabate</FirstSurname><AddressInSpain><Address>Test</Address><PostCode>08001</PostCode><Town>Barcelona</Town><Province>Barcelona</Province><CountryCode>ESP</CountryCode></AddressInSpain></Individual></SellerParty></Parties>
</facturae:Facturae>`;

(async () => {
	const p12Path = '/home/jordi/Documents/work/webcoop/projectes/projectes/public/uploads/SABATE_ESTOPA_JORDI_39891236_J_bad1cd15b4.p12';
	const p12Pass = 'Zarpilla01*';

	// Load p12 with node-forge, extract cert and private key in PEM
	const p12Buffer = fs.readFileSync(p12Path);
	const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
	const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, p12Pass);
	const cert = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0].cert;
	const privKey = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;

	// Cert as base64 DER (without PEM headers)
	const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
	const certBase64 = forge.util.encode64(certDer);

	// Private key as PKCS8 DER -> import via WebCrypto
	const pkcs8Der = forge.asn1.toDer(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(privKey))).getBytes();
	const pkcs8Buffer = Buffer.from(pkcs8Der, 'binary');

	const crypto = new Crypto();
	const cryptoKey = await crypto.subtle.importKey(
		'pkcs8',
		pkcs8Buffer,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
		false,
		['sign']
	);

	// Also import public key for keyValue
	const spkiDer = forge.asn1.toDer(forge.pki.publicKeyToAsn1(cert.publicKey)).getBytes();
	const spkiBuffer = Buffer.from(spkiDer, 'binary');
	const pubKey = await crypto.subtle.importKey(
		'spki', spkiBuffer,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
		true, ['verify']
	);

	const doc = xadesjs.Parse(xml);

	const sigId = `Signature-${Date.now()}`;
	const keyInfoId = `${sigId}-KeyInfo`;
	const refDocId = `Reference-${Date.now()}`;

	// Subclass to set KeyInfo Id BEFORE DigestReferences runs and add DataObjectFormat
	const reverseIssuer = (issuer) => issuer.split(/,\s*/).reverse().join(',');
	class FacturaeSignedXml extends xadesjs.SignedXml {
		async ApplySignOptions(signature, algorithm, key, options) {
			await super.ApplySignOptions(signature, algorithm, key, options);
			if (signature.KeyInfo) signature.KeyInfo.Id = keyInfoId;
			const qp = this.Properties;
			if (qp) {
				qp.Target = `#${signature.Id}`;
				if (qp.SignedProperties) {
					qp.SignedProperties.Id = `${signature.Id}-SignedProperties`;
				}
			}
			const ssp = qp && qp.SignedProperties && qp.SignedProperties.SignedSignatureProperties;
			if (ssp && ssp.SigningCertificate && ssp.SigningCertificate.Count) {
				const sc = ssp.SigningCertificate.Item(0);
				sc.IssuerSerial.X509IssuerName = reverseIssuer(sc.IssuerSerial.X509IssuerName);
			}
			const sp = qp && qp.SignedProperties;
			if (sp) {
				const sdop = new xadesjs.xml.SignedDataObjectProperties();
				const dof = new xadesjs.xml.DataObjectFormat();
				dof.ObjectReference = `#${refDocId}`;
				dof.MimeType = 'text/xml';
				dof.Encoding = 'UTF-8';
				const oid = new xadesjs.xml.ObjectIdentifier();
				oid.Identifier = new xadesjs.xml.Identifier();
				oid.Identifier.Qualifier = 'OIDAsURN';
				oid.Identifier.Value = 'urn:oid:1.2.840.10003.5.109.10';
				dof.ObjectIdentifier = oid;
				sdop.DataObjectFormats.Add(dof);
				sp.SignedDataObjectProperties = sdop;
			}
			if (qp && qp.SignedProperties) {
				const refs = signature.SignedInfo.References;
				for (let i = 0; i < refs.Count; i++) {
					const r = refs.Item(i);
					if (r && r.Type && /SignedProperties$/.test(r.Type)) {
						r.Uri = `#${qp.SignedProperties.Id}`;
					}
				}
			}
		}
	}
	const signedXml = new FacturaeSignedXml();

	await signedXml.Sign(
		{ name: 'RSASSA-PKCS1-v1_5' },
		cryptoKey,
		doc,
		{
			id: sigId,
			keyValue: pubKey,
			x509: [certBase64],
			references: [
				{ id: refDocId, uri: '', hash: 'SHA-1', transforms: ['enveloped'] },
				{ uri: `#${keyInfoId}`, hash: 'SHA-1' },
			],
			signingCertificate: { certificate: certBase64, digestAlgorithm: 'SHA-1' },
			signingTime: { value: new Date() },
			policy: {
				identifier: {
					value: 'http://www.facturae.es/politica_de_firma_formato_facturae/politica_de_firma_formato_facturae_v3_1.pdf',
					description: 'Facturación electrónica con formato Facturae',
				},
				hash: 'SHA-1',
				digestValue: 'Ohixl6upD6av8N7pEvDABhEL6hM=',
				qualifiers: [
					'http://www.facturae.es/politica_de_firma_formato_facturae/politica_de_firma_formato_facturae_v3_1.pdf',
				],
			},
			signerRole: {
				claimed: ['emisor'],
			},
		}
	);

	// Append signature to document root
	const sigEl = signedXml.GetXml();

	doc.documentElement.appendChild(sigEl);

	const serialized = new (require('xmldom').XMLSerializer)().serializeToString(doc);
	// Strip any embedded xml decl that xmldom may add
	const clean = serialized.replace(/^<\?xml[^>]*\?>\s*/, '');
	fs.writeFileSync('/tmp/xades-signed.xml', '<?xml version="1.0" encoding="UTF-8"?>\n' + clean);
	console.log('Wrote /tmp/xades-signed.xml, len=', clean.length);
})().catch(e => { console.error(e); process.exit(1); });
