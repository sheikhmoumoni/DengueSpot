# Data classification and processing inventory

| Class | Fields | Access | Storage/cache |
|---|---|---|---|
| Public | opaque report ID, category, coarse point, reviewed description/status | everyone | public DTO; no private cache |
| Personal | optional authenticated profile ID, description, recognizable photo | purpose-limited | server / device draft |
| Sensitive | exact GPS and accuracy, unreviewed original | reporter and scoped officers only | separate private table / private object |
| Secret | tracking token, session, provider keys, signing pepper | credential owner / server | hashes or secret manager; no logs |
| Compliance | consent versions, event chain, access records | scoped governance | append-only records |

Local demo files are private server state, ignored by Git. Device drafts may contain photo/GPS but no authentication secrets or phone. Shared-device users must be offered discard. Optional providers receive a privacy-reviewed derivative without identity/GPS; processors and international transfers need approval before enabling them. No optional vendor is required to submit.
