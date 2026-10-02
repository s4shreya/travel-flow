# TravelFlow

## A Travel Expense Reimbursement Platform for employees of Nortex Industries Ltd

**travel request → approvals → advance → settlement → finance review → payment**

---

## Design note

### Problem Statement

Nortex’s issue is not “another expense form.” It is the gap between a messy real trip (email approvals, advance, travel-desk bookings, receipts) and a blank settlement spreadsheet filled manually. That gap creates errors, slow approvals, and endless “where is my money?” follow-ups. The product keeps one **Travel Request ID** as the spine, turns the trip into a structured settlement claim, runs it through the policy approval matrix, and makes advance / payable / recoverable status obvious without chasing Finance.

### Assumptions

- Email + password login; employees are seeded from `docs/employee_master.csv`. Chaitanya Reddy (`NX-4471`) is the primary traveller.
- Travel and hotel are booked by the travel desk and are **company-paid**: they appear on the settlement as memo lines and are never reimbursed. The employee claims everything else (cabs, meals, entertainment, …).
- The estimate on the travel request counts **employee-paid heads only**; that total drives the approval band and the advance cap (up to 60%).
- Settlement math: employee claim − disallowed − advance released → **payable** to the employee or **recoverable** via payroll.
- Settlements skip the approval matrix and get a single review by Finance.
- Nobody acts on their own trip: an approver who holds a level is skipped to the next one up, and Finance / Admin cannot release, decline, pay or return money on their own trips.
- Inbox ingestion from the sample emails is out of scope; bills are uploaded (with OCR pre-fill) against the request.

### Next steps

- Estimate vs actual comparison on the settlement.
- Password reset, email/SMS notifications, payroll integration.
- Duplicate-bill detection across trips and stricter policy engines.
- Cloud storage for uploads and production hardening.

---

## The flow

1. **Travel request**: the employee fills trip details, estimated costs and an optional advance. Drafts save as-is; validation runs on submit.
2. **Approvals**: managers approve, reject or send back, in order, as per the approval matrix.
3. **Travel desk**: on final approval, travel and hotel are added to the settlement as company-paid lines.
4. **Advance**: Finance releases full or partial advance or declines it.
5. **Settlement**: the employee uploads bills (OCR pre-fills the expense), reviews policy checks and submits.
6. **Finance review**: Finance controller approves or sends it back.
7. **Payment**: Finance pays the balance or marks payroll recovery, and the trip closes.

## Features

- The progress tracker on every request shows the current step and who it is waiting for.
- Create / edit / track travel requests with estimated cost heads and advance request
- Approval chain by claimed amount (and international) per policy
- Trip approved → company-paid travel (onward + return) and hotel heads seeded on the settlement → employee notified
- Finance releases or declines the advance → employee notified
- Settlement form (lodging, transport, other) + receipt upload as proof
- Receipt scanning: Tesseract OCR → rule-based category (lodging / transport / meals) → pre-filled expense line, checked against policy NTX-HR-POL-11 (lodging & meal limits, non-reimbursable items, air via travel desk, trip dates, duplicates, 7-day window). Over-limit parts are shown as disallowed for the employee to review
- Settlement review by the Finance Controller (single step, no approval matrix) + Finance payment / recovery
- Role-based dashboard, approvals inbox, in-app notifications

## Stack

React 19 + Vite + Tailwind · FastAPI + SQLAlchemy + Alembic · PostgreSQL · Tesseract OCR

## Quick start


```bash
# backend
cd backend
cp .env.example .env         
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head 
uvicorn main:app --reload --port 8000

# frontend
cd frontend
npm install
npm run dev
```

App: http://localhost:5173 · API docs: http://localhost:8000/docs

## Demo logins

Password for everyone: `Nortex@2026`

| Role                           | Email                                      |
| ------------------------------ | ------------------------------------------ |
| Employee                       | `chaitanya@nortex.com`                     |
| Reporting Manager              | `suresh@nortex.com`                        |
| HoD / HoDiv / MD               | `meera@` / `arvind@` / `nandita@nortex.com` |
| Finance                        | `ravi@nortex.com`, `kavitha@nortex.com`    |
| Admin                          | `admin@nortex.com`                         |

## Project layout

```
backend/    FastAPI app (core/, database/, src/ feature modules)
frontend/   React app (api/, components/, features/, lib/)
docs/       problem statement, expense policy, employee master
```
