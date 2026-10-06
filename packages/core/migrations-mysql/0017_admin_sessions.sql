CREATE TABLE admin_sessions (
    token_hash CHAR(64) PRIMARY KEY NOT NULL,
    credential_hash CHAR(64) NOT NULL,
    expires_at BIGINT NOT NULL,
    INDEX idx_admin_sessions_expiry (expires_at)
);
