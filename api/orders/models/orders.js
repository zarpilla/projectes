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

// --- COLLECTION ORDER LOGIC ---

/**
 * Calculate route for a collection point contact based on its city
 */
const calculateRouteForCollectionPoint = async (collectionPointContact) => {
  if (!collectionPointContact || !collectionPointContact.city) {
    return null;
  }

  // Find city object by name
  const cities = await strapi.query("city").find({ name: collectionPointContact.city, _limit: 1 });
  if (!cities || cities.length === 0) {
    return null;
  }
  const cityId = cities[0].id;

  // Find route that serves this city
  const cityRoutes = await strapi.query("city-route").find({ city: cityId, _limit: -1 });
  if (!cityRoutes || cityRoutes.length === 0) {
    return null;
  }

  // Extract route IDs properly
  const routeIds = cityRoutes
    .map(cr => {
      if (typeof cr.route === 'object' && cr.route !== null) {
        return cr.route.id;
      }
      return cr.route;
    })
    .filter(id => id !== null && id !== undefined && typeof id === 'number');

  if (routeIds.length === 0) {
    return null;
  }

  // Get the first active route
  const routes = await strapi.query("route").find({ 
    id_in: routeIds,
    active: true,
    _limit: 1 
  });
  
  return routes && routes.length > 0 ? routes[0] : null;
};

/**
 * Calculate estimated delivery date based on route
 */
const calculateEstimatedDeliveryDate = (route) => {
  if (!route) {
    return null;
  }

  const routeDayOfWeek = route.monday
    ? 1
    : route.tuesday
    ? 2
    : route.wednesday
    ? 3
    : route.thursday
    ? 4
    : route.friday
    ? 5
    : route.saturday
    ? 6
    : route.sunday
    ? 7
    : 0;

  if (routeDayOfWeek === 0) {
    return null;
  }

  // Find next occurrence of the route day
  let nextDay = moment();
  let found = false;
  let maxIterations = 7;
  let iterations = 0;

  while (!found && iterations < maxIterations) {
    nextDay = nextDay.add(1, "day");
    if (routeDayOfWeek === nextDay.day()) {
      found = true;
    }
    iterations++;
  }

  return found ? nextDay.format("YYYY-MM-DD") : null;
};

/**
 * Check if transfer is needed for a collection order
 */
const checkTransferNeededForCollectionOrder = async (pickupId, routeId) => {
  if (!pickupId || !routeId) {
    return { transfer: false };
  }

  // Get pickup details
  const pickup = await strapi.query("pickups").findOne({ id: pickupId });
  if (!pickup) {
    return { transfer: false };
  }

  // Get route details
  const route = await strapi.query("route").findOne({ id: routeId });
  if (!route) {
    return { transfer: false };
  }

  let pickupCityId = null;

  // Get city from pickup
  if (pickup.city) {
    pickupCityId = typeof pickup.city === 'object' ? pickup.city.id : pickup.city;
  }

  if (!pickupCityId) {
    return { transfer: false };
  }

  // Check if route serves this city
  const cityRoutes = await strapi.query("city-route").find({
    city: pickupCityId,
    route: routeId,
    _limit: 1
  });

  const routeTravelsToCity = cityRoutes && cityRoutes.length > 0;

  if (!routeTravelsToCity) {
    // Transfer is needed
    return {
      transfer: true,
      transfer_pickup_origin: pickupId,
      transfer_pickup_destination: route.transfer_pickup?.id || route.transfer_pickup || null
    };
  }

  return { transfer: false };
};

/**
 * Process collection order: find or create a collection order for the collection point
 */
