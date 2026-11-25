# Roadmap: Responsibility-center email

Status: **Proposed. Design handed over 25 Nov 2026; reality-checked against kernel 0.69.0 below. Decisions marked open need the owner.** The handoff text follows the reality check, with the parts that changed since it was written corrected and marked.

## Reality check against the code (0.69.0)

| Handoff says | The code today |
|---|---|
| "Responsibility centers with email flow-up: not a feature yet" | **Centers exist** (0.56, `fp-due.js`, built-in structure `centers`) with members (people, role, departments, whoever is signed in somewhere) and duties. **An escalation ladder exists** (0.62): levels with `after` (minutes since a miss), `tell` ({ centers, role, departments, people }) and `ack` (needs acknowledging). `FP.alerts.whoIsTold` resolves a level to people. Alerts show on terminals and in Admin. What is missing is **email as a way of telling**, and a parent/child link between centers (a level can already name other centers). |
| "Does flow-up send to all ancestors at once, or escalate after a delay?" | The ladder **already is the delay-based escalation**, with acknowledgement. Recommended answer: email is another channel of a ladder level, sent when the level fires, and a level is "up" because it names a higher center. No separate parent field is needed. (Open decision 2.) |
| "The users structure can hold an email address" | **It cannot yet.** A user has name, department, roles, active, PIN, away dates. An optional `email` value has to be added to people (Admin > People, the users structure, the pack format), validated as one plain address in an approved domain. |
| "Email job, outbox, status files" | **Nothing is written today.** `fp-due.js` and the form editor mention emails and an "Admin › Automation Send flow"; no code writes a job file. `FP.outbox` in the code is the terminal's own queue of unsaved entries, not the `outbox/email/` folder here. |
| "Approved-domain definition type" | Does not exist. Recommended shape: a built-in structure (`approved-domains`, one item holding a list), edited by admins only, like `centers` and `terminal-groups`: every change is an entry, so history and revert come for free. A new definition kind in the library is a larger change for no gain. (Implementation choice, change if you disagree.) |
| "Storage today: a OneDrive-synced SharePoint library" | **Out of date.** Since November 2026 the data folder is a shared Windows folder on an always-on host PC (`docs/DEPLOYMENT.md`). That also settles decision 1 (host): the sender script runs on that always-on host. |

## Decisions

1. **Host: decided.** An always-on host PC (the same one that holds the shared folder). Azure is not needed for this.
2. **Flow-up: decided (25 Nov 2026).** Email follows the existing ladder: a level emails when it fires, after its delay, until acknowledged. No separate parent field and no all-ancestors-at-once.
3. **Template ownership: decided (25 Nov 2026).** Templates stay tied to a structure; the center owns recipients, the email on/off flag and an optional footer.
4. **Approved mailbox list: answered in principle (25 Nov 2026).** One sender mailbox, delivered by Microsoft 365 direct send (port 25, no credentials) to the tenant's mail-protection endpoint; a test with `Send-MailMessage` from a PC on the company network arrived in the inbox. The platform refers to it by a short name (for example `forms-notifications`); the real sender address and mail endpoint are **host configuration owned by IT and are not kept in this repository**. **Checked 25 Nov 2026: the address used for that test is not a real mailbox** (a message sent to it bounced, `550 5.1.10 RecipientNotFound`); direct send accepts any sender address in the domain, so the tests worked, but a reply to an alert email would bounce. **Needed:** IT creates a real sender mailbox (a shared mailbox is free and several people can read it) and says who has access. Still to confirm after that: a test from the actual host PC on a wired connection.
5. **Script ownership (who maintains it, updates its domain list, watches the heartbeat): open.** Needed before step 3.

Steps 1 and 2 of the build order do not depend on decisions 4 and 5. Step 3 (the sender script) waits for them.

---

## The handoff (as received, with corrections marked)

Nov 25, 2026 · @Josh

## Summary and status

The platform will send email from the editor, with recipients and messages owned by responsibility centers, and a script on an always-on host will deliver it. Only one piece has been tested: direct send to the company's Microsoft 365 mail endpoint worked from a laptop. Everything else below is a proposal.

