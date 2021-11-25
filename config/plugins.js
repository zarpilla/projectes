module.exports = ({ env }) => ({
    // ...
    email: {
      provider: 'sendgrid',
      providerOptions: {
        apiKey: env('SENDGRID_API_KEY'),
      },
      settings: {
        defaultFrom: env('EMAIL_FROM'),
        defaultReplyTo: env('EMAIL_FROM'),
      },
    },
    // ...
  });