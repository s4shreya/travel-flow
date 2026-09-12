# TravelFlow

## A Travel Expense Reimbursement Platform for employees of Nortex Industries Ltd

**travel request → advance → settlement → approval → payment**

---

## Design note

### Problem Statement

Nortex’s issue is not “another expense form.” It is the gap between a messy real trip (email approvals, advance, travel-desk bookings, receipts) and a blank settlement spreadsheet filled manually. That gap creates errors, slow approvals, and endless “where is my money?” follow-ups. The product should keep one **Travel Request ID** as the spine, turn the trip into a structured settlement claim, run it through the policy approval matrix, and make advance / payable / recoverable status obvious without chasing Finance.

### Assumptions

- Demo auth: switch profile via employee code (`X-Employee-Code`); no SSO/JWT.
- Employees are seeded from `employee_master.csv`; Chaitanya Reddy (`NX-4471`) is the primary traveller.
- Air and hotel are booked by the travel desk and are **company-paid** (memo on the settlement, not reimbursed). Employee claims cabs, meals, entertainment, etc.
- Advance (up to 60% of estimated cost) is released by Finance; settlement math is: employee claim − disallowed − advance released → payable or recoverable.
- Approvals follow the policy value bands (RM → HoD → HoDiv → MD) plus Finance on settlements; an approver cannot approve their own claim (level skip).
- OCR / inbox ingestion from the sample emails is out of scope for a working end-to-end demo; receipts are uploaded and expense lines entered manually against the request.

### What I built

- **Travel request** create / edit / track with estimated heads, advance request, and sequential approvals.
- **Finance advance release**; on first release, seed company-paid flight + hotel on the settlement draft and notify the employee (two notifications: advance released, desk bookings).
- **Settlement form** (lodging / transport / other), receipt upload + confirm as proof, summary totals, submit into the same approval matrix + Finance verification.
- **Finance settlement payment / payroll recovery** queue; closing payment notifies the requester and closes the trip.
- Role-based dashboard (employee, approver, Finance), approvals inbox, in-app notifications, and status labels so the employee can see where the claim sits.

Stack: React (Vite) + FastAPI + PostgreSQL.

### Next steps

- Extracting data from the emails / invoices / receipt using OCR.
- Real authentication, email/SMS notifications, payroll integration.
- Hard policy engines for meal caps, lodging per-night limits, duplicate-bill detection.
- Durable object storage for uploads (local disk only); production deploy hardening (CORS/Redis/S3).

---

## Stack

| Layer       | Tech                                                  |
| ----------- | ----------------------------------------------------- |
| Frontend    | React 19, Vite, Tailwind, React Router                |
| Backend     | FastAPI, SQLAlchemy, Alembic                          |
| Database    | PostgreSQL                                            |
| Auth (demo) | `X-Employee-Code` header (profile switcher in the UI) |

## Features

- Create / edit / track travel requests with estimated cost heads and advance request
- Approval chain by claimed amount (and international) per policy
- Finance releases advance → desk flight + hotel seeded as company-paid → employee notified
- Settlement form (lodging, transport, other) + receipt upload as proof
- Settlement approvals + Finance payment / recovery
- Role-based dashboard, approvals inbox, in-app notifications

## Quick start

### Prerequisites

- Python 3.11+
- Node 20+
- PostgreSQL
- Redis (used by backend config at startup; local Redis is fine for demo)

### 1. Database

Create a PostgreSQL database, then from `backend/`:

```bash
cp .env.example .env
# edit .env if your DB user/password differ

python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
```

### 2. API

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

**Example:** Chaitanya create a travel request → approve as managers → Finance release advance → upload receipts / fill settlement → approve settlement → Finance release payment or recovery.

## Project layout

```
backend/          FastAPI app, Alembic, uploads/
frontend/         Vite React app
docs/             Problem statement, policy, employee master
```
