# FACe Electronic Invoice Integration

## Overview

Implementation of FACe (Facturación Electrónica) REST API integration for submitting electronic invoices to Spanish public administration entities.

**Status:** ✅ Implementation complete, ⚠️ Provider registration pending

**API Type:** Provider API (Proveedor) - **Requires Integrators Portal Registration**  
**Documentation:** 
- Production: https://api.face.gob.es/providers/doc
- Test: https://se-api.face.gob.es/providers/doc (probable)

**Portals (since Feb 27, 2026):**
- Proveedores (manual): https://proveedores.face.gob.es/
- **Integradores (API - Producción):** https://integradores.face.gob.es/ ✅
- **Integradores (API - Test):** https://se-integradores-face.redsara.es/ ⚠️ (error al subir certificado)

---

## Implementation Details

### Architecture

The integration follows the **verifactu pattern** with certificate-based HTTPS authentication:

```
emitted-invoice (with FACe-enabled contact)
    ↓ (lifecycle hook auto-creates)
face-queue (pending status)
    ↓ (lifecycle hook triggers)
submitInvoiceToFace() → FACe REST API
    ↓
face-queue (registered status + registration_number)
    ↓ (cron job every 30min)
checkInvoiceStatus() → FACe REST API
    ↓
face-queue (delivered/rejected status)
```

### Key Files

**Configuration:**
- [api/me/models/me.settings.json](api/me/models/me.settings.json) - FACe certificate, password, endpoints
- [config/functions/bootstrap.js](config/functions/bootstrap.js) - Startup script to set default endpoints

**Core Logic:**
- [api/face-queue/services/face-queue.js](api/face-queue/services/face-queue.js) - Main service with API calls
- [api/face-queue/models/face-queue.js](api/face-queue/models/face-queue.js) - Lifecycle hooks
- [api/face-queue/controllers/face-queue.js](api/face-queue/controllers/face-queue.js) - Manual status check endpoint

**Data Model:**
- [api/face-queue/models/face-queue.settings.json](api/face-queue/models/face-queue.settings.json) - Queue schema

**Scheduled Tasks:**
- [config/functions/cron.js](config/functions/cron.js) - 30-minute status polling

### Configuration Fields

**In `me` entity:**
- `face` - enum: "no" | "test" | "real" (enable/disable FACe)
- `face_certificate` - file upload (PFX/P12 certificate - **MUST be registered in Integrators portal**)
- `face_certificate_password` - password (certificate passphrase)
- `face_test_endpoint` - string (default: `https://se-api.face.gob.es/providers` - probable, verify with FACe)
- `face_real_endpoint` - string (default: `https://api.face.gob.es/providers`)
- `face_invoice_format` - enum: "ubl" | "facturae" (default: "facturae" - invoice XML format)
- `iban` - string (bank account for PaymentMeans in invoices)

**In `contacts` entity:**
- `face` - boolean (contact requires FACe submission)
- `face_dir3_oc` - string (Oficina Contable DIR3 code)
- `face_dir3_og` - string (Órgano Gestor DIR3 code)
- `face_dir3_ut` - string (Unidad Tramitadora DIR3 code)

**In `face-queue` entity:**
- `emitted_invoice` - relation to invoice
- `mode` - "test" | "real"
- `status` - "pending" | "registered" | "delivered" | "rejected" | "error"
- `registration_number` - FACe tracking number
- `request_body` - XML sent (Facturae 3.2.2 or UBL 2.1 depending on configuration)
- `response_body` - FACe API response
- `last_status_check` - timestamp
- `attempts` - retry counter (max 3)

---

## Current Issue: 403 Forbidden

### Error Description

```
403 Forbidden - You don't have permission to access this resource
```

### Root Cause

The 403 error indicates **certificate authentication is working** (otherwise it would be 401 Unauthorized), but **your organization is not registered as a FACe provider** or lacks API access authorization.

### Why This Happens

FACe requires a **two-step process**:

1. **Technical authentication:** Certificate validation (✅ Working)
2. **Business authorization:** Provider registration + API access approval (❌ Missing)

