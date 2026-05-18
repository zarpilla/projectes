'use strict';

/**
 * FACe cron job to check invoice status.
 * Runs every 30 minutes to poll FACe for updates on registered invoices.
 */
module.exports = async () => {
  try {
    const me = await strapi.query("me").findOne();
    
    if (!me.face || me.face === "no") {
      return; // FACe not enabled
    }

    // Find invoices that need status checking
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const pendingQueues = await strapi.query("face-queue").find({
      status: "registered",
      _limit: -1,
      _where: {
        _or: [
          { last_status_check_null: true },
          { last_status_check_lt: thirtyMinutesAgo }
        ]
      }
    });

    if (pendingQueues.length === 0) {
      return;
    }

    strapi.log.info(`[CRON] Checking FACe status for ${pendingQueues.length} invoices`);

    const service = strapi.services["face-queue"];

    for (const queue of pendingQueues) {
      if (!queue.registration_number) {
        continue;
      }

      try {
        const statusResult = await service.checkInvoiceStatus({
          registrationNumber: queue.registration_number,
          mode: queue.mode,
          me,
        });

        if (statusResult.success) {
          // Map FACe status to our internal status
          let newStatus = "registered";
          const estado = statusResult.estado || statusResult.codigoEstado;

          if (estado === "REC01" || estado === "delivered" || estado === "entregada") {
            newStatus = "delivered";
          } else if (estado === "REC02" || estado === "rejected" || estado === "rechazada") {
            newStatus = "rejected";
          }

          await strapi.query("face-queue").update(
            { id: queue.id },
            {
              _internal: true,
              status: newStatus,
              response_body: JSON.stringify(statusResult.data, null, 2),
              last_status_check: new Date(),
            }
          );

          strapi.log.info(`[CRON] Updated FACe queue ${queue.id} to status: ${newStatus}`);
        } else {
          strapi.log.warn(`[CRON] Failed to check FACe status for queue ${queue.id}:`, statusResult.error);
        }
      } catch (error) {
        strapi.log.error(`[CRON] Error checking FACe status for queue ${queue.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[CRON] Error in FACe status polling:', error);
  }
};
