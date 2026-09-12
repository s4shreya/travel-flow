# Screen recording script (3–5 minutes)

**Goal:** Show one Travel Request ID end to end — request → approvals → advance → settlement → payment — without chasing Finance.

**Prep before record**
- App running; start as **Chaitanya Reddy (`NX-4471`)**.
- Have one receipt image ready to upload.
- Prefer a **fresh** travel request so status changes are visible (or reuse a draft you can submit).
- Speak calmly; click slowly; zoom browser to ~110% if needed.

**Suggested length:** ~4 minutes. Cut greetings if you run long.

---

## 0:00–0:25 — Hook + what this is

**Say:**  
“Nortex employees today rebuild a trip from email into a blank settlement spreadsheet. TravelFlow keeps one Travel Request ID as the spine — request, advance, desk bookings, settlement, approvals, and payment status in one place.”

**Show:** Dashboard as Chaitanya. Point at Create / Track tiles.

---

## 0:25–1:05 — Create travel request

**Do:** Create travel request → fill destination, dates, purpose, category, mode → estimated heads (e.g. flight/hotel company, meals/cabs employee) → advance (within 60%) → submit.

**Say:**  
“Employee raises the request with estimated cost heads and an advance. On submit, the policy approval chain is created from the estimated amount — no email ping-pong.”

**Show:** Success with request ID and pending approvers. Copy or note the ID (e.g. `TRQ-2026-00xx`).

---

## 1:05–1:45 — Approvals (persona switch)

**Do:** Switch to **Suresh Iyer (`NX-2210`)** → Approvals → open the request → Approve.  
If a second level is needed, switch to **Meera (`NX-1108`)** → Approve again.  
(Skip extra levels if your demo amount only needs RM.)

**Say:**  
“Approvers open the same request form read-only, then approve, return, or reject. Levels follow the expense policy bands.”

**Show:** Briefly the form view + Approve → success “Request approved.”

---

## 1:45–2:20 — Finance releases advance

**Do:** Switch to **Ravi Menon (`NX-3305`)** → Release funds → Release remaining advance for that ID.

**Say:**  
“Finance disburses the advance against the Travel Request ID. On first release, we treat travel-desk flight and hotel as company-paid lines on the settlement draft — memo only, not reimbursed to the employee.”

**Show:** Advance queue action completing.

---

## 2:20–2:50 — Employee notifications + trip workspace

**Do:** Switch back to **Chaitanya** → open notifications.

**Say:**  
“Two notifications: advance released, and travel desk booked flight and hotel. Status is push, not ‘chase Finance.’”

**Show:** Both notification titles → open the travel request detail.

---

## 2:50–3:50 — Settlement + receipt

**Do:** On the request → upload a receipt → fill expense line (e.g. meals/other) → save to settlement → Open settlement form.

**Say:**  
“Employee uploads proof and adds employee-paid lines. Desk flight and hotel are already there as company-paid. Summary: employee claim minus disallowed minus advance released equals amount payable — or recoverable if the advance was higher.”

**Show:** Settlement tables + summary (point at net, advance drawn, payable/recoverable) → Save draft → Submit settlement.

---

## 3:50–4:30 — Settlement approval + payment

**Do:** As needed, approve settlement as manager(s) / Finance (Ravi).  
Then as Finance → Release settlement payment (or note payroll recovery).

**Say:**  
“Settlement reuses the approval matrix, then Finance. Closing payment notifies the employee and closes the trip — payable or recovery is explicit on the claim.”

**Show:** Finance settlement queue action → optional quick switch to Chaitanya notification / track list showing closed or paid.

---

## 4:30–4:50 — Close

**Say:**  
“That’s the full loop on one ID: request, approve, advance, settle, pay. What I left out on purpose — email OCR, real SSO, and automated policy disallowances — is in the README. Thanks.”

**Show:** Track list or dashboard for 2 seconds → stop.

---

## Timing cheatsheet

| Segment | Time |
|---|---|
| Hook | 0:25 |
| Create request | 0:40 |
| Approvals | 0:40 |
| Advance | 0:35 |
| Notifications | 0:30 |
| Settlement | 1:00 |
| Pay / close | 0:40 |
| Outro | 0:20 |
| **Total** | **~4:30** |

If over 5 minutes: skip HoD approval (use a low estimate), skip “save draft,” and don’t linger on every field.

## Recording tips

- Narrate *why* (ID spine, no spreadsheet, no follow-ups), not every click label.
- If something fails, don’t apologize on camera — cut, fix, resume from that beat.
- Export 1080p; title the file `TravelFlow-demo-walkthrough.mp4`.