const processCollectionOrder = async (orderId, orderData) => {
  // Skip if no collection_point or if this is already a collection order
  if (!orderData.collection_point || orderData.is_collection_order) {
    return;
  }

  const collectionPointId = orderData.collection_point.id || orderData.collection_point;
  const ownerId = orderData.owner?.id || orderData.owner;

  if (!collectionPointId || !ownerId) {
    return;
  }

  // Get collection point contact details
  const collectionPointContact = await strapi.query("contacts").findOne({ id: collectionPointId });
  if (!collectionPointContact) {
    console.error(`Collection point contact ${collectionPointId} not found`);
    return;
  }

  // Find existing pending collection order for this owner and collection point
  const existingCollectionOrders = await strapi.query("orders").find({
    is_collection_order: true,
    owner: ownerId,
    contact: collectionPointId,
    status: "pending",
    _limit: 1
  });

  let collectionOrder = existingCollectionOrders && existingCollectionOrders.length > 0 ? existingCollectionOrders[0] : null;

  // Calculate route for collection point
  const route = await calculateRouteForCollectionPoint(collectionPointContact);
  if (!route) {
    console.error(`Could not find route for collection point ${collectionPointId}`);
    return;
  }

  // Calculate estimated delivery date
  const estimatedDeliveryDate = calculateEstimatedDeliveryDate(route);

  // Get pickup from original order (inherit collection_point for the collection order)
  const pickupId = orderData.pickup?.id || orderData.pickup;
  const originalCollectionPoint = orderData.collection_point?.id || orderData.collection_point;

  // Check if transfer is needed
  const transferInfo = await checkTransferNeededForCollectionOrder(pickupId, route.id);

  if (collectionOrder) {
    // Update existing collection order
    const updateData = {
      route: route.id,
      estimated_delivery_date: estimatedDeliveryDate,
      transfer: transferInfo.transfer,
      _internal: true // Prevent recursive processing
    };

    if (transferInfo.transfer) {
      updateData.transfer_pickup_origin = transferInfo.transfer_pickup_origin;
      updateData.transfer_pickup_destination = transferInfo.transfer_pickup_destination;
    }

    // Copy delivery_type from original order if available
    if (orderData.delivery_type) {
      updateData.delivery_type = orderData.delivery_type.id || orderData.delivery_type;
    }

    // Add current order to collection_orders if not already there
    const currentCollectionOrders = collectionOrder.collection_orders || [];
    const orderIdToAdd = orderId || orderData.id;
    if (orderIdToAdd && !currentCollectionOrders.find(o => (o.id || o) === orderIdToAdd)) {
      updateData.collection_orders = [...currentCollectionOrders.map(o => o.id || o), orderIdToAdd];
    }

    await strapi.query("orders").update({ id: collectionOrder.id }, updateData);
    
    // After updating, recalculate aggregated data
    await updateCollectionOrderAggregates(collectionOrder.id);
  } else {
    // Create new collection order
    const createData = {
      is_collection_order: true,
      owner: ownerId,
      contact: collectionPointId,
      contact_name: collectionPointContact.name,
      contact_trade_name: collectionPointContact.trade_name || collectionPointContact.name,
      contact_nif: collectionPointContact.nif,
      contact_address: collectionPointContact.address,
      contact_postcode: collectionPointContact.postcode,
      contact_city: collectionPointContact.city,
      contact_phone: collectionPointContact.phone,
      contact_legal_form: collectionPointContact.legal_form?.id || collectionPointContact.legal_form,
      contact_notes: collectionPointContact.notes,
      contact_time_slot_1_ini: collectionPointContact.time_slot_1_ini,
      contact_time_slot_1_end: collectionPointContact.time_slot_1_end,
      contact_time_slot_2_ini: collectionPointContact.time_slot_2_ini,
      contact_time_slot_2_end: collectionPointContact.time_slot_2_end,
      route: route.id,
      estimated_delivery_date: estimatedDeliveryDate,
      pickup: pickupId,
      collection_point: originalCollectionPoint, // Inherit collection_point from creating order
      status: "pending",
      transfer: transferInfo.transfer,
      units: 0,
      kilograms: 0,
      refrigerated: false,
      _internal: true // Prevent recursive processing
    };

    // Copy delivery_type from original order if available
    if (orderData.delivery_type) {
      createData.delivery_type = orderData.delivery_type.id || orderData.delivery_type;
    }

    if (transferInfo.transfer) {
      createData.transfer_pickup_origin = transferInfo.transfer_pickup_origin;
      createData.transfer_pickup_destination = transferInfo.transfer_pickup_destination;
    }

    // Add current order to collection_orders
    if (orderId) {
      createData.collection_orders = [orderId];
    }

    const newCollectionOrder = await strapi.query("orders").create(createData);
    
    // Update the original order with the collection_order reference
    if (orderId && newCollectionOrder) {
      await strapi.query("orders").update(
        { id: orderId },
        { collection_order: newCollectionOrder.id, _internal: true }
      );
      
      // After creating, recalculate aggregated data
      await updateCollectionOrderAggregates(newCollectionOrder.id);
    }
  }
};

/**
 * Update collection order with aggregated data from its collection_orders
 */
