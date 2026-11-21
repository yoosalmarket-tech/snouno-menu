alter table private.snounu_ai_daily_usage
  drop constraint snounu_ai_daily_usage_request_count_check,
  add constraint snounu_ai_daily_usage_request_count_check check (request_count between 0 and 100);