Even with a valid digital certificate, FACe will reject API requests if your organization hasn't completed the registration process.

---

## Registration Requirements

### Step 1: Register as FACe Provider (Portal Manual)

**Portal:** https://proveedores.face.gob.es/

**Required information:**
- Organization NIF/CIF
- Legal representative details
- Digital certificate
- Contact information

**Process:**
1. Access portal with your digital certificate
2. Navigate to "Alta de Proveedor" (Provider Registration)
3. Complete registration form
4. ✅ **This step you already completed!**

### Step 1.5: Register in Integrators Portal (API Access) **← CRITICAL**

**Portal:** https://integradores.face.gob.es/

**Why needed:** To use the REST API, you MUST register your certificate in the Integrators portal. Being registered as a Provider in the manual portal is NOT enough.

**Process:**
1. Access https://integradores.face.gob.es/ with your digital certificate
2. Look for "Alta de Certificado" or "Gestión de Certificados"
3. Upload/register the SAME certificate (.p12) you'll use for API calls
4. Complete any required forms
5. **No support ticket needed** - you can do this yourself!

**Important:** This is a self-service process since February 27, 2026. You don't need to open a support ticket.

### Step 2: Verify Certificate Registration

Once you've registered your certificate in the Integrators portal, verify:

1. Certificate appears in your "Certificados registrados" list
2. Certificate status is "Activo" (Active)
3. Certificate NIF matches your organization NIF

**If you encounter issues:**
- Check the Ayuda (Help) section in the Integrators portal
- Contact FACe support: **soporte.face@correo.gob.es**
- Mention you're trying to use the Provider REST API

### Step 3: Certificate Authorization

Your digital certificate must be:
- ✅ Issued by a recognized Spanish CA (FNMT, Camerfirma, etc.)
- ✅ Qualified certificate for legal persons
- ✅ Subject NIF matches your organization's NIF
- ✅ Not expired
- ✅ **Explicitly authorized by FACe for API usage**

**Test vs Production:**
- Different certificates may be required
- Test environment may have separate registration
- Verify with FACe support which certificate to use

---

## Verification Steps

### 1. Check Current Configuration

```bash
# Verify certificate file exists
ls -lh public/uploads/certificat*.p12

# Check endpoints in database
# Go to Admin UI → Settings → Me
# Update face_real_endpoint to: https://api.face.gob.es/providers
# For test, consult with FACe support
```

### 2. Test Certificate Loading

After restarting the server, check logs for:
```
[face-queue] Using certificate: /path/to/certificate.p12
[face-queue] Submitting to: https://se-api-face.redsara.es/providers/invoices/submit
[face-queue] Status code: 403
```

### 3. Verify Certificate Details

```bash
# Extract certificate info (requires OpenSSL)
openssl pkcs12 -in certificate.p12 -nokeys -passin pass:YOUR_PASSWORD | openssl x509 -noout -text

# Check:
# - Subject: CN should match your organization name
# - Issuer: Should be a recognized Spanish CA
# - Not Before/Not After: Dates should be valid
```

### 4. Test Endpoint Accessibility

```bash
# Without auth (should work)
curl -v https://api.face.gob.es/providers/doc

# With certificate (requires curl compiled with OpenSSL)
curl -v --cert-type P12 --cert certificate.p12:PASSWORD \
  https://api.face.gob.es/providers/doc
```

---

## Next Steps

### Immediate Actions

1. **✅ Certificate registered in Integrators portal (PRODUCTION)** - COMPLETED!
   - Certificate uploaded at https://integradores.face.gob.es/
   - Platform created
   - **Ready to use production environment**

2. **⚠️ Test Environment Issue**
   - Portal accessible but certificate upload fails: https://se-integradores-face.redsara.es
   - Contact FACe support to resolve (see email template below)
   - **While waiting:** Use DRY-RUN mode to test without sending

