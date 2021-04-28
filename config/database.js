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
        ssl: false,
        useNullAsDefault: true,
      },
    },
  },
});
