-- Set up cron job to check expiring packages daily
SELECT cron.schedule(
  'check-expiring-packages-daily',  -- job name
  '0 9 * * *',  -- Run every day at 9:00 AM (cron expression)
  $$
    SELECT
      net.http_post(
        url := 'http://localhost:54321/functions/v1/check-expiring-packages',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
        body := '{}'::jsonb
      ) as request_id;
  $$
);

-- To test immediately (run manually):
-- SELECT net.http_post(
--   url := 'http://localhost:54321/functions/v1/check-expiring-packages',
--   headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--   body := '{}'::jsonb
-- );
