// Build a template XML with empty digests and signature value, let xmlsec1 sign it
const fs = require('fs');
const forge = require('node-forge');
const { execSync } = require('child_process');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<facturae:Facturae xmlns:facturae="http://www.facturae.es/Facturae/2009/v3.2/Facturae">
<FileHeader><SchemaVersion>3.2</SchemaVersion><Modality>I</Modality><InvoiceIssuerType>EM</InvoiceIssuerType><Batch><BatchIdentifier>TEST001</BatchIdentifier><InvoicesCount>1</InvoicesCount><TotalInvoicesAmount><TotalAmount>1.21</TotalAmount></TotalInvoicesAmount><TotalOutstandingAmount><TotalAmount>1.21</TotalAmount></TotalOutstandingAmount><TotalExecutableAmount><TotalAmount>1.21</TotalAmount></TotalExecutableAmount><InvoiceCurrencyCode>EUR</InvoiceCurrencyCode></Batch></FileHeader>
<Parties><SellerParty><TaxIdentification><PersonTypeCode>F</PersonTypeCode><ResidenceTypeCode>R</ResidenceTypeCode><TaxIdentificationNumber>39891236J</TaxIdentificationNumber></TaxIdentification><Individual><Name>Jordi</Name><FirstSurname>Sabate</FirstSurname><AddressInSpain><Address>Test</Address><PostCode>08001</PostCode><Town>Barcelona</Town><Province>Barcelona</Province><CountryCode>ESP</CountryCode></AddressInSpain></Individual></SellerParty></Parties>
</facturae:Facturae>`;

const p12Path = '/home/jordi/Documents/work/webcoop/projectes/projectes/public/uploads/SABATE_ESTOPA_JORDI_39891236_J_bad1cd15b4.p12';
const p12Pass = 'Zarpilla01*';

// Load cert to compute CertDigest and IssuerSerial (needed in SignedProperties BEFORE signing)
const p12Buffer = fs.readFileSync(p12Path);
const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, p12Pass);
const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
const certificate = certBags[forge.pki.oids.certBag][0].cert;
const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
const certBase64 = forge.util.encode64(certDer).match(/.{1,64}/g).join('\n');
const certDigest = forge.util.encode64(forge.md.sha1.create().update(certDer).digest().getBytes());
const issuerAttrs = certificate.issuer.attributes.slice().reverse();
const issuerName = issuerAttrs.map(a => `${a.shortName || a.type}=${a.value}`).join(',');
const serialNumber = BigInt('0x' + certificate.serialNumber).toString(10);
const rsaPublicKey = certificate.publicKey;
const modulusHex = rsaPublicKey.n.toString(16);
const modulusBase64 = forge.util.encode64(forge.util.hexToBytes(modulusHex.length % 2 ? '0' + modulusHex : modulusHex)).match(/.{1,64}/g).join('\n');
const exponentHex = rsaPublicKey.e.toString(16);
const exponentBase64 = forge.util.encode64(forge.util.hexToBytes(exponentHex.length % 2 ? '0' + exponentHex : exponentHex));

const ts = Date.now();
const sigId = `Signature-${ts}-Signature`;
const siId = `Signature-${ts}-SignedInfo`;
const spId = `Signature-${ts}-SignedProperties`;
const qpId = `Signature-${ts}-QualifyingProperties`;
const kiId = `Signature-${ts}-KeyInfo`;
const svId = `Signature-${ts}-SignatureValue`;
const refId = `Reference-${ts}`;
const signingTime = new Date().toISOString();

const sig = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${sigId}">` +
  `<ds:SignedInfo Id="${siId}">` +
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<ds:Reference Id="${refId}" URI="">` +
      `<ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></ds:Transforms>` +
      `<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
      `<ds:DigestValue></ds:DigestValue>` +
    `</ds:Reference>` +
    `<ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#${spId}">` +
      `<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
      `<ds:DigestValue></ds:DigestValue>` +
    `</ds:Reference>` +
    `<ds:Reference URI="#${kiId}">` +
      `<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
      `<ds:DigestValue></ds:DigestValue>` +
    `</ds:Reference>` +
  `</ds:SignedInfo>` +
  `<ds:SignatureValue Id="${svId}"></ds:SignatureValue>` +
  `<ds:KeyInfo Id="${kiId}">` +
    `<ds:KeyValue><ds:RSAKeyValue><ds:Modulus>${modulusBase64}</ds:Modulus><ds:Exponent>${exponentBase64}</ds:Exponent></ds:RSAKeyValue></ds:KeyValue>` +
    `<ds:X509Data><ds:X509Certificate>${certBase64}</ds:X509Certificate></ds:X509Data>` +
  `</ds:KeyInfo>` +
  `<ds:Object>` +
    `<xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="${qpId}" Target="#${sigId}">` +
      `<xades:SignedProperties Id="${spId}">` +
        `<xades:SignedSignatureProperties>` +
          `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
          `<xades:SigningCertificate><xades:Cert>` +
            `<xades:CertDigest><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>${certDigest}</ds:DigestValue></xades:CertDigest>` +
            `<xades:IssuerSerial><ds:X509IssuerName>${issuerName}</ds:X509IssuerName><ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber></xades:IssuerSerial>` +
          `</xades:Cert></xades:SigningCertificate>` +
          `<xades:SignaturePolicyIdentifier><xades:SignaturePolicyId>` +
            `<xades:SigPolicyId><xades:Identifier>http://www.facturae.es/politica_de_firma_formato_facturae/politica_de_firma_formato_facturae_v3_1.pdf</xades:Identifier><xades:Description>facturae31</xades:Description></xades:SigPolicyId>` +
            `<xades:SigPolicyHash><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>Ohixl6upD6av8N7pEvDABhEL6hM=</ds:DigestValue></xades:SigPolicyHash>` +
          `</xades:SignaturePolicyId></xades:SignaturePolicyIdentifier>` +
          `<xades:SignerRole><xades:ClaimedRoles><xades:ClaimedRole>emisor</xades:ClaimedRole></xades:ClaimedRoles></xades:SignerRole>` +
        `</xades:SignedSignatureProperties>` +
        `<xades:SignedDataObjectProperties>` +
          `<xades:DataObjectFormat ObjectReference="#${refId}"><xades:Description></xades:Description><xades:ObjectIdentifier><xades:Identifier Qualifier="OIDAsURN">urn:oid:1.2.840.10003.5.109.10</xades:Identifier><xades:Description></xades:Description></xades:ObjectIdentifier><xades:MimeType>text/xml</xades:MimeType><xades:Encoding>UTF-8</xades:Encoding></xades:DataObjectFormat>` +
        `</xades:SignedDataObjectProperties>` +
      `</xades:SignedProperties>` +
    `</xades:QualifyingProperties>` +
  `</ds:Object>` +
`</ds:Signature>`;

const fullXml = xml.replace('</facturae:Facturae>', sig + '</facturae:Facturae>');
fs.writeFileSync('/tmp/template.xml', fullXml);

// Sign with xmlsec1
const cmd = `xmlsec1 --sign --pkcs12 ${p12Path} --pwd '${p12Pass}' --id-attr:Id http://uri.etsi.org/01903/v1.3.2\\#:SignedProperties --id-attr:Id http://www.w3.org/2000/09/xmldsig\\#:KeyInfo --output /tmp/test-xmlsec-signed.xml /tmp/template.xml`;
console.log('CMD:', cmd);
try {
  const out = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
  console.log(out);
  console.log('OK - signed file at /tmp/test-xmlsec-signed.xml');
} catch (e) {
  console.error('STDOUT:', e.stdout);
  console.error('STDERR:', e.stderr);
}
