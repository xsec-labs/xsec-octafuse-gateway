CREATE TABLE admin_sessions (
    token_hash TEXT PRIMARY KEY NOT NULL,
    credential_hash TEXT NOT NULL,
    expires_at BIGINT NOT NULL
);
CREATE INDEX idx_admin_sessions_expiry ON admin_sessions (expires_at);