const updateCollectionOrderAggregates = async (collectionOrderId) => {
  // Get the collection order with its related orders
  const collectionOrder = await strapi.query("orders").findOne({ 
    id: collectionOrderId 
  });

  if (!collectionOrder || !collectionOrder.is_collection_order) {
    return;
  }

  // Get all related orders
  const relatedOrders = await strapi.query("orders").find({
    collection_order: collectionOrderId,
    status_ne: "cancelled",
    _limit: -1
  });

  if (!relatedOrders || relatedOrders.length === 0) {
    return;
  }

  // Calculate aggregates
  let totalUnits = 0;
  let totalKilograms = 0;
  let isRefrigerated = false;
  let commentsArray = [];

  relatedOrders.forEach(order => {
    totalUnits += order.units || 0;
    totalKilograms += parseFloat(order.kilograms || 0);
    if (order.refrigerated) {
      isRefrigerated = true;
    }
    // Collect comments from orders that have them
    if (order.comments && order.comments.trim() !== '') {
      commentsArray.push(`#${order.id} ${order.comments}`);
    }
  });

  // Concatenate comments with newlines
  const concatenatedComments = commentsArray.join('\n');

  // Calculate route rate excluding "Pickup" rates
  const routeRate = await calculateCollectionOrderRouteRate(collectionOrder, totalKilograms);

  // Update collection order with aggregates
  const updateData = {
    units: totalUnits,
    kilograms: totalKilograms,
    refrigerated: isRefrigerated,
    comments: concatenatedComments,
    _internal: true
  };

  // Only update route_rate if one was found
  if (routeRate) {
    updateData.route_rate = routeRate.id;
    updateData.price = calculatePriceFromRouteRate(routeRate, totalKilograms, 0);
  }

  await strapi.query("orders").update({ id: collectionOrderId }, updateData);
};

/**
 * Calculate route rate for collection order (excluding "Pickup" rates)
 */
const calculateCollectionOrderRouteRate = async (collectionOrder, kilograms) => {
  if (!collectionOrder.route) {
    return null;
  }

  const routeId = typeof collectionOrder.route === 'object' ? collectionOrder.route.id : collectionOrder.route;
  const deliveryTypeId = collectionOrder.delivery_type 
    ? (typeof collectionOrder.delivery_type === 'object' ? collectionOrder.delivery_type.id : collectionOrder.delivery_type)
    : null;

  // Get all route rates
  let routeRates = await strapi.query("route-rate").find({ _limit: -1 });

  // Filter by route (rates that apply to this route or all routes)
  routeRates = routeRates.filter(r => {
    if (!r.routes || r.routes.length === 0) return true;
    return r.routes.some(rt => {
      const rtId = typeof rt === 'object' ? rt.id : rt;
      return rtId === routeId;
    });
  });

  // Exclude rates with pickup (we want rates without pickup or with pickup ID 1 "No Pickup")
  routeRates = routeRates.filter(r => {
    if (!r.pickup) return true; // No pickup specified = applies to all
    const pickupId = typeof r.pickup === 'object' ? r.pickup.id : r.pickup;
    return pickupId === 1; // Only accept "No Pickup" rates
  });

  // Filter by delivery type
  if (deliveryTypeId) {
    routeRates = routeRates.filter(r => {
      if (!r.delivery_type) return true;
      const dtId = typeof r.delivery_type === 'object' ? r.delivery_type.id : r.delivery_type;
      return dtId === deliveryTypeId;
    });
  }

  // Prefer rates specific to the route over general rates
  let specificRates = routeRates.filter(r => r.routes && r.routes.length > 0);
  if (specificRates.length > 0) {
    return specificRates[0];
  }

  // Return first available rate
  return routeRates.length > 0 ? routeRates[0] : null;
};

/**
 * Calculate price from route rate
 */
