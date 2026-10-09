# Simulator routing selection

The routing panel uses shared Section, Field, Input, RadioGroup, Select, Badge and
EmptyState components. All controls have associated labels, keyboard operation,
44px targets and shared theme tokens. Matching routes retain the existing surface
filtering and priority order.

The page-state hook owns model, tool and route-group selection. Filtering changes
the available choices while retaining the selected model's label and routing target.
A retained selection outside the filter is explicitly described. The match count
continues to represent the filter result.

After the complete catalog is ready, an unavailable saved model or route group
remains visible with a field error. Sending is blocked until the user explicitly
selects an available value. The durable selection is preserved during the error;
an unavailable group is never changed to default by a catalog effect. Selecting a
model or invocation kind retains its existing explicit group-clear behavior.

Default routing accepts both the empty and declared default group representations.
Image and audio model selection retains its OpenAI protocol and corresponding
template transitions. Tools retain their endpoint and tool-specific body template.
Models with no active route retain their existing preview and diagnostic behavior;
unavailable saved choices are distinct from a valid model with no matching routes.

This batch preserves the request sender, Stop function, connection preferences,
complete-body read owners and API contracts. It consumes the verified
`@xsec/ui-react` 0.1.6 tarball, which constrains long Select labels to the available
viewport. The dependency lock updates only this public package; the previous
tarball remains available for rollback. Real acceptance
uses isolated PostgreSQL, production Next and Chromium. Provider requests are not
dispatched by routing acceptance. The sender and its billing/streaming lifecycle
are the following migration scope.

Reverting this batch and rebuilding restores the previous routing panel and its
selection behavior. The versioned settings schema and retained legacy records are
unchanged; rollback has no gateway account, billing or request-log migration.
