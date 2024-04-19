module.exports = ({ env }) => ({
  // ...
  email:
    env("EMAIL_PROVIDER", "sendgrid") === "sendgrid"
      ? {
          provider: env("EMAIL_PROVIDER", "sendgrid"),
          providerOptions: {
            apiKey: env("SENDGRID_API_KEY"),
          },
          settings: {
            defaultFrom: env("EMAIL_FROM"),
            defaultReplyTo: env("EMAIL_FROM"),
          },
        }
      : {
          provider: env("EMAIL_PROVIDER", "nodemailer"),
          providerOptions: {
            host: env("SMTP_HOST", "smtp.example.com"),
            port: env("SMTP_PORT", 587),
            auth: {
              user: env("SMTP_USER"),
              pass: env("SMTP_PASS"),
            },
          },
          settings: {
            defaultFrom: env("EMAIL_FROM"),
            defaultReplyTo: env("EMAIL_FROM"),
          },
        },
  // ...
});