const calculatePriceFromRouteRate = (routeRate, kilograms, pickupLines) => {
  let price = 0;
  
  if (!routeRate) {
    return price;
  }

  if (routeRate.ratev2 !== true) {
    // Old rate structure
    if (kilograms < 15) {
      price = routeRate.less15 || 0;
    } else if (kilograms < 30) {
      price = routeRate.less30 || 0;
    } else {
      price = (routeRate.less30 || 0) + (kilograms - 30) * (routeRate.additional30 || 0);
    }
  } else {
    // New rate structure (ratev2)
    if (kilograms < 10) {
      price = routeRate.less10 || 0;
    } else if (kilograms >= 10 && kilograms <= 20) {
      const t = (kilograms - 10) / 10;
      price = (routeRate.more10 || 0) + t * ((routeRate.from10to20 || 0) - (routeRate.more10 || 0));
    } else if (kilograms > 20 && kilograms <= 30) {
      const t = (kilograms - 20) / 10;
      price = (routeRate.from10to20 || 0) + t * ((routeRate.from20to30 || 0) - (routeRate.from10to20 || 0));
    } else if (kilograms > 30 && kilograms <= 40) {
      const t = (kilograms - 30) / 10;
      price = (routeRate.from20to30 || 0) + t * ((routeRate.from30to40 || 0) - (routeRate.from20to30 || 0));
    } else if (kilograms > 40 && kilograms <= 50) {
      const t = (kilograms - 40) / 10;
      price = (routeRate.from30to40 || 0) + t * ((routeRate.from40to50 || 0) - (routeRate.from30to40 || 0));
    } else if (kilograms > 50 && kilograms <= 60) {
      const t = (kilograms - 50) / 10;
      price = (routeRate.from40to50 || 0) + t * ((routeRate.from50to60 || 0) - (routeRate.from40to50 || 0));
    } else if (kilograms > 60) {
      price = (routeRate.from50to60 || 0) + (kilograms - 60) * (routeRate.additional60 || 0);
    }
    
    // Add pickup point charges if applicable (though for collection orders this should be 0)
    if (pickupLines > 0 && routeRate.pickup_point) {
      price += pickupLines * routeRate.pickup_point;
    }
  }
  
  return price;
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

// --- INCIDENCES LOGIC ---
const processIncidences = async (orderId, incidences, trackingUser) => {
  try {
    // Get existing incidences for this order
    const existingIncidences = await strapi.query("incidences").find({
      order: orderId,
      _limit: -1,
    });

    // Create a map of existing incidences by ID for quick lookup
    const existingMap = new Map(existingIncidences.map(inc => [inc.id, inc]));
    const processedIds = new Set();

    // Process each incidence from the form
    for (const incidence of incidences) {
      if (incidence.id) {
        // Update existing incidence
        processedIds.add(incidence.id);
        const existing = existingMap.get(incidence.id);
        
        if (existing) {
          const updateData = {
            description: incidence.description,
            state: incidence.state,
          };

          // If changing to closed state and not already closed, set closed_date and closed_user
          if (incidence.state === 'closed' && existing.state !== 'closed') {
            updateData.closed_date = new Date();
            if (trackingUser) {
              updateData.closed_user = trackingUser.id;
            }
          }

          await strapi.query("incidences").update(
            { id: incidence.id },
            updateData
          );
        }
      } else {
        // Create new incidence
        const createData = {
          order: orderId,
          description: incidence.description,
          state: incidence.state || 'open',
        };

        if (trackingUser) {
          createData.created_user = trackingUser.id;
        }

        // If creating as closed, set closed_date and closed_user
        if (createData.state === 'closed') {
          createData.closed_date = new Date();
          if (trackingUser) {
            createData.closed_user = trackingUser.id;
          }
        }

        const newIncidence = await strapi.query("incidences").create(createData);
        processedIds.add(newIncidence.id);
      }
    }

    // Note: We're not deleting incidences that are not in the list
    // If you want to delete removed incidences, uncomment the code below:
    /*
    // Delete incidences that were removed from the list
    for (const existing of existingIncidences) {
      if (!processedIds.has(existing.id)) {
        await strapi.query("incidences").delete({ id: existing.id });
      }
    }
    */
  } catch (error) {
    console.error("Error processing incidences:", error);
    throw error;
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
      // Set route_date to current date if not provided
      if (!data.route_date) {
        data.route_date = new Date();
      }

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

      // Handle incidences if provided
      if (data.incidences && Array.isArray(data.incidences)) {
        // Store incidences data temporarily (will be processed in afterUpdate)
        data._incidencesToProcess = data.incidences;
        delete data.incidences; // Remove from data to avoid Strapi trying to process it
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

      // Process collection order if needed
      await processCollectionOrder(result.id, result);

      // Process incidences if provided
      if (data._incidencesToProcess) {
        await processIncidences(result.id, data._incidencesToProcess, data._tracking_user);
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
        // Process collection order if needed (collection_point was added or changed)
        await processCollectionOrder(params.id, currentOrder);
        
        // If this order has a collection_order, update its aggregates
        if (currentOrder.collection_order) {
          const collectionOrderId = typeof currentOrder.collection_order === 'object' 
            ? currentOrder.collection_order.id 
            : currentOrder.collection_order;
          await updateCollectionOrderAggregates(collectionOrderId);
        }
        
        // Check if collection_order was removed
        if (previousOrder && previousOrder.collection_order && !currentOrder.collection_order) {
          const oldCollectionOrderId = typeof previousOrder.collection_order === 'object'
            ? previousOrder.collection_order.id
            : previousOrder.collection_order;
          await updateCollectionOrderAggregates(oldCollectionOrderId);
        }
      }

      // Process incidences if provided
      if (data._incidencesToProcess) {
        await processIncidences(params.id, data._incidencesToProcess, data._tracking_user);
      }

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

    async beforeDelete(params) {
      // Store the order data before deletion to update collection order aggregates
      const order = await strapi.query("orders").findOne({ id: params.id });
      if (order && order.collection_order) {
        // Store for afterDelete
        params._deletedOrderCollectionOrder = typeof order.collection_order === 'object'
          ? order.collection_order.id
          : order.collection_order;
      }
    },

    async afterDelete(result, params) {
      // Update collection order aggregates if the deleted order was part of one
      if (params._deletedOrderCollectionOrder) {
        await updateCollectionOrderAggregates(params._deletedOrderCollectionOrder);
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
