"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async findBasic(ctx) {
    return await strapi
      .query("received-invoice")
      .find(ctx.query, ["contact", "projects", "document_type"]);
  },

  /**
   * POST /received-invoices/upload
   *
   * Thin proxy to the standalone invoice-parser service (see
   * projectes/invoice-parser). Reads the uploaded PDF from the request and
   * forwards the raw buffer to `${invoice_parser_api_url}/api/parse`, passing
   * the service's JSON response back to the client unchanged.
   *
   * The URL and auth token are configured on the `me` model
   * (`invoice_parser_api_url` / `invoice_parser_api_token`), the same pattern
   * used for the `dir3` service.
   */
  async upload(ctx) {
    let pdfBuffer = null;

    try {
      // 1) Resolve the uploaded PDF into a Buffer.
      pdfBuffer = await readUploadedPdfBuffer(ctx);

      if (!pdfBuffer || !pdfBuffer.length) {
        return ctx.badRequest("No PDF file was provided.");
      }

      // 2) Load the invoice-parser service configuration from the `me` model.
      const meSettings = await strapi.query("me").findOne();

      if (
        !meSettings ||
        !meSettings.invoice_parser_api_url ||
        !meSettings.invoice_parser_api_token
      ) {
        return ctx.badRequest("Invoice parser API is not configured");
      }

      // 3) Forward the PDF buffer to the standalone parser service.
      //
      // The parser expects multipart/form-data with a `file` field (it uses
      // multer's upload.single('file')). Sending the buffer as a raw
      // application/pdf body leaves req.file undefined on that side, so we wrap
      // it in FormData so multer can parse it.
      const baseUrl = meSettings.invoice_parser_api_url.replace(/\/+$/, "");
      const form = new FormData();
      form.append("file", pdfBuffer, { filename: "invoice.pdf", contentType: "application/pdf" });

      const response = await axios.post(`${baseUrl}/api/parse`, form, {
        headers: {
          "X-API-Key": meSettings.invoice_parser_api_token,
          ...form.getHeaders()
        },
        // PDFs can exceed axios' default 10MB JSON cap, and the parsed JSON
        // response can be larger than the default too.
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        responseType: "json",
        // LLM extraction can take a while.
        timeout: 120000
      });

      // 4) Pass the service's JSON body through to the client unchanged.
      return ctx.send(response.data);
    } catch (error) {
      strapi.log.error("received-invoice/upload error: %s", error.message);

      // If the parser service rejected the request, mirror its status + body.
      if (error.response) {
        const status = error.response.status;
        const body = error.response.data;
        return ctx.send(body, status);
      }

      return ctx.internalServerError(
        error.message || "Failed to process the invoice PDF."
      );
    }
  },
};

/**
 * Reads the uploaded PDF from the request, supporting several upload formats:
 *   - multipart/form-data with fields `file` or `files` (Strapi v3 / koa-body)
 *   - raw binary request body
 *
 * Returns the PDF contents as a Buffer, or null if nothing was uploaded.
 */
async function readUploadedPdfBuffer(ctx) {
  // multipart/form-data parsed by koa-body -> ctx.request.files
  const files = ctx.request && ctx.request.files;
  if (files) {
    // koa-body exposes an object: { [fieldname]: file | file[] }
    const candidates = [];
    Object.keys(files).forEach((key) => {
      const value = files[key];
      if (Array.isArray(value)) {
        candidates.push(...value);
      } else {
        candidates.push(value);
      }
    });

    // Prefer PDF files; otherwise take the first file.
    let file = candidates.find((f) => isPdf(f)) || candidates[0];
    if (file && file.path) {
      const buffer = fs.readFileSync(file.path);
      cleanupTempFile(file.path);
      return buffer;
    }
  }

  // Fallback: raw binary body (Content-Type: application/pdf or similar).
  if (ctx.request && ctx.request.body && Buffer.isBuffer(ctx.request.body)) {
    return ctx.request.body;
  }

  // Some setups expose the raw body on `ctx.req` (the Node.js request).
  if (ctx.req && Buffer.isBuffer(ctx.req.body)) {
    return ctx.req.body;
  }

  return null;
}

function isPdf(file) {
  if (!file) return false;
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return name.endsWith(".pdf") || type === "application/pdf";
}

function cleanupTempFile(filePath) {
  try {
    // Only remove files that koa-body wrote to the OS temp directory.
    if (filePath && filePath.startsWith(os.tmpdir())) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    // Ignore cleanup errors.
  }
}
