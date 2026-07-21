module.exports = ({ env }) => ({
  defaultConnection: 'default',
  connections: {
    default: {
      connector: 'bookshelf',
      settings: {        
        client: env('DATABASE_CLIENT', 'mysql'),
        host: env('DATABASE_HOST', '127.0.0.1'),
        port: env.int('DATABASE_PORT', 3306),
        database: env('DATABASE_NAME', 'database'),
        username: env('DATABASE_USERNAME', 'user'),
        password: env('DATABASE_PASSWORD', 'pwd'),
      },
      options: {
        ssl: env('DATABASE_SSL', false),
        useNullAsDefault: true,
        // Cap the per-process pool. With 16 PM2 instances against a single
        // MySQL server, the knex default of max=10 would allow up to 160
        // connections and exhaust MySQL's max_connections (151), surfacing as
        // ER_CON_COUNT_ERROR in the FACe cron jobs. 16 x 5 = 80.
        pool: {
          min: env.int('DATABASE_POOL_MIN', 0),
          max: env.int('DATABASE_POOL_MAX', 8),
        },
      },
    },
  },
});
