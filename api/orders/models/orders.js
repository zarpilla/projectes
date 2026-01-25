("use strict");
const _ = require("lodash");
const moment = require("moment");

// --- VOLUME DISCOUNT LOGIC ---
const checkVolumeDiscount = async (
  id,
  date,
  routeId,
  ownerId,
  currentStatus
) => {
  // Find all orders for the same route, date, and owner (excluding cancelled and this order)
  const ordersOfDateRouteOwner = await strapi.query("orders").find({
    estimated_delivery_date: moment(date).format("YYYY-MM-DD"),
    route: routeId,
    owner: ownerId,
    _limit: -1,
  });

  const others = ordersOfDateRouteOwner.filter(
    (o) => o.id.toString() !== id.toString() && o.status !== "cancelled"
  );

  // Get the route entity for discount config
  let route = null;
  if (routeId) {
    route = await strapi.query("route").findOne({ id: routeId });
  }

  let discount = 0;
  let eligible = false;
  if (
    route &&
    route.volume_discount_number_of_orders > 0 &&
    route.volume_discount_price > 0
  ) {
    // Count current + others (if not cancelled)
    const count =
      (currentStatus !== "cancelled" ? 1 : 0) +
      others.filter((o) => o.status !== "cancelled").length;
    if (count >= route.volume_discount_number_of_orders) {
      discount = route.volume_discount_price;
      eligible = true;
    }
  }
  return {
    others,
    eligible,
    discount,
  };
};

const updateVolumeDiscountForOrders = async (orders, discount) => {
  for await (const order of orders) {
    if (order.volume_discount !== discount) {
      await strapi
        .query("orders")
        .update(
          { id: order.id },
          { volume_discount: discount, _internal: true }
        );
    }
  }
};

const processVolumeDiscountForCurrentOrder = async (orderId, data) => {
  if (data._internal) return;
  
  // Skip if order is invoiced or delivered
  if (data.status === "invoiced" || data.status === "delivered") {
    return;
  }
  
  // Only if route, owner, and date are present
  if (!data.route || !data.owner || !data.estimated_delivery_date) return;
  const routeId = data.route.id ? data.route.id : data.route;
  const ownerId = data.owner.id ? data.owner.id : data.owner;
  const { eligible, discount } = await checkVolumeDiscount(
    orderId,
    data.estimated_delivery_date,
    routeId,
    ownerId,
    data.status
  );
  if (eligible) {
    data.volume_discount = discount;
  } else {
    data.volume_discount = 0;
  }
};

const processVolumeDiscountForOtherOrders = async (
  orderId,
  currentData,
  previousOrder = null
) => {
  if (currentData._internal) return;
  
  // Skip if order is invoiced or delivered
  if (currentData.status === "invoiced" || currentData.status === "delivered") {
    return;
  }
  
  if (
    !currentData.route ||
    !currentData.owner ||
    !currentData.estimated_delivery_date
  )
    return;
  const routeId = currentData.route.id
    ? currentData.route.id
    : currentData.route;
  const ownerId = currentData.owner.id
    ? currentData.owner.id
    : currentData.owner;
  const { eligible, discount, others } = await checkVolumeDiscount(
    orderId,
    currentData.estimated_delivery_date,
    routeId,
    ownerId,
    currentData.status
  );
  if (eligible && others.length > 0) {
    await updateVolumeDiscountForOrders(others, discount);
  } else if (!eligible && others.length > 0) {
    // Remove discount from others if not eligible
    for await (const order of others) {
      if (order.volume_discount > 0) {
        await strapi
          .query("orders")
          .update({ id: order.id }, { volume_discount: 0, _internal: true });
      }
    }
  }
  // If previousOrder exists and key fields changed, update previous group
  if (previousOrder && orderId !== 0) {
    const dateChanged =
      previousOrder.estimated_delivery_date !==
      currentData.estimated_delivery_date;
    const routeChanged =
      (previousOrder.route?.id || previousOrder.route) !==
      (currentData.route?.id || currentData.route);
    const ownerChanged =
      (previousOrder.owner?.id || previousOrder.owner) !==
      (currentData.owner?.id || currentData.owner);
    const statusChanged = previousOrder.status !== currentData.status;
    if (dateChanged || routeChanged || ownerChanged || statusChanged) {
      if (dateChanged || routeChanged || ownerChanged) {
        // Check previous group
        const prevRouteId = previousOrder.route?.id || previousOrder.route;
        const prevOwnerId = previousOrder.owner?.id || previousOrder.owner;
        const prevGroup = await checkVolumeDiscount(
          orderId,
          previousOrder.estimated_delivery_date,
          prevRouteId,
          prevOwnerId,
          "active"
        );
        if (prevGroup.others.length > 0) {
          const count = prevGroup.others.length;
          const prevRoute = await strapi
            .query("route")
            .findOne({ id: prevRouteId });
          if (
            prevRoute &&
            prevRoute.volume_discount_number_of_orders > 0 &&
            prevRoute.volume_discount_price > 0 &&
            count < prevRoute.volume_discount_number_of_orders
          ) {
            // Remove discount from previous group
            for await (const order of prevGroup.others) {
              if (order.volume_discount > 0) {
                await strapi
                  .query("orders")
                  .update(
                    { id: order.id },
                    { volume_discount: 0, _internal: true }
                  );
              }
            }
          } else if (
            prevRoute &&
            prevRoute.volume_discount_number_of_orders > 0 &&
            prevRoute.volume_discount_price > 0 &&
            count >= prevRoute.volume_discount_number_of_orders
          ) {
            await updateVolumeDiscountForOrders(
              prevGroup.others,
              prevRoute.volume_discount_price
            );
          }
        }
      }
    }
  }
};

