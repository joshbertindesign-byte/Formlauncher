# Email groundwork (0.70.0): steps 1 and 2 of the responsibility-center email roadmap

Built from `docs/roadmap/responsibility-center-email.md`. **Nothing sends email yet.** This release adds the rules and the files a sender will use.

## What is built

| Where | What |
|---|---|
| Approved domains | A built-in structure `approved-domains` holding one list of domains. Admin only; every change is an entry, so history stays. An empty list means no email may be sent. Domains are lower-cased and checked (a plain host name, no `@`, no wildcard, no duplicates, at most 50). |
| `FP.email.checkAddress` | One plain address only. The part after the **last** `@` must equal a listed domain exactly (case-insensitive), so `evilcompany.com` does not match `company.com` and a subdomain must be listed itself. Refuses several addresses, display names, quotes, brackets, spaces, a second `@`. |
| `FP.email.queue` | Builds a version 1 email job and writes it whole, in one write, to `outbox/email/<jobId>.json` on the shared folder. Job IDs are `YYYYMMDD-<terminal>-<6 base-36>` and are checked for uniqueness. Addresses outside the list are **dropped** and reported; if none is left nothing is written. Subject is capped at 200 characters; at most 50 recipients; attachment paths must start with `media/`, with no `..`, backslash or absolute path, at most 10 files and 10 MB in all. |
| `FP.email.status` / `list` | Read a job's state: `queued` (in `outbox/email` or `outbox/processing`), `done` or `failed` (the folders), or the sender's `status/<jobId>.json` (`sent`, `failed`, `rejected`). `list` returns the newest 200. |
| People | An optional `email` on a person (`FP.users.create`, admin-only `FP.users.setEmail`, Admin > People). It must pass the approved-domain check. Never shown on the sign-in screen. Existing people are unchanged. |
| Admin > Email | The domain list (add and remove, who last changed it and when), a note that nothing sends yet, and a read-only queue table (job, recipients, subject, state). |

## Decisions made on the way (change any)

1. `checkAddress` is synchronous and uses the list last read; `checkAddressNow` reads the list first. The user checks and `queue` always read fresh.
2. A person's email shows as the row's tooltip and in map search, not as a visible chip.
3. An attachment with no size is looked up in the media folder and refused if missing (the platform must write it before queueing).
4. Saving an unchanged domain list writes nothing.

## Not built yet (the roadmap's later steps)

The rule-preview problem display for addresses outside the list; the **sender script** on the host (it waits on the sender mailbox and script ownership decisions, see the roadmap); responsibility-center email through the ladder; composition (templates, footers); attachments from the media library; heartbeat and domain-mismatch warnings in the health report.

## Tests

`l185` (address and domain rules), `l186` (job shape, dropped addresses, attachments, status and list with a simulated sender), `l187` (the Admin Email tab, a person's email, the queue, a plain user refused).
