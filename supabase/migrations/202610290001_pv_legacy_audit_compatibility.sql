-- The deployed Structured Review release still appends service-role audit rows.
-- Retain that existing server-only INSERT permission while newer code uses the
-- serialized append RPC. Immutable UPDATE/DELETE protections remain in force.
-- Do not activate the background worker as part of this schema repair.
grant insert on public.pv_audit_events to service_role;
