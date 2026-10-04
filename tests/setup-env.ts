import { TEST_DATABASE_URL } from "./test-env";

// Tests never read the developer's .env: fixed, fake values only.
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: TEST_DATABASE_URL,
  SESSION_SECRET: "test-session-secret-not-for-production-0123456789",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "whsec_test_fake_secret_for_unit_tests",
  CRON_SECRET: "test-cron-secret-0123456789",
  IOT_GATEWAY_SECRET: "test-iot-secret-0123456789",
  RESEND_API_KEY: "",
});
