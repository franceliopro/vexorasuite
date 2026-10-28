# Véxora Suite — working agreement

## Development workflow requested by the owner
- Develop this project directly through GitHub branches, commits and pull requests. Do not use a local checkout or local files as a development stage.
- Read the relevant source from the current integration branch and preserve unrelated changes. Use an expected head SHA when updating refs or merging.
- Run tests, database migrations, concurrency regressions and builds through GitHub Actions. Repair failures in the PR before merging.
- The operational integration branch is foundation/bootstrap-monorepo. Do not move work to main or modify the old Véxora Matriz.
- A merge may trigger Dokploy, but do not claim the site deployed or integrations worked without checking evidence.

## Product rules
- Rastreabem is a test company and segment reference, never the global identity or compulsory default flow.
- Departments and human attendants can load reusable patterns. Attendants inherit patterns from their current departments; preserve separate contexts when one attendant works in two finance departments.
- Prefer deterministic rules before calling an AI model. Keep human-owned conversations under human control.
- Every connection, resource, credential, query and operation is tenant-scoped. Never copy credentials, contacts or production sessions to a newly created company.
- Public descriptions must distinguish configured, executed, confirmed, ambiguous and failed operations. Never claim payment, publication, delivery or a live connection from a configuration flag alone.
- Keep the UI concise, consistent and responsive. Use expandable sections for details and keep implementation details out of ordinary product flows.
- Consult docs/implementation-register.md for the consolidated requirements. An unchecked item is not automatically an instruction to perform a real external transaction or publish content to customers.