const checkMultidelivery = async (id, date, contactId, currentStatus) => {
  const ordersOfDateAndContact = await strapi.query("orders").find({
    estimated_delivery_date: moment(date).format("YYYY-MM-DD"),
    contact: contactId,
    _limit: -1,
  });

  const others = ordersOfDateAndContact.filter(
    (o) => o.id.toString() !== id.toString() && o.status !== "cancelled"
  );

  return {
    others,
    multidelivery:
      (currentStatus === "cancelled" && others.length > 1) ||
      (currentStatus !== "cancelled" && others.length > 0),
  };
};

const setDeliveryTypeRefrigerated = async (data) => {
  if (data.delivery_type && data.delivery_type.id) {
    const deliveryTypes = await strapi.services["delivery-type"].find();
    const deliveryType = deliveryTypes.find(
      (d) => d.id === data.delivery_type.id
    );
    if (deliveryType && deliveryType.refrigerated) {
      data.refrigerated = 1;
    } else {
      data.refrigerated = 0;
    }
  } else if (data.delivery_type) {
    const deliveryTypes = await strapi.services["delivery-type"].find();
    const deliveryType = deliveryTypes.find((d) => d.id === data.delivery_type);
    if (deliveryType && deliveryType.refrigerated) {
      data.refrigerated = 1;
    } else {
      data.refrigerated = 0;
    }
  }
};

const updateMultideliveryDiscountForOrders = async (
  orders,
  me,
  ownerFactor = 1
) => {
  const discountToApply =
    ownerFactor * (me.orders_options?.multidelivery_discount || 0);

  for await (const order of orders) {
    if (order.multidelivery_discount !== discountToApply) {
      const orderToUpdate = {
        id: order.id,
        multidelivery_discount: discountToApply,
        _internal: true, // Flag to prevent infinite loops
      };
      await strapi
        .query("orders")
        .update({ id: orderToUpdate.id }, orderToUpdate);
    }
  }
};

// --- ORDER TRACKING LOGIC ---
const createOrderTracking = async (orderId, status, user) => {
  try {
    const trackingData = {
      order_id: orderId,
      order_status: status,
    };

    // Determine if it's a user or admin user based on user object
    if (user) {
      // Check if it's an admin user by looking for roles array with content
      if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
        // Admin user (has roles array with content)
        trackingData.admin_user = user.id;
      } else {
        // Regular user (users-permissions)
        trackingData.users_permissions_user = user.id;
      }
    }

    await strapi.query("orders-tracking").create(trackingData);
  } catch (error) {
    // Log error but don't fail the order operation
    console.error("Error creating order tracking:", error);
  }
};

const processMultideliveryDiscountForCurrentOrder = async (orderId, data) => {
  // Skip if this is an internal update
  if (data._internal) {
    return;
  }

  // Skip if order is invoiced
  if (data.status === "invoiced" || data.status === "delivered") {
    return;
  }

  // Skip if no contact
  if (!data.contact) {
    return;
  }

  const me = await strapi.query("me").findOne();
  if (!me?.orders_options?.multidelivery_discount) {
    return;
  }

  // Get owner information for discount factor
  const owner = await strapi
    .query("user", "users-permissions")
    .findOne({ id: data.owner.id });
  const ownerFactor = owner?.multidelivery_discount === false ? 0 : 1;

  // Normalize multidelivery_discount
  if (isNaN(data.multidelivery_discount)) {
    data.multidelivery_discount = 0;
  }

  // Process current order multidelivery
  const { multidelivery } = await checkMultidelivery(
    orderId,
    data.estimated_delivery_date,
    data.contact && data.contact.id ? data.contact.id : data.contact,
    data.status
  );

  if (multidelivery && !data.multidelivery_discount) {
    data.multidelivery_discount =
      ownerFactor * me.orders_options.multidelivery_discount || 0;
  } else if (!multidelivery && data.multidelivery_discount) {
    data.multidelivery_discount = 0;
  }
};

