# Adaptive Revenue Recovery Engine

Hackathon prototype for adaptive payment recovery.

## Architecture

Synthetic / Razorpay payment event
        ↓
Recovery ML Engine
        ↓
Expected Net Recovery
        ↓
Deterministic Guardrails
        ↓
Agent Orchestrator
        ↓
Razorpay Test API / Mock Tools
        ↓
Payment status / webhook
        ↓
Re-evaluate or stop

### Important design principle

The LLM/agent does NOT decide financial policy by itself.

- ML Engine: predicts recovery outcomes.
- Decision layer: compares candidate interventions.
- Guardrails: enforce merchant policies.
- Agent: orchestrates approved actions and handles tool results.
- Razorpay: executes payment operations.

## Project status

Implemented:
- Synthetic dataset generation and audits
- Recovery prediction model
- Action-specific outcome models
- Expected net recovery
- Guardrails
- Mock agent workflow
- Re-evaluation workflow
- Razorpay test-mode Payment Link client scaffold

Next:
- Add your Test Mode credentials
- Run the Razorpay connection check
- Create a test Payment Link
- Add webhook/status handling
- Add Claude Agent SDK orchestration
- Build the demo dashboard

## Setup

### 1. Create virtual environment

Windows PowerShell:

    python -m venv .venv
    .\.venv\Scripts\Activate.ps1

macOS/Linux:

    python3 -m venv .venv
    source .venv/bin/activate

### 2. Install

    pip install -r backend/requirements.txt

### 3. Configure credentials

Copy `.env.example` to `.env`.

Put ONLY Razorpay TEST MODE credentials in `.env`.

Example:

    RAZORPAY_KEY_ID=rzp_test_xxxxxxxxx
    RAZORPAY_KEY_SECRET=xxxxxxxxx

Never commit `.env`.

### 4. Run connection check

    python backend/app.py

The first version only checks authentication and does not create a payment link.

### 5. Create a test Payment Link

After the connection check succeeds:

    python backend/create_test_link.py

Razorpay currently limits Test Mode Payment Links to 30 per business, so don't repeatedly run this command unnecessarily.

## Security

- Never put API secrets in source code.
- Never commit `.env`.
- Never use live credentials during development.
- Never send customer secrets to the LLM.
- Keep financial policy outside the LLM.


## Run the first complete live vertical slice

After the credentials test succeeds:

    python backend/demo_recovery.py

This runs:

    Engine recommendation
        -> Guardrails
        -> Agent
        -> Razorpay TEST API
        -> Payment Link

The live test intentionally creates only a ₹100 Test Mode Payment Link.


## Observe a Payment Link

The agent can now read the current state of a Payment Link without modifying it.

    python backend/observe_payment_link.py <PAYMENT_LINK_ID>

Razorpay exposes `GET /v1/payment_links/:id`. The response includes the
Payment Link status and captured payment details. Supported Payment Link
states include `created`, `partially_paid`, `expired`, `cancelled`, and `paid`.

For Test Mode, open the Payment Link in a browser and choose Success or
Failure to exercise the payment flow.


## Webhook receiver

The next stage is event-driven recovery.

Add a **dedicated webhook secret** to `.env`:

    RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

This is different from `RAZORPAY_KEY_SECRET`.

Start the local receiver:

    python backend/webhook_server.py

It listens at:

    POST http://127.0.0.1:8000/webhooks/razorpay

The receiver validates `X-Razorpay-Signature` using the raw request body
and tracks `x-razorpay-event-id` to avoid duplicate processing.

Razorpay cannot deliver a Dashboard webhook directly to localhost. For
the real Test Mode webhook test, expose this endpoint through a supported
public tunnel and configure the Test Mode webhook in the Razorpay Dashboard.


## Live Recovery Engine V3

The Razorpay `payment.failed` webhook now feeds the v3 recovery engine.
The live demo trains action-specific classifiers from `data/payments_v3.csv`,
ranks recovery actions by expected net recovery, applies guardrails, and then
lets the deterministic recovery agent execute the selected tool.

Run:

    python backend/webhook_server.py

Do not expose production credentials. This prototype is for Razorpay Test Mode.
