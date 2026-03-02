'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const startFaceProcess = async (queueItem) => {
	const service = strapi.services["face-queue"];
	if (!service || typeof service.startFaceProcess !== "function") {
		return;
	}

	await service.startFaceProcess(queueItem);
};

const processingQueueIds = new Set();
const internalUpdateQueueIds = new Set();

const runOncePerQueue = async (queueItem) => {
	if (!queueItem || !queueItem.id) {
		return;
	}

	if (processingQueueIds.has(queueItem.id)) {
		return;
	}

	processingQueueIds.add(queueItem.id);
	try {
		await startFaceProcess(queueItem);
	} finally {
		processingQueueIds.delete(queueItem.id);
	}
};

module.exports = {
	lifecycles: {
		async afterCreate(result) {
			strapi.log.info(`[face-queue] afterCreate id=${result && result.id}`);
			await runOncePerQueue(result);
		},
		async beforeUpdate(params, data) {
			const queueId = params && params.id ? Number(params.id) : null;
			if (queueId && data && data._internal === true) {
				internalUpdateQueueIds.add(queueId);
				strapi.log.info(`[face-queue] beforeUpdate internal id=${queueId}`);
				delete data._internal;
			}
		},
		async afterUpdate(result, params, data) {
			const queueId = result && result.id ? Number(result.id) : null;

			if (queueId && internalUpdateQueueIds.has(queueId)) {
				internalUpdateQueueIds.delete(queueId);
				strapi.log.info(`[face-queue] afterUpdate skip internal id=${queueId}`);
				return;
			}

			if (data && data._internal === true) {
				strapi.log.info(`[face-queue] afterUpdate skip data._internal id=${queueId || "-"}`);
				return;
			}

			if (!result || result.status !== "pending") {
				strapi.log.info(
					`[face-queue] afterUpdate skip status id=${queueId || "-"} status=${
						result && result.status ? result.status : "-"
					}`
				);
				return;
			}

			strapi.log.info(`[face-queue] afterUpdate processing id=${queueId}`);
			await runOncePerQueue(result);
		},
	},
};