3. **Test locally with DRY-RUN mode (No invoices sent)**
   
   **Steps:**
   ```bash
   # 1. Edit .env file
   FACE_DRY_RUN=true
   
   # 2. Restart Strapi
   npm run develop
   
   # 3. Configure in Admin UI → Settings → Me
   face: "test"  # or "real", doesn't matter in dry-run
   
   # 4. Create invoice with FACe-enabled contact (with DIR3 codes)
   
   # 5. Check logs - you'll see the generated XML without submission:
   [face-queue] DRY-RUN MODE: XML generated but not submitted queue=X
   [face-queue] Generated XML:
   <?xml version="1.0" encoding="UTF-8"?>
   <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
   ...
   </Invoice>
   
   # 6. Check face-queue table - status will be "pending" with response:
   # "DRY-RUN: XML generated successfully but not submitted to FACe"
   ```
   
   **Benefits:**
   - ✅ Validates XML generation logic
   - ✅ Checks DIR3 codes are present
   - ✅ Verifies invoice data is correctly formatted
   - ✅ No risk of sending test/real invoices
   - ✅ XML is saved in `face-queue.request_body` for inspection

4. **When ready to send real invoices:**
   ```bash
   # 1. Edit .env file
   FACE_DRY_RUN=false
   
   # 2. Restart Strapi
   
   # 3. Set me.face = "real" in Admin UI
   
   # 4. Create invoice - will be submitted to FACe
   ```

### Once Approved

1. **Test submission:**
   - Create test invoice with FACe-enabled contact
   - Verify auto-creation of face-queue
   - Check logs for successful submission
   - Verify registration_number is populated

2. **Test polling:**
   - Wait 30 minutes for cron job
   - Or call manual endpoint: `GET /face-queues/:id/check-status`
   - Verify status updates to "delivered"

3. **Production rollout:**
   - Switch to production certificate
   - Set `me.face = "real"`
   - Test with real invoice
   - Monitor for 24 hours

---

## Setup Guide for New Installations

### Prerequisites (per installation)

Each ESSTrapis installation needs:
- ✅ Digital certificate (.p12) for the cooperative's NIF
- ✅ Certificate password
- ✅ Valid certificate (not expired, recognized CA)
- ✅ Access to Admin UI

### Step-by-Step Setup (10 minutes)

#### 1. Upload Certificate to Strapi (2 min)

1. Login to Admin UI: `https://your-domain.com/admin`
2. Navigate to: **Settings → Me**
3. Upload fields:
   - `face_certificate`: Upload the .p12 file
   - `face_certificate_password`: Enter password
   - `face`: Select "no" (configure later)
4. Save

#### 2. Register in FACe Integrators Portal (5 min)

**Production:**
1. Go to: https://integradores.face.gob.es/
2. Login with the cooperative's digital certificate
3. Navigate to: **Plataformas → Nueva Plataforma**
4. Fill form:
   - **Nombre**: `ESSTrapis - [CooperativeName]`
   - **Certificado**: Upload the same .p12 file
   - **Servicio de envío**: ✅ Sí
   - **Servicio de recepción/RCF**: ❌ No
   - **Servicio a terceros**: ❌ No (unless managing multiple cooperatives)
5. Submit
6. Verify certificate status shows as **"Activo"**

**Test (if available):**
1. Go to: https://se-integradores-face.redsara.es/
2. Follow same steps as production
3. *Note: Currently has certificate upload issues - contact soporte.face@correo.gob.es if needed*

#### 3. Configure Endpoints in Strapi (1 min)

Back in Admin UI → Settings → Me:
```
face_real_endpoint: https://api.face.gob.es/providers
face_test_endpoint: https://se-api.face.gob.es/providers (if test available)
```

These should be set automatically by bootstrap script, but verify.

#### 4. Enable FACe (1 min)

In Admin UI → Settings → Me:
- `face`: Change from "no" to "real" (or "test" if testing)
- Save

#### 5. Configure Contacts with DIR3 Codes (1 min)

For each public entity contact:
1. Edit contact in Admin UI
2. Set:
   - `face`: ✅ true
   - `face_dir3_oc`: [OC code from entity]
   - `face_dir3_og`: [OG code from entity]
   - `face_dir3_ut`: [UT code from entity]
