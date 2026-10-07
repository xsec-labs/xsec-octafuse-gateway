# Simulator request and response

The request and response panels use shared Section, Field, Input, Textarea,
RadioGroup, ControlButton, Badge, Tabs and EmptyState components. Associated labels,
44px controls, keyboard tabs, a labelled wire disclosure and shared theme tokens
cover JSON editing, file selection, HTTP metadata and raw/merged responses.
Connection settings and routing retain their existing public UI.

The page-state hook owns one active request. A repeated send while that owner is
active does not start another request. Stop aborts that owner and waits for its
finalization before enabling Send. Leaving the page aborts the connection and
invalidates the owner; a completed body or finally block may update the page only
while it still owns that request. SSE readers release their lock in finally.

The total deadline covers headers and the complete JSON, text or SSE body.
Its default is 300 seconds, matching the Playground request control; users can
explicitly choose an integer from 1 to 3600 seconds. Invalid values block Send.
The deadline is local to the page and does not change persisted connection settings.
HTTP, malformed response, network, cancellation and timeout failures display stable
SIMULATOR error codes. Received stream text remains available after cancellation
or interruption. Starting the next request clears the preceding response.

Response log links capture the key, model, protocol, group or tool at send time.
Changing the next request's routing keeps the displayed response linked to its
original target. JSON editing and upload controls are disabled during sending.
Templates, request endpoints, multipart generation, header redaction and usage/image
parsers retain their existing contracts.

Acceptance uses production Next, real Chromium, isolated PostgreSQL and a real
loopback HTTP endpoint that returns errors or holds/disconnects response bodies.
These checks establish browser cancellation and error ownership. Live provider
success, billing, proxy-side cancellation and other platform/browser environments
require separate acceptance. Browser cancellation does not establish that an
upstream provider stopped work or ceased billing.

Reverting this batch and rebuilding restores the preceding panels and sender.
The settings format, gateway database schema and billing/logging storage are
unchanged, so rollback requires no data migration.
