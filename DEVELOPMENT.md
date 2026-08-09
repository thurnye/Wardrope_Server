# Wardrope Development Rules

Wardrope treats security, privacy, maintainability, and tested behavior as release requirements.

## Decision rules

1. Start from the user/data threat model, not from UI convenience.
2. Enforce authentication, authorization, validation, and business rules on the server.
3. Prefer secure defaults and least privilege. A missing security dependency should fail closed rather than silently downgrade protection.
4. Keep provider-specific infrastructure behind Core interfaces. Controllers do not call AWS, MongoDB, AI, or weather SDKs directly.
5. Keep functions and modules focused. Split responsibilities when a contract becomes unrelated to its original purpose.
6. Use explicit names and explicit data contracts. Avoid hidden side effects, magic values, and generic helpers that obscure security decisions.
7. Validate untrusted input at every trust boundary and allowlist accepted fields, formats, identifiers, query options, file types, and outbound destinations.
8. Never trust browser ownership identifiers, filenames, MIME declarations, redirects, URLs, or client-side validation as security controls.
9. Minimize collected and returned data. Do not persist sensitive/profile facts unless the feature needs them.
10. Never expose secrets, internal storage references, raw provider errors, stack traces, tokens, or credentials to the browser or logs.
11. Treat dependencies and CI/CD as part of the supply chain. Review packages, pin CI actions, run dependency audits, and remove unused dependencies.
12. Implement the whole failure model: provider failure, persistence failure, concurrency conflict, unauthorized/wrong-owner access, malformed input, oversized input, retries, and cleanup/compensation.
13. Add tests with the implementation. A feature is incomplete when only the happy path works.
14. Refactor when an audit finds a cleaner or safer boundary. Existing code is not protected from revision merely because it already works.
15. Do not merge on assumption. The exact final PR head must pass required CI checks before merge.

## Security review lens

Every feature review considers, where applicable:

- broken access control and IDOR/BOLA-style ownership failures;
- cryptographic and secret-handling failures;
- injection and unsafe query construction;
- insecure design/business-rule bypasses;
- security misconfiguration and unsafe cloud permissions;
- vulnerable/outdated components and CI/CD integrity;
- authentication/session failures and CSRF;
- software/data integrity and upload handling;
- insufficient security logging/monitoring without leaking sensitive data;
- SSRF or unsafe server-side outbound requests;
- XSS/output handling and browser security headers;
- privacy/data-minimization and retention concerns;
- concurrency, partial failure, and cross-system consistency.

## Code review lens

Reviewers should be able to answer:

- Does each class/module have one coherent responsibility?
- Is the dependency direction obvious and consistent with the N-tier architecture?
- Can a caller misuse the API or bypass an invariant?
- Are names and types specific enough to explain intent without comments?
- Are error paths deterministic and safe?
- Is duplicated policy centralized without creating an over-general abstraction?
- Are tests checking behavior and security boundaries rather than implementation trivia?
- Are there dead branches, placeholders, TODO-only flows, unused packages, or controls that look finished but do nothing?

## Supplementary references requested for this project

Security and privacy review:

- https://medium.com/@Alabuja/understanding-the-owasp-top-10-a-developers-guide-to-safer-web-applications-6c27cbab2b9a
- https://medium.com/probely/web-application-security-checklist-ee0479bf60c6

Code quality and development discipline:

- https://www.callstack.com/blog/12-rules-and-approaches-of-code-writing-for-beginners
- https://medium.com/better-programming/14-rules-that-every-developer-should-stick-to-14ee267052ca
- https://medium.com/@jayeshsanghani88/5-powerful-rules-every-developer-should-follow-to-write-clean-code-5b2c6e5df24f

These are supplementary review aids. Project-specific threat modeling, primary framework/cloud documentation, tests, and stronger security requirements take precedence when guidance conflicts.
