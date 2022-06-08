module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('URL', ''),  
  admin: {
    auth: {
      secret: env('ADMIN_JWT_SECRET', 'dbbad98142ac7655850929768dc95340'),
    },
  },
  cron: { enabled: true },
});
