# Simulator connection and key setup

The connection and API key panels use the shared Section, Field, Input, RadioGroup,
Select, ControlButton, Spinner, Badge, EmptyState and ErrorState components. Controls
have associated labels, 44px targets, shared theme tokens and keyboard focus recovery.
The remaining routing, request and response panels retain their current component
contracts and are subsequent migration scopes.

## Read ownership

Models and routes form one atomic catalog. Both requests run in parallel under one
AbortController and a 20-second complete-body deadline. Validation uses the public
model and route catalogs, checks Simulator's required model fields, and rejects routes
whose model is absent. Catalog failure blocks the workbench; an explicit read action
starts a new attempt.

Key lists and details each reuse useShellRequest, which owns cancellation, current
request identity and a 20-second complete-body deadline. Email replacement cancels
the previous list and detail, clears the prior selection and credential, and exposes
only the new list. Refresh clears the previous rows and credential before reading.
The detail read starts only for a selected row in the current successful list; changing
the row cancels the prior read immediately. Its response must contain the requested
row id and a valid API key. SPA exit cancels all three read owners. HTTP 401 transfers
control to the existing authentication owner at the current URL.

The page exposes explicit loading, empty and failure states. Failed reads cannot
enable sending. The list cap remains 200 rows; the total and existing limit hint
describe larger collections. The actual API credential remains in memory; setup
feedback displays the ready state. Request sender and wire-header redaction retain
their existing implementations.

## Persistence and rollback

The durable record is octafuse.simulator.settings.v1 with version 1, proxyBaseUrl,
protocol, modelId, routeGroup, keyId, invokeKind and toolId. It stores the selected row
id, and never stores the revealed API credential. A missing v1 record imports the
seven existing octafuse.simulator records using declared defaults for absent fields.
The import validates the entire record before restoration. Existing records remain
intact for a code rollback; subsequent updates write one v1 record.

Malformed JSON, versions, protocol, invocation kind and tool id fail explicitly.
Read or write errors block the workbench and present a stable error code. Reading
again restores the last durable settings. Resetting writes the declared defaults to
v1 while preserving the seven legacy records. If that write fails, the error remains.

To roll back, revert this batch and rebuild. The previous code reads its retained
legacy records. Changes saved only in v1 remain available when this batch is restored;
the previous code will show its older legacy selections. Neither rollback nor the
explicit reset alters gateway accounts, credentials, billing or request records.

## Verification scope

Acceptance uses production Next, isolated PostgreSQL, real browser storage and
Chromium. Forwarding transport controls hold or disconnect actual response bytes;
they do not synthesize API success. Database failures and expired sessions originate
from the isolated database. Evidence is held in the task's octafuse-simulator-setup-ui
directory, including raw failed phases, source and runtime hashes, resource reports,
visual samples, same-input performance samples and finite retention observations.

This batch's final validation and cost decision are recorded in the shared migration
ledger and candidate acceptance state. Provider success, billing delivery, request
streaming and server-to-provider cancellation belong to the subsequent sender scope.
Other databases, platforms, browsers, screen readers, native IME, mobile performance
and deployment require their own acceptance evidence.