3. Get codes from: https://dir3.redsara.es/directorio/

#### 6. Verify Setup (Recommended)

**Run setup verification command:**
```bash
# Call verification endpoint
curl http://localhost:1337/face-queues/verify-setup

# Or in browser (if logged in)
http://localhost:1337/face-queues/verify-setup
```

**Example successful response:**
```json
{
  "overall": true,
  "details": {
    "face_enabled": {
      "status": true,
      "value": "real",
      "message": "✅ FACe is enabled"
    },
    "certificate": {
      "status": true,
      "value": "certificate.p12",
      "message": "✅ Certificate uploaded"
    },
    "certificate_password": {
      "status": true,
      "value": "[configured]",
      "message": "✅ Certificate password configured"
    },
    "endpoints": {
      "status": true,
      "value": {
        "test": null,
        "real": "https://api.face.gob.es/providers"
      },
      "message": "✅ Production endpoint configured"
    },
    "certificate_file": {
      "status": true,
      "value": "/path/to/certificate.p12",
      "message": "✅ Certificate file exists on disk"
    },
    "organization_nif": {
      "status": true,
      "value": "B12345678",
      "message": "✅ Organization NIF configured"
    },
    "face_contacts": {
      "status": true,
      "value": {
        "total": 3,
        "with_dir3": 2
      },
      "message": "✅ 2 contact(s) with FACe and DIR3 codes"
    },
    "dry_run_mode": {
      "status": true,
      "value": "false",
      "message": "✅ DRY-RUN mode disabled (invoices will be sent)"
    }
  },
  "summary": {
    "ready_for_production": true,
    "ready_for_testing": false,
    "missing_steps": []
  }
}
```

**If there are issues, you'll see:**
```json
{
  "overall": false,
  "summary": {
    "ready_for_production": false,
    "missing_steps": ["certificate", "certificate_password"]
  }
}
```

Fix the missing steps and run verification again.

**Alternative: DRY-RUN test**
```bash
# 1. Edit .env
FACE_DRY_RUN=true

# 2. Restart Strapi
npm run develop

# 3. Create test invoice with FACe-enabled contact
# 4. Check logs - should see generated XML
# 5. Disable DRY-RUN when ready
```

**Option B: Real submission**
- Create invoice for FACe-enabled contact
- Check logs for successful submission
- Verify `face-queue` has `status = "registered"` and `registration_number`

### Checklist for New Installation

```
Installation: _________________________
Date: _____________

Setup Steps:
□ Certificate obtained from CA (FNMT/Camerfirma)
□ Certificate uploaded to Strapi Admin UI
□ Password configured in Strapi
□ Platform registered at integradores.face.gob.es
□ Certificate status "Activo" in portal
□ Endpoints configured in Strapi (check bootstrap logs)
□ face = "real" enabled in Strapi
□ At least one contact configured with DIR3 codes

Verification:
□ Run GET /face-queues/verify-setup - all checks pass
□ Test invoice created (DRY-RUN or real)
□ Check logs for successful processing
□ If real: Registration number received from FACe

Notes:
_____________________________________________
_____________________________________________
```

### Troubleshooting New Setup

**Certificate not found in Strapi**
- Check file is in `public/uploads/`
- Verify upload was successful (check file size > 0)
- Check logs for certificate path

**403 Forbidden from FACe**
- Wait 5-10 minutes after registering in portal
- Verify certificate is "Activo" in integradores portal
- Confirm NIF in certificate matches `me.nif`
- Ensure platform has "Servicio de envío" enabled

**Missing DIR3 codes**
- Contact will show error in face-queue
- Get codes from public entity directly
- Verify codes at: https://dir3.redsara.es/directorio/
- Update contact with all three codes (OC, OG, UT)

---

## Testing Without Sending (DRY-RUN Mode)

### Enable DRY-RUN Mode

Edit `.env` file:
```bash
FACE_DRY_RUN=true
```

Restart Strapi:
```bash
npm run develop
```

### How It Works

