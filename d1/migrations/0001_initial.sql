CREATE TABLE deleted_accounts (
  user_id TEXT PRIMARY KEY
) STRICT;

CREATE TABLE auth_session_notifications (
  session_id TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
) STRICT;
CREATE INDEX auth_session_notifications_expires_idx ON auth_session_notifications (expires_at);

CREATE TABLE billing_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('standard', 'professional', 'enterprise')),
  provider TEXT NOT NULL CHECK (provider = 'waffo'),
  provider_subscription_id TEXT NOT NULL,
  provider_plan_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'PAYMENT_FAILED')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  recurring_amount_cents INTEGER NOT NULL CHECK (recurring_amount_cents > 0),
  original_amount_cents INTEGER NOT NULL CHECK (original_amount_cents >= amount_cents),
  discount_amount_cents INTEGER NOT NULL CHECK (discount_amount_cents = original_amount_cents - amount_cents),
  provider_discount_id TEXT,
  currency_code TEXT NOT NULL CHECK (currency_code = 'USD'),
  payer_id TEXT,
  subscriber_email TEXT,
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL CHECK (current_period_end > current_period_start),
  last_webhook_event_id TEXT NOT NULL,
  last_event_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (provider, provider_subscription_id)
) STRICT;

CREATE INDEX billing_subscriptions_user_created_idx ON billing_subscriptions (user_id, created_at DESC);
CREATE UNIQUE INDEX billing_subscriptions_open_user_idx ON billing_subscriptions (user_id)
  WHERE status IN ('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'PAYMENT_FAILED');

CREATE TABLE conversion_usage (
  actor_type TEXT NOT NULL CHECK (actor_type IN ('anonymous', 'user')),
  actor_key TEXT NOT NULL,
  email TEXT,
  period TEXT NOT NULL CHECK (period IN ('day', 'month')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL CHECK (period_end > period_start),
  used_pages INTEGER NOT NULL CHECK (used_pages >= 0),
  used_ai_pages INTEGER NOT NULL CHECK (used_ai_pages BETWEEN 0 AND used_pages),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (actor_type, actor_key)
) STRICT;

CREATE TABLE conversion_parse_records (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT,
  parse_method TEXT NOT NULL CHECK (parse_method = 'llm'),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'cancelled')),
  error_code TEXT
) STRICT;
CREATE INDEX conversion_parse_records_user_created_idx ON conversion_parse_records (user_id, created_at DESC);

CREATE TABLE billing_checkout_analytics (
  checkout_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  session_id INTEGER NOT NULL CHECK (session_id BETWEEN 1 AND 9007199254740991),
  locale TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX billing_checkout_analytics_created_idx ON billing_checkout_analytics (created_at);
