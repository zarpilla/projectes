'use strict';

/**
 * FACe cron job to retry pending submissions.
 * Runs every 5 minutes and retries face-queue entries that failed to submit
 * (status="pending" with attempts > 0 and a signed request_body already stored).
 * Reuses the already-signed XML so it does not regenerate or re-sign.
 * Max 10 attempts per queue entry — after that it transitions to "error".
 */
module.exports = async () => {
  try {
    const me = await strapi.query("me").findOne({}, ["face_certificate"]);

    if (!me || !me.face || me.face === "no") {
      return; // FACe not enabled
    }

    const maxAttempts = 10;
    const minBackoffMs = 2 * 60 * 1000; // wait at least 2 minutes between retries
    const backoffCutoff = new Date(Date.now() - minBackoffMs);

    const pendingQueues = await strapi.query("face-queue").find({
      status: "pending",
      attempts_gt: 0,
      attempts_lt: maxAttempts,
      request_body_null: false,
      updated_at_lt: backoffCutoff,
      _limit: 50,
    });

    if (!pendingQueues || pendingQueues.length === 0) {
      return;
    }

    strapi.log.info(`[CRON] Retrying ${pendingQueues.length} pending FACe submissions`);

    const service = strapi.services["face-queue"];

    for (const queue of pendingQueues) {
      if (!queue.request_body) {
        continue;
      }

      try {
        const submitResult = await service.submitInvoiceToFace({
          xml: queue.request_body,
          nif: me.nif,
          mode: queue.mode,
          me,
        });

        if (submitResult.success) {
          await strapi.query("face-queue").update(
            { id: queue.id },
            {
              _internal: true,
              registration_number: submitResult.registrationNumber,
              response_body: JSON.stringify(submitResult.data, null, 2),
              response_code: submitResult.statusCode,
              status: "registered",
              last_status_check: new Date(),
              attempts: 0,
            }
          );
          strapi.log.info(
            `[CRON] Retry succeeded queue=${queue.id} registration=${submitResult.registrationNumber}`
          );
        } else {
          const attempts = (queue.attempts || 0) + 1;
          await strapi.query("face-queue").update(
            { id: queue.id },
            {
              _internal: true,
              response_body: JSON.stringify(submitResult.error || submitResult.data, null, 2),
              response_code: submitResult.statusCode,
              status: attempts >= maxAttempts ? "error" : "pending",
              attempts,
            }
          );
          strapi.log.warn(
            `[CRON] Retry failed queue=${queue.id} attempts=${attempts}/${maxAttempts} statusCode=${submitResult.statusCode}`
          );
        }
      } catch (error) {
        strapi.log.error(`[CRON] Unexpected error retrying queue=${queue.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[CRON] Error in FACe retry-pending job:', error);
  }
};