| Item | State |
| --- | --- |
| Email job and guard rails in the architecture spec (Automation dispatcher) | Specified. No email-job code found in kernel 0.60.0 or the 0.61–0.62 WIP zip |
| Sender script on an always-on host, replacing the Power Automate email flow | Proposed. Direct send tested by hand; no script written |
| Approved-domain definition type, admin-editable | Proposed |
| Responsibility centers with email flow-up | Proposed. Not a feature yet |
| Attachments from the media library and output forms | Proposed |
| Host: always-on machine or Azure | **Decided: always-on host PC** (25 Nov 2026) |

## Context and constraints

The platform has no server software, and OneDrive sync has proved unreliable, so the sender cannot assume a cloud service or a Power Automate gateway.

- **Storage today.** Static HTML launchers read and write JSON/JSONL files in a folder through the browser's folder access. *(Updated 25 Nov 2026: the folder is now a shared Windows folder on an always-on host PC, mapped as a drive on every terminal. See `docs/DEPLOYMENT.md`.)*
- **Observed sync failures (history).** The OneDrive-synced SharePoint library was unreliable: one PC's folder was a shortcut that never reached SharePoint, and the other terminal showed no sites or admins. That is why the data moved to a shared folder.
- **Hosting options under review.** A small always-on machine sharing a Windows folder, or Azure (Static Web Apps, Functions, a database, Blob). Azure needs IT approval. Port 445 is assumed closed, which rules out a cloud file share mapped as a drive.
- **Email transport.** The spec routes email through a Power Automate flow owned by a generic account. This document replaces that flow, for email only, with a script on the host. The job-file contract stays as the spec describes it: outbox, status files, unique job IDs, guard rails.
- **Not covered by the script.** SharePoint list writes, list reads and the weekly rollup stay with Power Automate or move to Azure. Email to people outside the company is also out of scope for direct send (see Sender script).

Spec sections to read first: Automation dispatcher (Power Automate), Templates, Recipients, Guard rails, and Ownership and trust.

## Approved domain

A new definition type, **approved domain**, lists the domains email may go to. Only admins can edit it, and it is versioned with history like other definitions, so a change can be seen and reverted.

1. **A list, not one value.** A rename or acquisition can then run old and new domains side by side.
2. **Exact match.** Compare the part after the last `@`, case-insensitive. Never test whether the address ends with the domain: `evilcompany.com` ends with `company.com`.
3. **One plain address per recipient.** Reject fields holding several addresses (`a@x.com;b@evil.com`), display-name forms (`"Name" <addr>`), and anything that does not parse as a single address.
4. **Platform check.** Addresses outside the list are dropped when the job is written and shown as a problem in the rule's preview, as the spec's guard rail already says.
5. **Second check in the sender script.** Anyone who can write into the outbox folder bypasses the platform check. The script therefore checks again against a domain list in a local config file that IT owns on the host. The editor's list can only narrow that list, never widen it.
6. **Keep the mail endpoint separate.** For Microsoft 365 direct send, the endpoint name is derived from the tenant domain (dots become hyphens, then `.mail.protection.outlook.com`), so a domain change can change it. It is a script setting, not part of the approved-domain type.

**Changing the domain.** An admin edits the type in the editor, and IT updates the script's local list and endpoint. Proposed safeguard: the script writes its active domain list into its heartbeat file, and the editor flags a mismatch with the approved-domain type.

## Responsibility centers and flow-up

When a center's email option is on, mail also flows up to the people in the group for the center above it. This is not a feature yet, and the spec has no such concept. It does have groups, recipient sources, and the built-in users structure, which can hold an email address.

**Proposed model**

- A center has a parent, a group of people, an email on/off flag, and its recipient addresses taken from those people through the users structure.
- Recipients for an event are the members of the center that owns the rule, plus each ancestor while its email flag is on.
- The terminal works out the addresses when the rule fires and writes finished addresses into the job, as the spec already does. The sender script never walks the hierarchy.
- Addresses are merged, so one person in several groups gets one email.

**Questions to settle before building**

| Question | Why it matters |
| --- | --- |
| Does flow-up send to all ancestors at once, or escalate after a delay if nobody acts? | Escalation needs scheduled jobs. The spec has `run_after` for one-off jobs |
| Do upper levels get every email, or a digest? | A busy line could flood managers. The spec's throttle and once-per-record settings may be enough |
| What happens when a group is empty? | Suggest a publish-time warning in the rule preview, not a silent skip |
| Can the hierarchy loop? | Block loops at publish, as loops between functions are already blocked |
| Who may change a center's group or flag? | It decides who can cause mail to reach whom |

