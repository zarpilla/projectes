'use strict';

const axios = require('axios');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  /**
   * Proxy endpoint for DIR3 search by NIF
   * GET /me/dir3/search/nif/:nif
   */
  async dir3SearchNif(ctx) {
    try {
      const { nif } = ctx.params;

      if (!nif) {
        return ctx.badRequest('NIF parameter is required');
      }

      // Get the me settings with the DIR3 configuration
      const meSettings = await strapi.query('me').findOne();

      if (!meSettings || !meSettings.dir3_api_url || !meSettings.dir3_api_token) {
        return ctx.badRequest('DIR3 API is not configured');
      }

      // Make the request to the DIR3 API
      const response = await axios.get(
        `${meSettings.dir3_api_url}/api/search/nif/${encodeURIComponent(nif)}`,
        {
          headers: {
            'X-API-Key': meSettings.dir3_api_token
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error in DIR3 search by NIF:', error);
      if (error.response) {
        return ctx.send(error.response.data, error.response.status);
      }
      return ctx.internalServerError('Error connecting to DIR3 API');
    }
  },

  /**
   * Proxy endpoint for DIR3 search by name
   * GET /me/dir3/search/name/:name
   */
  async dir3SearchName(ctx) {
    try {
      const { name } = ctx.params;
      const { limit } = ctx.query;

      if (!name) {
        return ctx.badRequest('Name parameter is required');
      }

      // Get the me settings with the DIR3 configuration
      const meSettings = await strapi.query('me').findOne();

      if (!meSettings || !meSettings.dir3_api_url || !meSettings.dir3_api_token) {
        return ctx.badRequest('DIR3 API is not configured');
      }

      // Build URL with optional limit parameter
      let url = `${meSettings.dir3_api_url}/api/search/name/${encodeURIComponent(name)}`;
      if (limit) {
        url += `?limit=${limit}`;
      }

      // Make the request to the DIR3 API
      const response = await axios.get(url, {
        headers: {
          'X-API-Key': meSettings.dir3_api_token
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error in DIR3 search by name:', error);
      if (error.response) {
        return ctx.send(error.response.data, error.response.status);
      }
      return ctx.internalServerError('Error connecting to DIR3 API');
    }
  }
};
