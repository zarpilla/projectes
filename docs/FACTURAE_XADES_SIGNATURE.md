# Firma XAdES-BES para Facturae 3.2.x → FACe

Notas técnicas sobre cómo firmar correctamente el XML Facturae para que FACe
(plataforma @firma del Estado) lo acepte. Implementación en
[api/face-queue/services/sign-facturae.js](../api/face-queue/services/sign-facturae.js).

## Stack

- `xadesjs` 2.6.x (XAdES sobre `xmldsigjs`)
- `@peculiar/webcrypto` (WebCrypto para Node)
- `@xmldom/xmldom` (DOM)
- `node-forge` (extracción de cert + clave desde `.p12`)
- Verificación local: `xmlsec1 --verify --enabled-key-data x509,key-value --insecure file.xml`

## Política de firma aplicada

Política Facturae v3.1 (ver `docs/Politica_Firma_formato_facturae_v3_1.pdf` y la
Guía Rápida AGE v1.8 — sección 5.2):

| Campo | Valor |
| --- | --- |
| `SigPolicyId/Identifier` | `http://www.facturae.es/politica_de_firma_formato_facturae/politica_de_firma_formato_facturae_v3_1.pdf` |
| `SigPolicyId/Description` | `Facturación electrónica con formato Facturae` |
| `SigPolicyHash/DigestMethod` | `http://www.w3.org/2000/09/xmldsig#sha1` |
| `SigPolicyHash/DigestValue` (PDF) | `Ohixl6upD6av8N7pEvDABhEL6hM=` |
| `SigPolicyHash/DigestValue` (XML, alt.) | `T76hEwl/oPYW7o0EdCXjEWki4as=` |
| `SigPolicyQualifiers/SigPolicyQualifier/SPURI` | misma URL del Identifier |

## Estructura de `ds:Signature` requerida

```xml
<ds:Signature Id="Signature-XXXX">
  <ds:SignedInfo>
    <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
    <!-- 1) Documento entero (enveloped) -->
    <ds:Reference Id="Reference-XXXX" URI="">
      <ds:Transforms>
        <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
      </ds:Transforms>
      <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
      <ds:DigestValue>…</ds:DigestValue>
    </ds:Reference>
    <!-- 2) KeyInfo -->
    <ds:Reference URI="#Signature-XXXX-KeyInfo">
      <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
      <ds:DigestValue>…</ds:DigestValue>
    </ds:Reference>
    <!-- 3) SignedProperties -->
    <ds:Reference URI="#Signature-XXXX-SignedProperties" Type="http://uri.etsi.org/01903#SignedProperties">
      <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
      <ds:DigestValue>…</ds:DigestValue>
    </ds:Reference>
  </ds:SignedInfo>
  <ds:SignatureValue>…</ds:SignatureValue>
  <ds:KeyInfo Id="Signature-XXXX-KeyInfo">
    <ds:KeyValue><ds:RSAKeyValue><ds:Modulus/><ds:Exponent/></ds:RSAKeyValue></ds:KeyValue>
    <ds:X509Data><ds:X509Certificate>…</ds:X509Certificate></ds:X509Data>
  </ds:KeyInfo>
  <ds:Object>
    <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#Signature-XXXX">
      <xades:SignedProperties Id="Signature-XXXX-SignedProperties">
        <xades:SignedSignatureProperties>
          <xades:SigningTime>2026-06-03T18:10:32+02:00</xades:SigningTime>
          <xades:SigningCertificate>
            <xades:Cert>
              <xades:CertDigest>
                <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                <ds:DigestValue>…</ds:DigestValue>
              </xades:CertDigest>
              <xades:IssuerSerial>
                <ds:X509IssuerName>CN=AC FNMT Usuarios,OU=Ceres,O=FNMT-RCM,C=ES</ds:X509IssuerName>
                <ds:X509SerialNumber>1398705887…</ds:X509SerialNumber>
              </xades:IssuerSerial>
            </xades:Cert>
          </xades:SigningCertificate>
          <xades:SignaturePolicyIdentifier>
            <xades:SignaturePolicyId>… (ver tabla) …</xades:SignaturePolicyId>
          </xades:SignaturePolicyIdentifier>
          <xades:SignerRole>
            <xades:ClaimedRoles><xades:ClaimedRole>emisor</xades:ClaimedRole></xades:ClaimedRoles>
          </xades:SignerRole>
        </xades:SignedSignatureProperties>
        <xades:SignedDataObjectProperties>
          <xades:DataObjectFormat ObjectReference="#Reference-XXXX">
            <xades:ObjectIdentifier>
              <xades:Identifier Qualifier="OIDAsURN">urn:oid:1.2.840.10003.5.109.10</xades:Identifier>
            </xades:ObjectIdentifier>
            <xades:MimeType>text/xml</xades:MimeType>
            <xades:Encoding>UTF-8</xades:Encoding>
          </xades:DataObjectFormat>
        </xades:SignedDataObjectProperties>
      </xades:SignedProperties>
    </xades:QualifyingProperties>
  </ds:Object>
</ds:Signature>
```