## Composing emails

Messages are written in the responsibility center in the editor, with live strings from structures, functions and lookups, and the same for the subject line. The spec's templates already do most of this, with one conflict to resolve.

**What the spec already provides**

- Placeholders: `{name}` inserts a value and `{= formula}` a formula's result.
- Blocks instead of HTML: `[fields …]` a table of chosen values, `[changes]` a before and after table, `[link]` the record link.
- One tested, Outlook-safe renderer. Nobody writes HTML, and arbitrary links and markup are refused.
- A preview against a recent real item before anything sends.

**The conflict.** Each template names the structure it is for, so every placeholder can be checked at publish, and a template naming a value that does not exist cannot be published. A message owned by a center can fire from many structures, so that check has nothing to compare against.

**Recommendation**

- Templates stay tied to a structure.
- The center owns the recipients, the email on/off flag, and an optional signature or footer block added to every email it sends.
- If centers must hold their own templates, key each template to the structure it applies to.

The platform renders the final subject and body when the rule fires. The sender script never interprets placeholders and sends exactly what the editor preview showed.

## Attachments and media

Attachments come from the media library and from output forms such as a signature or a user photo. The platform must write every referenced file into the media folder before it writes the job, because the script can only send files it can read.

- **Attached or inline.** A file attached to the message is simple. An image inside the body, such as a signature graphic or a photo, is an inline image, which is harder to make reliable in Outlook. Render signatures as styled text where possible, and send photos as attachments or links.
- **Output forms.** The terminal renders the form, saves it into the media folder when the job is written, and the job references the saved file by path.
- **Relevant-media list.** Tag media items with the responsibility centers and sites they apply to, and show the picker only the intersection. The spec already gives media rules a site scope, so check whether that mechanism can carry a center tag before adding a new one.
- **Guard rails from the spec.** Paths must stay inside the media folder (`..` is rejected), with a size cap, and anything larger goes as a link. The script repeats these checks.
- **Message size.** Keep total attachments per email under about 10 MB until IT confirms the mail system's limit.

## Email job file, version 1 (proposed)

The spec lists what an email job carries (mailbox from an approved list, recipients or groups, subject, rendered HTML body, attachment paths) but not exact field names, and no code writes one yet. This is a starting shape for the platform and the script to agree on.

```json
{
  "version": 1,
  "action": "email",
  "jobId": "20261125-T05-000123",
  "createdAt": "2026-11-25T14:03:11Z",
  "mailbox": "forms-notifications",
  "to": ["person@company.com"],
  "cc": [],
  "subject": "OD check failed: P-1042 on Line 3",
  "bodyHtml": "<rendered by the platform>",
  "bodyText": "<plain-text version>",
  "attachments": [{ "path": "media/files/2026-11/abc-report.pdf", "name": "Report.pdf" }],
  "runAfter": null,
  "source": { "rule": "od-fail", "center": "molding", "entryId": "..." }
}
```

- `mailbox` names an entry on the approved-mailbox list. The script maps it to a real sender address from its own config, so a job can never choose an arbitrary sender.
- `jobId` is unique and stable. It is how the script and the platform avoid duplicates.
- `to` and `cc` hold finished addresses, already checked against the approved domain.
- `version` allows schema changes. The script rejects versions it does not know.

**Folders and states**

| Folder | Meaning |
| --- | --- |
| `outbox/email/` | New jobs written by terminals |
| `outbox/processing/` | Claimed by the script, being sent. Moving a job here stops a second pass from sending it twice, as the spec describes |
| `outbox/done/` | Sent. The job ID stays here so a repeat is ignored |
| `outbox/failed/` | Rejected or exhausted retries |
| `status/{jobId}.json` | One small file per job: `state` (sent, failed or rejected), `at`, `attempts`, `detail` |

The platform reads the status file and records the outcome on the record, as the spec already says: queued when the job is written, then sent or failed.

## Sender script behavior

A PowerShell script on the host reads jobs from the outbox and sends them. The design assumes the host stays on and the script is the only sender.

