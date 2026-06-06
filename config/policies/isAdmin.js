'use strict';

/**
 * `isAdmin` policy.
 * Checks if the authenticated user has the 'admin' permission
 */

module.exports = async (ctx, next) => {
  // Check if user is authenticated
  if (!ctx.state.user) {
    return ctx.unauthorized('You must be authenticated to access this resource');
  }

  // Get user with permissions
  const user = await strapi.query('user', 'users-permissions').findOne(
    { id: ctx.state.user.id },
    ['permissions']
  );

  if (!user) {
    return ctx.unauthorized('User not found');
  }

  // Check if user has admin permission
  const hasAdminPermission = user.permissions && 
    user.permissions.some(p => p.permission === 'admin');

  if (!hasAdminPermission) {
    return ctx.forbidden('You do not have admin privileges');
  }

  // User is admin, proceed
  await next();
};
