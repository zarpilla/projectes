module.exports = ({ env }) => ({
  defaultConnection: 'default',
  connections: {
    default: {
      connector: 'bookshelf',
      settings: {        
        client: env('DATABASE_CLIENT', 'mysql'),
        host: env('DATABASE_HOST', '127.0.0.1'),
        port: env.int('DATABASE_PORT', 3306),
        // database: env('DATABASE_NAME', 'projectes_strapi'),
        // username: env('DATABASE_USERNAME', 'projectes_strapi'),
        // password: env('DATABASE_PASSWORD', 'UUhkc72tdPRtND4m*'),
        database: env('DATABASE_NAME', 'strapi_resilience_20210422'),
        username: env('DATABASE_USERNAME', 'root'),
        password: env('DATABASE_PASSWORD', 'zarpilla'),
      },
      options: {
        ssl: false,
        useNullAsDefault: true,
      },
    },
  },
});