**Running it**

- One long-running script started at boot as a scheduled task, set to run whether or not anyone is logged on, with automatic restart on failure. It wakes every 15 to 60 seconds. The spec's flow ticks every 5 to 15 minutes, so this is faster than the design needs. Idle load is negligible; expect tens of megabytes of memory.
- Use a wired network connection on the host.

**For each job file**

1. Wait until the file size stops changing, then confirm it parses as JSON. A half-written file is left for the next pass.
2. Claim it by moving it to `outbox/processing/`.
3. Validate: known `version` and `action`, `mailbox` on the approved list, every address passes the approved-domain rule, attachment paths stay inside the media folder and under the size cap, `runAfter` has passed, and the `jobId` is not already in `done/`.
4. Send through the transport adapter, with a short pause between messages. Start at a few messages a minute until IT confirms the mail system's throttle.
5. Write `status/{jobId}.json`, then move the job to `done/` or `failed/`. Retry transient errors a few times with growing delays, then fail.
6. Delivery is at-least-once. The `jobId` check in step 3 and the status file make a repeat harmless.

**Operations**

- Heartbeat file with the time, script version and active domain list, so the platform's data health report can show "bridge silent for 10 minutes".
- A log file with rotation. No credentials in the script. If one is ever needed, use the Windows credential store.
- If the host is off, jobs wait in the outbox and go out when it returns. Nothing is lost.

**Transport adapter.** Keep sending behind one function. Microsoft 365 direct send reaches only recipients inside the company's tenant, so it fits internal notifications and nothing else. External recipients, another business's mail system, or a move to Azure would change only this function (Microsoft Graph or authenticated SMTP). The job file and the status files stay the same.

## Verified results and open checks

One manual test passed on 2026-11-24 to 2026-11-25, run by hand from a laptop on Wi-Fi. No script was involved.

| Check | Result |
| --- | --- |
| Company mail records (MX) | Point to Proofpoint Essentials, which filters mail in front of Microsoft 365 |
| Microsoft 365 tenant mail endpoint | Name resolves, so the domain is registered in Microsoft 365 |
| Outbound port 25 to that endpoint | Open from the laptop |
| Direct send of a test message to the sender's own mailbox | Arrived in the inbox, not junk |
| SPF record | Allows Microsoft 365 and a Proofpoint dispatch host, ending in a hard fail (`-all`) |

**What the SPF record means.** Only Microsoft 365 and Proofpoint may send as the company domain. Do not add the host to SPF. Direct send to internal recipients works without it. Mail sent from the host straight to an outside server would fail the recipient's SPF check.

**Not yet verified**

- Direct send from the actual host machine on a wired network, which may be treated differently.
- IT's approval to use direct send for application email, and whether policy could disable it later.
- Mail volume limits and throttling for direct send.
- Attachments, and how rendered HTML looks in Outlook.
- Whether a Proofpoint or Exchange rule quarantines messages at higher volume.

## Decisions needed and build order

Five decisions are open. The first three block the script and the center model, and the rest can be built in order behind them.

**Decisions**

- [x] Host: an always-on host PC (decided 25 Nov 2026). The job-file contract still works with Azure later.
- [ ] Flow-up meaning: all ancestors at once, or escalation after a delay (see Responsibility centers).
- [ ] Template ownership: per structure with a center-owned footer, or center-owned templates keyed by structure.
- [ ] Approved mailbox list: which sender mailbox or mailboxes the script may use, and who owns them.
- [ ] Script ownership: who maintains it, updates its domain list, and watches the heartbeat.

**Suggested build order**

1. Approved-domain definition type, admin-only, with the platform-side check and rule-preview problem display.
2. Email job file and status-file schema in the platform, writing to the existing outbox. Record queued, then sent or failed, on the record.
3. Sender script v1 without attachments, with the second domain check, heartbeat and logging.
4. Responsibility center model: parent, group, email flag, merged recipients, empty-group warning.
5. Composition: center-owned footer and recipient rules, subject placeholders, publish-time checks.
6. Attachments: center and site tags on media, a filtered picker, rendering output forms into the media folder, and the script's attachment checks.
7. Heartbeat and domain-mismatch warnings in the data health report.
