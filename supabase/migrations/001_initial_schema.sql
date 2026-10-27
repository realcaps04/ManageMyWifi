-- WiFi Control — initial schema
-- Apply via Supabase SQL editor or `supabase db push`

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Core tenancy
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'operator', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS network_members (
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'operator', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (network_id, profile_id)
);

CREATE TABLE IF NOT EXISTS routers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model TEXT,
  routeros_version TEXT,
  host TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('connected', 'disconnected', 'unknown')),
  last_seen_at TIMESTAMPTZ,
  cpu_load NUMERIC(5,2),
  memory_used_percent NUMERIC(5,2),
  uptime_seconds BIGINT,
  wireless_stack TEXT NOT NULL DEFAULT 'unknown' CHECK (wireless_stack IN ('wifi', 'wireless', 'unknown')),
  -- encrypted blob managed by API only
  credentials_encrypted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'degraded')),
  version TEXT,
  hostname TEXT,
  token_hash TEXT NOT NULL,
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agents_network_name_idx ON agents(network_id, name);

-- ---------------------------------------------------------------------------
-- Users & devices
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS network_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  mac_address TEXT NOT NULL,
  identity_key TEXT NOT NULL,
  hostname TEXT,
  display_name TEXT,
  ip_address TEXT,
  ipv6_address TEXT,
  vendor TEXT,
  device_type TEXT,
  connection_type TEXT,
  ssid TEXT,
  interface_name TEXT,
  signal_strength INTEGER,
  connection_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (connection_status IN ('online', 'offline', 'unknown')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_user_id UUID REFERENCES network_users(id) ON DELETE SET NULL,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  bytes_download BIGINT NOT NULL DEFAULT 0,
  bytes_upload BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (network_id, identity_key)
);

CREATE INDEX IF NOT EXISTS devices_network_mac_idx ON devices(network_id, mac_address);
CREATE INDEX IF NOT EXISTS devices_network_status_idx ON devices(network_id, connection_status);
CREATE INDEX IF NOT EXISTS devices_assigned_user_idx ON devices(assigned_user_id);

CREATE TABLE IF NOT EXISTS device_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES network_users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  UNIQUE (device_id, user_id, assigned_at)
);

CREATE TABLE IF NOT EXISTS device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  ip_address TEXT,
  ssid TEXT,
  interface_name TEXT
);

CREATE INDEX IF NOT EXISTS device_sessions_open_idx
  ON device_sessions(device_id) WHERE ended_at IS NULL;

-- ---------------------------------------------------------------------------
-- Access control & bandwidth
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS access_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('suspend', 'block')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'removed')),
  reason TEXT,
  -- MikroTik rule comment / list entry namespace marker
  router_comment TEXT,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_rules_active_idx
  ON access_rules(network_id, status) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bandwidth_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE UNIQUE,
  download_mbps NUMERIC(10,3) NOT NULL,
  upload_mbps NUMERIC(10,3) NOT NULL,
  queue_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  user_id UUID REFERENCES network_users(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  bytes_download BIGINT NOT NULL DEFAULT 0,
  bytes_upload BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS usage_stats_period_idx
  ON usage_statistics(network_id, period_start, period_end);

-- ---------------------------------------------------------------------------
-- Agent command queue & audit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS command_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  command_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  result JSONB,
  error_message TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS command_queue_pending_idx
  ON command_queue(network_id, status, created_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  previous_status TEXT,
  new_status TEXT,
  result TEXT,
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_network_created_idx
  ON activity_logs(network_id, created_at DESC);

CREATE TABLE IF NOT EXISTS network_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS network_events_network_created_idx
  ON network_events(network_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'networks', 'routers', 'agents', 'network_users',
    'devices', 'access_rules', 'bandwidth_limits', 'command_queue'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I_set_updated_at ON %I;
       CREATE TRIGGER %I_set_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE routers ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bandwidth_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_network_member(net_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM network_members
    WHERE network_id = net_id AND profile_id = auth.uid()
  );
$$;

CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY networks_member_select ON networks
  FOR SELECT USING (is_network_member(id));

CREATE POLICY network_members_select ON network_members
  FOR SELECT USING (profile_id = auth.uid() OR is_network_member(network_id));

CREATE POLICY routers_member_select ON routers
  FOR SELECT USING (is_network_member(network_id));

CREATE POLICY agents_member_select ON agents
  FOR SELECT USING (is_network_member(network_id));

CREATE POLICY network_users_member_all ON network_users
  FOR ALL USING (is_network_member(network_id))
  WITH CHECK (is_network_member(network_id));

CREATE POLICY devices_member_all ON devices
  FOR ALL USING (is_network_member(network_id))
  WITH CHECK (is_network_member(network_id));

CREATE POLICY device_assignments_member_all ON device_assignments
  FOR ALL USING (is_network_member(network_id))
  WITH CHECK (is_network_member(network_id));

CREATE POLICY device_sessions_member_select ON device_sessions
  FOR SELECT USING (is_network_member(network_id));

CREATE POLICY access_rules_member_all ON access_rules
  FOR ALL USING (is_network_member(network_id))
  WITH CHECK (is_network_member(network_id));

CREATE POLICY bandwidth_limits_member_all ON bandwidth_limits
  FOR ALL USING (is_network_member(network_id))
  WITH CHECK (is_network_member(network_id));

CREATE POLICY usage_statistics_member_select ON usage_statistics
  FOR SELECT USING (is_network_member(network_id));

CREATE POLICY command_queue_member_select ON command_queue
  FOR SELECT USING (is_network_member(network_id));

CREATE POLICY activity_logs_member_select ON activity_logs
  FOR SELECT USING (is_network_member(network_id));

CREATE POLICY network_events_member_select ON network_events
  FOR SELECT USING (is_network_member(network_id));

-- Service role (API) bypasses RLS by default.
-- Frontend uses anon key + authenticated user JWT only.