## Requisitos críticos que FACe valida (y que rompen la firma si fallan)

Todos estos puntos fueron necesarios para pasar de `400 "Los datos de la firma
no son correctos"` a `200 Registrada`:

1. **Algoritmos SHA-1** en todo (DigestMethod, SignatureMethod `rsa-sha1`,
   CertDigest, PolicyHash). La política Facturae v3.1 lo exige.
2. **3 `ds:Reference`** dentro de `SignedInfo`:
   - el documento (`URI=""`, transform `enveloped-signature`),
   - `KeyInfo` (`URI="#…-KeyInfo"`),
   - `SignedProperties` (`URI="#…-SignedProperties"`, `Type="http://uri.etsi.org/01903#SignedProperties"`).
3. **`KeyInfo` con `Id`** y la `Reference` con `URI="#…-KeyInfo"` apuntándolo
   (FACe verifica que el certificado va firmado).
4. **`KeyInfo` debe incluir `KeyValue` (RSAKeyValue) Y `X509Data/X509Certificate`**.
5. **`Target` de `QualifyingProperties` y `Id` de `SignedProperties` tienen que
   coincidir con `Signature.Id`** (xadesjs genera IDs aleatorios en el
   constructor; hay que reescribirlos antes del digest).
6. **`SigningTime`**: formato `xs:dateTime` SIN milisegundos y con offset con
   dos puntos: `2026-06-03T18:10:32+02:00`. Nada de `…Z` ni `.123Z` ni
   `+0200` sin dos puntos.
7. **`X509IssuerName` en RFC 4514 MSB-first y sin espacios alrededor de las
   comas**: `CN=AC FNMT Usuarios,OU=Ceres,O=FNMT-RCM,C=ES`.
   xadesjs por defecto emite el formato OpenSSL `C=ES, O=…, CN=…` que FACe
   rechaza. Hay que invertir tokens y unirlos con `,`.
8. **`SignaturePolicyIdentifier` completo**: `Identifier`, `Description` exacto
   (`Facturación electrónica con formato Facturae`), `SigPolicyHash` con el
   digest correcto y `SigPolicyQualifiers/SPURI` con la URL del PDF.
9. **`SignerRole/ClaimedRole`** con uno de `emisor`/`receptor`/`tercero`
   (o equivalentes en inglés).
10. **`SignedDataObjectProperties/DataObjectFormat`** con
    `MimeType=text/xml`, `Encoding=UTF-8` y `ObjectIdentifier`
    `urn:oid:1.2.840.10003.5.109.10` (Qualifier `OIDAsURN`), apuntando con
    `ObjectReference="#…"` a la `Reference` del documento.
11. **Firma `enveloped`**: el elemento `ds:Signature` debe colgar del root
    `<Facturae>` después del resto del contenido.

## Trucos / monkey-patches imprescindibles sobre xadesjs 2.6

