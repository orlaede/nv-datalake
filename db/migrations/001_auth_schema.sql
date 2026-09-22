CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_format CHECK (position('@' IN email) > 1),
    CONSTRAINT users_full_name_not_blank CHECK (btrim(full_name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
    ON auth.users (lower(email));

CREATE TABLE IF NOT EXISTS auth.roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT roles_key_not_blank CHECK (btrim(role_key) <> ''),
    CONSTRAINT roles_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE IF NOT EXISTS auth.permissions (
    permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT permissions_key_not_blank CHECK (btrim(permission_key) <> ''),
    CONSTRAINT permissions_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE IF NOT EXISTS auth.user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES auth.roles(role_id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS user_roles_role_id_idx
    ON auth.user_roles (role_id);

CREATE TABLE IF NOT EXISTS auth.role_permissions (
    role_id UUID NOT NULL REFERENCES auth.roles(role_id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES auth.permissions(permission_id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx
    ON auth.role_permissions (permission_id);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by_token_id UUID REFERENCES auth.refresh_tokens(token_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
    ON auth.refresh_tokens (user_id);

CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx
    ON auth.refresh_tokens (expires_at);

CREATE TABLE IF NOT EXISTS auth.audit_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    actor_user_id UUID REFERENCES auth.users(user_id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES auth.users(user_id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT audit_events_type_not_blank CHECK (btrim(event_type) <> ''),
    CONSTRAINT audit_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS audit_events_created_at_idx
    ON auth.audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_actor_user_id_idx
    ON auth.audit_events (actor_user_id);

CREATE INDEX IF NOT EXISTS audit_events_target_user_id_idx
    ON auth.audit_events (target_user_id);