const processMultideliveryDiscountForOtherOrders = async (
  orderId,
  currentData,
  previousOrder = null
) => {
  // Skip if this is an internal update
  if (currentData._internal) {
    return;
  }

  // Skip if order is invoiced
  if (currentData.status === "invoiced" || currentData.status === "delivered") {
    return;
  }

  // Skip if no contact
  if (!currentData.contact) {
    return;
  }

  const me = await strapi.query("me").findOne();
  if (!me?.orders_options?.multidelivery_discount) {
    return;
  }

  // Get owner information for discount factor
  const owner = await strapi
    .query("user", "users-permissions")
    .findOne({ id: currentData.owner.id });

  const ownerFactor = owner?.multidelivery_discount === false ? 0 : 1;

  // Process current group - update other orders in the same group
  const { multidelivery, others } = await checkMultidelivery(
    orderId,
    currentData.estimated_delivery_date,
    currentData.contact && currentData.contact.id
      ? currentData.contact.id
      : currentData.contact,
    currentData.status
  );

  // Always update the current group if there are others and multidelivery conditions are met
  if (multidelivery && others.length > 0) {
    await updateMultideliveryDiscountForOrders(others, me, ownerFactor);
  } else if (!multidelivery && others.length > 0) {
    // If no longer multidelivery, remove discount from others in current group
    for await (const order of others) {
      if (order.multidelivery_discount > 0) {
        await strapi
          .query("orders")
          .update(
            { id: order.id },
            { multidelivery_discount: 0, _internal: true }
          );
      }
    }
  }

  // For updates, handle changes in estimated_delivery_date, contact, or status
  if (previousOrder && orderId !== 0) {
    const dateChanged =
      previousOrder.estimated_delivery_date !==
      currentData.estimated_delivery_date;
    const contactChanged =
      (previousOrder.contact?.id || previousOrder.contact) !==
      (currentData.contact?.id || currentData.contact);
    const statusChanged = previousOrder.status !== currentData.status;

    // Special handling for status changes from/to cancelled
    const wasCancelled = previousOrder.status === "cancelled";
    const isNowCancelled = currentData.status === "cancelled";
    const statusChangeFromCancelled = wasCancelled && !isNowCancelled;
    const statusChangeToCancelled = !wasCancelled && isNowCancelled;

    // If key fields changed, check previous group and update their discounts
    if (dateChanged || contactChanged || statusChanged) {
      // Only check previous group if the order moved away from its previous group
      if (dateChanged || contactChanged) {
        // Check previous date/contact group
        const previousGroup = await checkMultidelivery(
          orderId,
          previousOrder.estimated_delivery_date,
          previousOrder.contact?.id || previousOrder.contact,
          "active" // Use active status to check remaining orders
        );

        // Update previous group if they no longer qualify for multidelivery
        if (previousGroup.others.length > 0) {
          const stillHasMultidelivery = previousGroup.others.length > 1;

          if (!stillHasMultidelivery) {
            // Remove multidelivery discount from remaining orders
            for await (const order of previousGroup.others) {
              if (order.multidelivery_discount > 0) {
                await strapi
                  .query("orders")
                  .update(
                    { id: order.id },
                    { multidelivery_discount: 0, _internal: true }
                  );
              }
            }
          } else {
            // Previous group still has multidelivery, make sure they have the discount
            await updateMultideliveryDiscountForOrders(
              previousGroup.others,
              me,
              ownerFactor
            );
          }
        }
      } else if (statusChangeToCancelled) {
        // Order was cancelled, check if remaining orders in same group still qualify
        const remainingGroup = await checkMultidelivery(
          orderId,
          currentData.estimated_delivery_date,
          currentData.contact?.id || currentData.contact,
          "active" // Check remaining active orders
        );

        if (remainingGroup.others.length > 0) {
          const stillHasMultidelivery = remainingGroup.others.length > 1;

          if (!stillHasMultidelivery) {
            // Remove multidelivery discount from remaining orders
            for await (const order of remainingGroup.others) {
              if (order.multidelivery_discount > 0) {
                await strapi
                  .query("orders")
                  .update(
                    { id: order.id },
                    { multidelivery_discount: 0, _internal: true }
                  );
              }
            }
          }
        }
      }
      // For statusChangeFromCancelled, the current group processing above already handles it
    }
  }
};

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      await setDeliveryTypeRefrigerated(data);

      if (data.status === "lastmile") {
        data.last_mile = true;
      }

      await processMultideliveryDiscountForCurrentOrder(0, data);
      await processVolumeDiscountForCurrentOrder(0, data);
    },

    async beforeUpdate(params, data) {
      if (data._internal) {
        return data;
      }
      // Get previous order data for comparison and store it for afterUpdate
      const previousOrder = await strapi
        .query("orders")
        .findOne({ id: params.id });

      // Store previous order data for afterUpdate
      data._previousOrderData = previousOrder;

      if (data.status === "delivered" && !data.delivery_date) {
        data.delivery_date = data.estimated_delivery_date
          ? data.estimated_delivery_date
          : new Date();
      }

      if (data.status === "lastmile") {
        data.last_mile = true;
      }

      await setDeliveryTypeRefrigerated(data);

      if (data.incidence && !data.incidence_solved) {
        const me = await strapi.query("me").findOne();
        if (!me.contact_form_email) {
          throw new Error("contact_form_email not set");
        }

        const to = [data.email];
        me.contact_form_email.split(",").forEach((email) => {
          to.push(email);
        });
        const from = strapi.config.get(
          "plugins.email.settings.defaultFrom",
          ""
        );
        const subject = `[ESSSTRAPIS] Incidència amb una comanda`;
        const userData = await strapi
          .query("user", "users-permissions")
          .findOne({ id: data.user });
        const html = `
                <b>Incidència amb una comanda</b><br><br>
                PROVEÏDORA: ${userData.fullname || userData.username} (${
          userData.id
        })<br>
                COMANDA: #${params.id.toString().padStart(4, "0")} <br>
                INCIDÈNCIA: ${data.incidence_description} <br>                
                --<br>
                Missatge automàtic.<br>                
                --<br>`;

        await strapi.plugins["email"].services.email.send({
          to,
          from,
          subject,
          html,
        });
      }

      // Merge data with previous order data for complete context
      const mergedData = {
        ...previousOrder,
        ...data,
        // Ensure contact is properly handled if it's being updated
        contact: data.contact || previousOrder.contact,
        estimated_delivery_date:
          data.estimated_delivery_date || previousOrder.estimated_delivery_date,
        status: data.status || previousOrder.status,
        owner: data.owner || previousOrder.owner,
      };
      
      await processMultideliveryDiscountForCurrentOrder(
        params.id,
        mergedData
      );

      data.multidelivery_discount = mergedData.multidelivery_discount;
      await processVolumeDiscountForCurrentOrder(params.id, mergedData);
      data.volume_discount = mergedData.volume_discount;
    },
    async afterCreate(result, data) {
      // Skip if this is an internal update
      if (data._internal) {
        return;
      }

      // Get user from data or try to get from created_by field
      let trackingUser = data._tracking_user;
      
      if (!trackingUser && result.created_by) {
        // Get the admin user who created the order
        trackingUser = await strapi.query("user", "admin").findOne({ id: result.created_by });
      }

      // Create tracking entry for order creation
      // await createOrderTracking(result.id, result.status, trackingUser);

      // Process multidelivery discount for other orders after the current order is created
      const previousOrder = await strapi
        .query("orders")
        .findOne({ id: result.id });
      await processMultideliveryDiscountForOtherOrders(
        result.id,
        previousOrder
      );
      await processVolumeDiscountForOtherOrders(result.id, previousOrder);
    },

    async afterUpdate(result, params, data) {
      // Skip if this is an internal update
      if (data._internal) {
        return;
      }

      // Get the previous order data that was stored in beforeUpdate
      const previousOrder = data._previousOrderData;

      // Get the current order state after the update
      const currentOrder = await strapi
        .query("orders")
        .findOne({ id: params.id });

      if (currentOrder) {
        // Get user from data or try to get from updated_by field
        let trackingUser = data._tracking_user;
        
        if (!trackingUser && currentOrder.updated_by) {
          // Get the admin user who made the update
          trackingUser = await strapi.query("user", "admin").findOne({ id: currentOrder.updated_by });
        }
        
        // Create tracking entry for every update
        // await createOrderTracking(currentOrder.id, currentOrder.status, trackingUser);

        // Process multidelivery discount for other orders
        await processMultideliveryDiscountForOtherOrders(
          params.id,
          currentOrder,
          previousOrder
        );
        await processVolumeDiscountForOtherOrders(
          params.id,
          currentOrder,
          previousOrder
        );
      }
    },

    afterFind: async (results, params, populate) => {
      results.forEach((res, i) => {
        // Apply both discounts: multidelivery (percentage) and volume (fixed value)
        let price = res.price || 0;
        price = price * (1 - (res.multidelivery_discount || 0) / 100);
        price = price * (1 - (res.contact_pickup_discount || 0) / 100);
        price = price - (res.volume_discount || 0);
        res.finalPrice = price;
      });
    },
  },
};
