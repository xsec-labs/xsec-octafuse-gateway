# Reliability analysis public UI

The reliability page uses the shared page header, controls, fields, tables, badges and read feedback. The provider table and model/provider table retain their aggregate columns, success-rate thresholds and money precision. Recent errors show the ten latest error records across all time; the selected range applies to the two reliability aggregates. The error-log link opens the existing request-log status filter.

Rolling and calendar presets apply a UTC API range. Custom fields display business-timezone wall-clock values, validate both boundaries and expose invalid input before issuing a read. Each date draft belongs to its applied range and timezone.

Reliability results and billing currency each own their request, cancellation, complete-body 20-second budget and explicit reload. Changing ranges or leaving the page cancels the previous owned read. Loading and failed aggregate reads hide prior results. Currency must be confirmed before amounts appear; other metrics remain visible if the independent currency read fails. A successful configuration without a currency entry retains the gateway's declared USD default. HTTP 401 is delivered to the existing session owner.

The response boundary validates identities, unique provider and model/provider rows, finite costs, counts, dates, latency values and success rates. Model identifiers are Map keys. Full error text wraps inside its table cell. Tables scroll within their panels and preserve the same light and dark design tokens at mobile widths.

PostgreSQL provider and model/provider reliability queries interpret the API's offset-free SQL boundaries as UTC. ISO and explicit-offset timestamps retain their meaning. This repair has an independent commit and a real PostgreSQL regression in UTC, Asia/Shanghai and America/Los_Angeles.

The UI uses the existing shared packages and lockfile. The Node production runtime and PostgreSQL path are the local acceptance targets. D1, MySQL, Docker, other operating systems and browsers, screen readers, touch, IME, browser zoom and mobile performance require their corresponding acceptance environments. Deployment has its own verification.

Revert the public UI commit and rebuild to restore the earlier page. Revert the independent UTC repair separately when required. The changes do not alter persisted records or the analytics API schema.