1. **Create invoice** with FACe-enabled contact (must have DIR3 codes)
2. **XML is generated** following Facturae 3.2.2 or UBL 2.1 standard (configurable via `face_invoice_format`)
3. **No submission** to FACe API - just validation
4. **Check logs** to see generated XML:
   ```
   [face-queue] DRY-RUN MODE: XML generated but not submitted queue=X
   [face-queue] Generated XML:
   <?xml version="1.0" encoding="UTF-8"?>
   <Facturae xmlns="http://facturae.es"> or <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
   ...
   ```
5. **XML saved** in database: `face-queue.request_body`

### Manual Validation (Optional)

**Export XML from database:**
```sql
SELECT request_body FROM face_queues ORDER BY created_at DESC LIMIT 1;
```

**Save to file:**
```bash
# Copy XML content to file
nano invoice.xml
# Paste XML, save

# Or query directly
mysql -u user -p database -e "SELECT request_body FROM face_queues ORDER BY created_at DESC LIMIT 1" > invoice.xml
```

**Upload manually to FACe portal:**
1. Go to https://proveedores.face.gob.es/ (production) or test portal
2. Navigate to "Remitir Factura" or similar
3. Upload `invoice.xml`
4. FACe will validate the XML structure
5. If accepted, you know your XML generation is correct ✅

**Benefits:**
- Validates XML without API integration
- Confirms DIR3 codes are correct
- Verifies invoice data format
- No risk of accidental submissions

### When Ready for Real Submissions

```bash
# 1. Disable DRY-RUN in .env
FACE_DRY_RUN=false

# 2. Restart Strapi
npm run develop

# 3. For production: Set me.face = "real" in Admin UI

# 4. Create invoice - will be submitted automatically
```

---

## Troubleshooting

### Common Issues

**403 Forbidden**
- ✅ **Certificate registered in production** - You've completed this step!
- ❌ Certificate not active → Check status in https://integradores.face.gob.es/
- ❌ Wrong certificate → Ensure you're using the same .p12 file registered in portal
- ❌ Wrong endpoint URL → Production: https://api.face.gob.es/providers

**Test Environment Issues**
- Portal accessible but certificate upload fails: https://se-integradores-face.redsara.es
- This is a known issue - contact FACe support (see template below)
- **Solution while waiting:** Use DRY-RUN mode (FACE_DRY_RUN=true in .env)
- Test endpoint (probable): https://se-api.face.gob.es/providers

**DRY-RUN Mode**
- Set `FACE_DRY_RUN=true` in .env file
- Generates XML without submitting to FACe
- Perfect for testing before production
- XML saved in face-queue.request_body for inspection
- Can be uploaded manually to FACe portal for validation

**Certificate not found**
- Check file path in logs
- Verify uploads directory structure
- Ensure file was uploaded correctly

**Invalid DIR3 codes**
- All three codes (OC, OG, UT) are mandatory
- Codes must exist in DIR3 registry
- Contact the public entity for their codes

**Timeout errors**
- FACe API can be slow
- Current timeout: 30 seconds (should be sufficient)
- Check network connectivity

### Debug Mode

Enhanced logging is already enabled. Check logs for:
```
[face-queue] Using certificate: ...
[face-queue] Submitting to: ...
[face-queue] Status code: ...
[face-queue] Headers: ...
```

---

## API Endpoints Used

### Submit Invoice
```
POST {endpoint}/invoices/submit
Content-Type: multipart/form-data

Fields:
- facturae: Facturae 3.2.2 or UBL 2.1 XML file (depends on face_invoice_format setting)
- nif: Provider NIF
- dir3_oc: Oficina Contable code
- dir3_og: Órgano Gestor code  
- dir3_ut: Unidad Tramitadora code

Response:
{
  "numero_registro": "202600001-ABC123",
  "estado": "registered"
}
```

### Check Status
```
GET {endpoint}/invoices/{registrationNumber}/status

Response:
{
  "estado": "REC01",           // or REC02 for rejected
  "codigo_estado": "...",
  "motivo_rechazo": "..."      // if rejected
}
```

**Status codes:**
- `REC01` - Delivered (entregada)
- `REC02` - Rejected (rechazada)

