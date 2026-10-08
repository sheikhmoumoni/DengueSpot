# Privacy model

Purpose: route and remediate suspected environmental breeding conditions. Collect minimal photo, category, exact GPS, accuracy and optional text. Do not collect clinical data or national identifiers. Exact location is treated as sensitive, independently of an unverified legal interpretation in the supplied blueprint.

Consent `2026-10-v1` explicitly covers photo/location for review and routing, public approximate area and approved evidence. Optional AI and SMS are off by default; their separate opt-in UI is not wired yet. No uploads before affirmative consent. Record version, time and purpose. Withdrawal disables optional processing; deletion removes primary media/private coordinates and report content. Minimal report tombstones, token hashes, receipts and immutable events/audit identifiers remain. Existing officer notes are immutable and could contain personal text, so a legally reviewed note-erasure design and separate retention basis remain release requirements.

Public grid defaults to 150 m. Coarsening reduces precision; it does not guarantee anonymity. Public descriptions are held until human review because text can disclose exact addresses or identities. Derivative image metadata is removed; absent a configured redactor, media is private until an authorized reviewer attests it safe. Public maps do not identify reporters. Small aggregate cells are suppressed.

Rights use authenticated ownership or a high-entropy private token, never a public report ID alone. Tokens are hashed with a secret pepper. Download includes only the caller's data. Rights/status responses use no-store. Contact is a configuration placeholder, not a fabricated institution.

Production gate: Bangladesh-qualified counsel must validate applicable law, legal basis, notices, consent, retention, processors, cross-border transfers, rights verification and notification obligations. No statutory deadline is asserted by this scaffold.