xadesjs no expone todo lo necesario por opciones; hay que subclasear
`SignedXml` y reparar el árbol justo después de `super.ApplySignOptions(...)`:

```js
class FacturaeSignedXml extends xadesjs.SignedXml {
  async ApplySignOptions(signature, algorithm, key, options) {
    await super.ApplySignOptions(signature, algorithm, key, options);

    // KeyInfo necesita Id para que la Reference "#…-KeyInfo" resuelva
    if (signature.KeyInfo) signature.KeyInfo.Id = keyInfoId;

    // Sustituir IDs aleatorios por nuestros IDs deterministas
    const qp = this.Properties;
    qp.Target = `#${signature.Id}`;
    qp.SignedProperties.Id = `${signature.Id}-SignedProperties`;

    // RFC 4514 invertido y sin espacios
    const sc = qp.SignedProperties.SignedSignatureProperties.SigningCertificate.Item(0);
    sc.IssuerSerial.X509IssuerName = sc.IssuerSerial.X509IssuerName.split(/,\s*/).reverse().join(',');

    // DataObjectFormat (Facturae no firma sin él)
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
    qp.SignedProperties.SignedDataObjectProperties = sdop;

    // La Reference a SignedProperties la creó super con el viejo Id; corregir
    const refs = signature.SignedInfo.References;
    for (let i = 0; i < refs.Count; i++) {
      const r = refs.Item(i);
      if (r && r.Type && /SignedProperties$/.test(r.Type)) {
        r.Uri = `#${qp.SignedProperties.Id}`;
      }
    }
  }
}
```

Y para que `SigningTime` salga con el formato exacto que acepta FACe, hay que
monkey-patchear el serializador de `XadesDateTime` (el por defecto usa
`toISOString()` → ms + Z, o el token `o` → `+0200` sin dos puntos):

```js
xadesjs.xml.XadesDateTime.prototype.OnGetXml = function (e) {
  const d = this.Value;
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const oh = pad(Math.floor(Math.abs(off) / 60));
  const om = pad(Math.abs(off) % 60);
  e.textContent = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` +
                  `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
                  `${sign}${oh}:${om}`;
};
```

## Inicialización del módulo (Node 18 + xadesjs)

```js
xadesjs.Application.setEngine('NodeJS', new Crypto());
xadesjs.setNodeDependencies({ DOMParser, XMLSerializer });
// xmldsigjs trae su PROPIA copia de xml-core: hay que inicializarla también
const xmldsigXmlCore = require(require.resolve('xml-core', { paths: [require.resolve('xmldsigjs')] }));
xmldsigXmlCore.setNodeDependencies({ DOMParser, XMLSerializer });
```

## Opciones pasadas a `Sign(...)`

```js
await signedXml.Sign(
  { name: 'RSASSA-PKCS1-v1_5' },
  cryptoKey,                          // privada importada en WebCrypto (PKCS8, SHA-1)
  doc,
  {
    id: sigId,                        // "Signature-<timestamp>"
    keyValue: pubKey,                 // pública SPKI (para RSAKeyValue)
    x509: [certBase64],               // cert DER en base64 (sin cabeceras PEM)
    references: [
      { id: refDocId, uri: '', hash: 'SHA-1', transforms: ['enveloped'] },
      { uri: `#${keyInfoId}`, hash: 'SHA-1' },
      // La 3ª (SignedProperties) la añade xadesjs sola
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
    signerRole: { claimed: ['emisor'] },
  }
);
```

## Verificación local

```bash
xmlsec1 --verify --enabled-key-data x509,key-value --insecure /tmp/xades-signed.xml
# Verification status: OK
```

Pasar esta verificación es **necesario pero NO suficiente** — FACe rechaza
firmas válidas a nivel XMLDSig si no cumplen los puntos 5–10 de arriba.

## Confirmación end-to-end

Primer envío exitoso a FACe:

```json
{
  "status": "Registrada",
  "statusHistory": [{ "code": "1200", "name": "Registrada" }],
  "registryCode": "REGAGE26e00000166161"
}
```