---

## Manual Operations

### Verify Installation Setup
```http
GET /face-queues/verify-setup
```

Returns comprehensive check of FACe configuration:
```json
{
  "overall": true/false,
  "details": {
    "face_enabled": { "status": true, "message": "✅ FACe is enabled" },
    "certificate": { "status": true, "message": "✅ Certificate uploaded" },
    "certificate_password": { "status": true, "message": "✅ Password configured" },
    "endpoints": { "status": true, "value": {...} },
    "certificate_file": { "status": true, "message": "✅ File exists" },
    "organization_nif": { "status": true, "value": "B12345678" },
    "face_contacts": { "status": true, "value": { "with_dir3": 2 } },
    "dry_run_mode": { "status": true, "value": "false" }
  },
  "summary": {
    "ready_for_production": true,
    "ready_for_testing": false,
    "missing_steps": []
  }
}
```

**Use cases:**
- ✅ Verify new installation setup
- ✅ Troubleshoot configuration issues  
- ✅ Check before enabling production mode
- ✅ Documentation/audit trail

### Check Status Manually
```http
GET /face-queues/:id/check-status
```

Returns:
```json
{
  "success": true,
  "status": "delivered",
  "estado": "REC01",
  "codigoEstado": "...",
  "data": { ... }
}
```

### Create Queue Manually
```http
POST /face-queues
{
  "emitted_invoice": 123,
  "mode": "test"
}
```

The lifecycle hook will automatically trigger submission.

---

## Resources

**FACe Support Email Template (Test Environment Issue):**

```
Para: soporte.face@correo.gob.es
Asunto: Error al subir certificado en portal de test de Integradores

Estimados señores,

Estoy intentando configurar el acceso a la API REST de Proveedores en el 
entorno de test para realizar pruebas antes de pasar a producción.

Situación:
- Puedo acceder a https://se-integradores-face.redsara.es/ con mi certificado
- Al intentar subir el certificado para registrarlo, me da un error genérico
- En el portal de producción (https://integradores.face.gob.es/) funciona 
  correctamente y ya tengo el certificado registrado

Datos:
- NIF: [TU_NIF]
- Organización: [TU_NOMBRE_EMPRESA]
- Ya estoy dado de alta como proveedor en el entorno de test
- Necesito registrar mi certificado para poder usar la API de test

¿Pueden indicarme cómo resolver este problema o si hay alguna alternativa 
para realizar pruebas antes de pasar a producción?

Gracias,
[TU_NOMBRE]
[TU_EMAIL]
[TU_TELEFONO]
```

**Official Documentation:**
- Provider API Manual: `FACe - Manual de API de Proveedores-1.pdf`
- Integrator API Manual: `FACe - Manual de uso del API Integradores-1.pdf`

**Support:**
- Email: soporte.face@correo.gob.es
- Phone: 91 xxx xx xx (check FACe portal)

**Portals (since Feb 27, 2026):**
- Proveedores (manual): https://proveedores.face.gob.es/
- **Integradores (API - register here!):** https://integradores.face.gob.es/
- Organismos (public entities): https://organismos.face.gob.es/
- API Docs: https://api.face.gob.es/providers/doc

**DIR3 Registry:**
- Search: https://dir3.redsara.es/directorio/
- Verify customer DIR3 codes before invoicing

---

## Implementation Checklist

- [x] Database schema created
- [x] Certificate authentication implemented
- [x] Facturae 3.2.2 XML generation (default)
- [x] UBL 2.1 XML generation (alternative)
- [x] DIR3 validation
- [x] REST API client (submit + check status)
- [x] Lifecycle hooks for auto-submission
- [x] Retry logic (max 3 attempts)
- [x] Cron job for status polling
- [x] Manual status check endpoint
- [x] Configuration UI via admin panel
- [x] Startup script for defaults
- [ ] **FACe provider registration** (pending)
- [ ] **API access approval** (pending)
- [ ] Test environment validation
- [ ] Production deployment

---

**Last Updated:** May 13, 2026  
**Status:** Implementation complete, awaiting FACe registration approval
