# Nabz (نبض) — Product & Requirements Analysis

**Source document:** `docs/product-document.docx` — "سند جامع محصول «نبض» — پلتفرم مدیریت و تحلیل مالی شخصی، از دفترچه هزینه تا کوپایلوت مالی هوشمند", version 1.0.
**Status of this document:** analysis only. No technology choices, no architecture, no implementation.
**Convention:** Everything below is traced to the source. Where the source is silent, the item is explicitly marked **Not specified**. Nothing has been invented.

---

## 1. Product Overview

Nabz is a personal financial management application for Iranian users that lets them record income and expenses quickly, understand where their money actually goes, set budgets, plan for financial goals, and ultimately make better financial decisions with the help of rule-based analysis and (later) AI.

The stated differentiator: the final output of the product is **not raw numbers and charts**, but a human-readable, actionable sentence. The document's canonical example:

> "This month you spent 20 million toman; 4 million more than last month. The main driver was food and shopping. If this trend continues, you will exceed your budget by about 2 million by month end."

The product evolves in stages:

`Expense Tracker → Personal Finance Manager → Financial Analytics Platform → AI Financial Copilot`

— **without the financial core (calculations) ever depending on AI at any stage.**

Currency/locale context: amounts are expressed in **toman**; the user base is Iranian; example inputs are in Persian. (Multi-currency support: **Not specified**.)

---

## 2. Product Goals

Derived directly from §1, §2.2, §4, §5 of the source:

| # | Goal | Source |
|---|---|---|
| G1 | Make transaction entry effortless — under 10 seconds per transaction | §2.2, §4.1, §14 |
| G2 | Let the user understand *where money goes*, not just see totals | §1, §2.1 |
| G3 | Deliver reports and insights in human language, not only numbers/charts | §2.2, §4.2 |
| G4 | Unify budgeting, smart alerts, and financial-goal tracking in one place | §2.2 |
| G5 | Provide a clear growth path to an AI financial assistant **without sacrificing calculation accuracy or trustworthiness** | §2.2, §4.3, §5 |
| G6 | Keep the architecture extensible so AI, OCR, and advanced forecasting can be added later **without rewriting the core** | §4.4 |
| G7 | Give the user complete control over their own data (view, edit, delete, export) | §4.5 |

### Proposed success metrics (KPIs) — §14
- Daily Active Loggers (daily transaction-logging completion rate)
- Average time to record one transaction — **target: under 10 seconds**
- Weekly return rate / retention (W1 / W4)
- % of users who have defined at least one budget or financial goal
- Engagement rate with insights and alerts (opened / acted upon)

(Numeric targets for all KPIs except the 10-second entry time: **Not specified**.)

---

## 3. Target Users (Personas) — §3

| Persona | Description | Primary need | Version relevance |
|---|---|---|---|
| Salaried employee (کارمند حقوق‌بگیر) | Fixed monthly income, varied daily expenses | Understand why money runs out before month end | MVP |
| Freelancer / small business owner | Irregular income from multiple sources | Manage multiple accounts, forecast cash flow | MVP (accounts) + V2 (forecasting) |
| Student / young newcomer | Limited budget, small savings goal | Fast expense entry, reach one concrete financial goal | MVP |
| Couple / family (زوج / خانواده) | Shared expenses and budgets | Shared view of household finances | **V4 explicitly** |

Notes:
- The family persona is explicitly tagged `(V4)` in the source — it must **not** influence MVP scope.
- Persona-specific onboarding, segmentation, or differentiated UX: **Not specified**.

---

## 4. Core Problems — §2.1

- P1: Most users do not know exactly where their money is being spent.
- P2: Existing applications are either too simple (a mere ledger) or too complex/slow for daily entry.
- P3: Existing financial reports usually only show charts — not understandable, actionable analysis.
- P4: Planning for financial goals (saving, purchases, travel) is typically done manually and scattered across Excel or paper.

---

## 5. Value Proposition — §2.2

- V1: Ultra-fast transaction entry (< 10 seconds), with natural-language input support **in later versions**.
- V2: Financial reports and insights in human language, not just numbers and charts.
- V3: Budgeting, smart alerts, and financial goal tracking in one place.
- V4: A clear growth path toward an AI Financial Assistant without sacrificing the accuracy and reliability of calculations.

### Five differentiating capabilities — §13
1. Ultra-fast expense entry
2. Genuinely understandable reports (not just charts)
3. Smart, rule-based Financial Insights
4. Financial goals and planning
5. AI Financial Assistant (later versions)

---

## 6. Functional Requirements

Requirement IDs are assigned by this analysis for traceability. The **Ver** column is the version the source assigns. **Pri** is the source's own priority band (§12).

### 6.1 Transaction recording — the product core (§6.1)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-TX-01 | Support four transaction kinds: **Expense 💸, Income 💰, Transfer between accounts 🔄, Recurring transaction 📅** | V1 | P0 |
| FR-TX-02 | Each transaction carries fields: **amount, category, account, description, date, transaction type** | V1 | P0 |
| FR-TX-03 | **A transfer between the user's own accounts must NOT be counted as income or expense** in any calculation | V1 | P0 |
| FR-TX-04 | Quick entry: the default interface requires **only amount + category**; category is chosen with a single tap from category icons; all other fields optional | V1 | P0 |
| FR-TX-05 | Edit and delete any transaction | V1 | P0 |

**Important note on FR-TX-01:** the source lists "recurring transaction" as a *transaction type* alongside expense/income/transfer, while §6.10 and §11.2 model `RecurringTransaction` as a **separate entity**. See Ambiguity A-1.

### 6.2 Short text input + automatic category detection engine (§6.1.1)

This is one of the most precisely specified features in the document and is explicitly **MVP** and explicitly **non-AI**.

| ID | Requirement | Ver |
|---|---|---|
| FR-NLQ-01 | The user may type a short free-text entry instead of using buttons, e.g. «۲۰۰ اسنپ» ("200 Snapp") or «۱۰۰۰ میلیون خونه» ("1000 million house") | V1 |
| FR-NLQ-02 | The system extracts: the **number**, the **multiplier** (thousand / million), and the **remaining word(s)** | V1 |
| FR-NLQ-03 | The system then guesses the category using a **strictly deterministic two-layer engine — not AI, and not dependent on a large dictionary** | V1 |
| FR-NLQ-04 | **Layer 1 — base dictionary (lightweight):** only a few dozen very frequent words that are near-identical for all users. Source: a fixed in-system list. Named examples: حقوق (salary), اجاره (rent), قبض (bill), قسط (installment), اینترنت (internet), and similar | V1 |
| FR-NLQ-05 | **Layer 2 — primary engine, similarity against the user's own history:** category detection for every other word, based on that same user's previous transactions. Data source: the existing `Transaction` table — **no separate table or dictionary required** | V1 |
| FR-NLQ-06 | **Evaluation order:** base dictionary is checked first. If no match, compare the new input's description against the descriptions of the same user's previous transactions using a **text-similarity algorithm (e.g. Levenshtein or n-gram similarity)**; if similarity exceeds a **threshold**, automatically suggest the category of the nearest matching transaction | V1 |
| FR-NLQ-07 | If neither the base dictionary nor the history matches (typically a new user or a completely new word), the system **asks the user once** to pick a category; that choice is then recorded in history and detected automatically thereafter | V1 |
| FR-NLQ-08 | **Unusual-amount guard:** when an amount is far above the user's normal amount ceiling (example: «۱۰۰۰ میلیون خونه» = 1 billion toman), the system asks **before recording**: "Should I record this as an expense, or as a new asset?" — so the month's expense report is not distorted | V1 |
| FR-NLQ-09 | Design constraints that must be preserved: no large dictionary maintained by the product team; category detection personalizes automatically to each user's own language and writing habits; **the entire logic stays fully deterministic and testable** | V1 |
| FR-NLQ-10 | The same transaction table must later be usable **directly as training data for the V3 NLP engine, with no change to the data structure** | V1 (design constraint), consumed in V3 |

Open points on this engine: the similarity **threshold value**, the exact algorithm choice, the "normal amount ceiling" definition, and the behaviour when FR-NLQ-08's "new asset" branch is chosen in MVP (Asset is a V2 entity) are all **Not specified** — see A-2, A-3, A-4.

### 6.3 Accounts and wallets (§6.2)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-ACC-01 | The user may define multiple financial sources: **bank account, bank card, cash, digital wallet, savings account, investment account** | V1 | P0 |
| FR-ACC-02 | Each account has: **name, type, initial balance, current balance** | V1 | P0 |
| FR-ACC-03 | Current balance is **calculated from transactions** — no direct bank connection in MVP | V1 | P0 |

### 6.4 Expense categorization (§6.3)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-CAT-01 | Ship default categories: food, transport, shopping, home, bills, health, entertainment, education, travel, clothing, installments & debt, investment, other (غذا، حمل‌ونقل، خرید، خانه، قبض، سلامت، سرگرمی، آموزش، سفر، پوشاک، اقساط و بدهی، سرمایه‌گذاری، سایر) | V1 | P0 |
| FR-CAT-02 | The user may create custom categories | V1 | P0 |
| FR-CAT-03 | Automatic category suggestion based on transaction title (e.g. "اسنپ" → transport) is available **from V1**, powered by the §6.1.1 engine | V1 | P0 |

Sub-categories, category icons beyond "choose from category icons" (FR-TX-04), category archiving/deletion rules, and income-vs-expense category separation: **Not specified**.

### 6.5 Transaction list and management (§6.4)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-LIST-01 | Search within transactions | V1 | P0 |
| FR-LIST-02 | Filter by date, category, account, and type (income/expense) | V1 | P0 |
| FR-LIST-03 | Sort by amount or date | V1 | P0 |
| FR-LIST-04 | Edit and delete each transaction | V1 | P0 |

### 6.6 Main dashboard (§6.5)

Requirement: the home screen must answer, at a glance, *"How are my finances right now?"*

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-DASH-01 | Total balance and per-account balance | V1 | P0 |
| FR-DASH-02 | Current-month income, expense, and savings (and **optionally** today's) | V1 | P0 |
| FR-DASH-03 | Transaction count and the highest-spending category | V1 | P0 |
| FR-DASH-04 | Status of budgets and financial goals | V1 | P0/P1 |
| FR-DASH-05 | The most important active financial alerts | V1 | P0/P1 |

### 6.7 Financial reports — daily, weekly, monthly, yearly (§6.6)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-REP-01 | Every report includes, in addition to raw figures, a **written summary sentence** (e.g. "This week you spent 4,850,000 toman; 12% more than last week. The largest increase was food.") | V1 | P0 |
| FR-REP-02 | **Daily report:** income, expense, list of the day's transactions | V1 | P0 |
| FR-REP-03 | **Weekly report:** total expense/income, savings, highest-spending categories, comparison with previous week | V1 | P0 |
| FR-REP-04 | **Monthly report:** income, expense, savings, **savings rate**, comparison with previous month **and with the 3-month average**, category breakdown | V1 | P0 |
| FR-REP-05 | **Yearly report:** total income/expense, monthly trend of expense, income, and savings across the year | V1 | P0 |

### 6.8 Financial charts (§6.7)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-CHT-01 | Expense by category (Pie/Bar) | V1 | P0 |
| FR-CHT-02 | Income and expense trend over time (Line) | V1 | P0 |
| FR-CHT-03 | Income vs. expense comparison | V1 | P0 |
| FR-CHT-04 | Savings trend | V1 | P0 |
| FR-CHT-05 | Month-over-month comparison | V1 | P0 |

### 6.9 Period comparison (§6.8)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-CMP-01 | The user can compare two periods (this month vs. last month, this quarter vs. last quarter, etc.) | V1 | P1 |
| FR-CMP-02 | Output is presented **both numerically and as an analytical sentence**, e.g. "Your income rose 16%, but expenses grew 21%; therefore your savings rate has decreased." | V1 | P1 |

The full set of selectable period types ("and others") is **Not specified** — see A-5.

### 6.10 Budgeting (§6.9)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-BUD-01 | The user sets a **monthly** spending cap per category | V1 | P1 |
| FR-BUD-02 | The system shows consumption percentage visually (progress bar), e.g. `غذا: 72% (3,600,000 of 5,000,000)` | V1 | P1 |
| FR-BUD-03 | Rule-based budget alert: ⚠️ **crossing 80%** of a category budget | V1 | P1 |
| FR-BUD-04 | Rule-based budget alert: 🔴 **full consumption** of a category budget | V1 | P1 |
| FR-BUD-05 | Rule-based budget alert: 🔴 **exceeding the defined budget cap** | V1 | P1 |

Note: FR-BUD-04 (100% reached) and FR-BUD-05 (over cap) are listed as two distinct alerts in the source and must be treated as distinct rules. Non-monthly budget periods, total (non-category) budgets, and budget rollover: **Not specified**.

### 6.11 Recurring transactions (§6.10)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-REC-01 | Support recurring items such as rent, internet, subscriptions, salary, and installments | V1 | P1 |
| FR-REC-02 | Required data: **amount, repetition period, start/end date, category, account** | V1 | P1 |
| FR-REC-03 | The system **reminds the user before the due date** | V1 | P1 |

Whether an occurrence is auto-posted as a real transaction or only reminded, the allowed repetition periods, and the reminder lead time are **Not specified** — see A-6.

### 6.12 Financial goals (§6.11)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-GOL-01 | The user defines a goal, e.g. "Buy a laptop — 100 million toman" | V1 | P1 |
| FR-GOL-02 | The system computes **progress** and the **required monthly saving**. Worked example: target 100M, current 40M, remaining 60M, deadline 6 months → required monthly saving 10M | V1 | P1 |

How "current amount" is fed (manual entry vs. linked account vs. derived from savings) is **Not specified** — see A-7.

### 6.13 Financial insights — rule-based (§6.12)

In MVP these are generated **without AI**, by a simple Rule Engine. The four stated rules:

| ID | Rule | Ver | Pri |
|---|---|---|---|
| FR-INS-01 | Overall expense increase vs. previous month **> 20%** | V1 | P1 |
| FR-INS-02 | Growth **> 30%** in one specific category | V1 | P1 |
| FR-INS-03 | Decrease **> 20%** in one category's expense | V1 | P1 |
| FR-INS-04 | Savings rate decreased vs. previous month | V1 | P1 |

FR-INS-04 has no stated threshold — **Not specified**.

### 6.14 Financial Health Score (§6.13)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-FHS-01 | A single overall score **out of 100** | V1 | P1 |
| FR-FHS-02 | Computed from: **savings rate, debt level, budget consumption, income stability, expense growth, goal progress, and emergency balance** | V1 | P1 |
| FR-FHS-03 | In MVP the score is **entirely rule-based** | V1 | P1 |

The **weights, formula, and sub-metric definitions are Not specified** — this is the single largest specification gap in the MVP. Note also that "debt level" and "emergency balance" have no MVP entity behind them (Debt is V2) — see A-8, a genuine cross-version conflict.

### 6.15 General financial alerts (§6.14)

| ID | Alert | Ver | Pri |
|---|---|---|---|
| FR-ALR-01 | Approaching the budget cap | V1 | P1 |
| FR-ALR-02 | Exceeding the budget | V1 | P1 |
| FR-ALR-03 | Abnormal expense increase | V1 | P1 |
| FR-ALR-04 | An upcoming recurring payment | V1 | P1 |
| FR-ALR-05 | Account balance dropping | V1 | P1 |
| FR-ALR-06 | Falling behind a financial goal | V1 | P1 |
| FR-ALR-07 | Savings-rate decline | V1 | P1 |

Thresholds for FR-ALR-03, FR-ALR-05, FR-ALR-06, FR-ALR-07 and the **delivery channel** (in-app, push, email) are **Not specified** — see A-9.

### 6.16 Export (§6.15)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-EXP-01 | Export transactions and reports in **CSV, Excel, and PDF** formats | V1 | P1 |

Data **import** is **Not specified** anywhere in the document.

### 6.17 V2 — Advanced finance (§7)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-FCS-01 | Statistical forecasting **without AI**, using moving average, weighted moving average, linear regression, and exponential smoothing. Example output: "Based on the last three months' trend, next month's expense is forecast at about 28 million toman." | V2 | P2 |
| FR-PAT-01 | Advanced spending-pattern analysis, e.g. "Your weekend spending averages 30% more than weekdays"; "Most of your non-essential purchases happen between 8 and 11 PM" | V2 | P2 |
| FR-DBT-01 | Debt and receivable management: record debt, receivable, installment, paid/remaining amount, and due date with reminders | V2 | P2 |
| FR-SUB-01 | Subscription management: track monthly subscriptions (Netflix, Spotify, internet, …) and show their total cost | V2 | P2 |
| FR-NW-01 | Net Worth: assets minus liabilities, including account balances, cash, investments, and recorded assets (gold, car, property, foreign currency) | V2 | P2 |
| FR-WIF-01 | What-if scenarios: "If I spend 5 million less per month, what happens?" → new savings 10M/month → reach the 100M goal in 10 months | V2 | P2 |

Note: FR-PAT-01's time-of-day analysis implies capturing transaction **time**, not just date — but FR-TX-02 lists only "date". See A-10.

### 6.18 V3 — AI layer (§8)

**Vital architectural principle stated in the source: financial calculations are NEVER performed by AI. AI only processes natural input and produces explanation/recommendation based on the structured data of the Financial Engine.**

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-AI-01 | Natural-language transaction entry: "Today I spent 350 thousand toman on restaurant dinner." → `type: expense, amount: 350000, category: food` | V3 | P3 |
| FR-AI-02 | Conversational financial assistant answering questions such as: How much did I spend this month? Where was my largest expense? Why did I spend more this month? How can I reduce my expenses? Will I reach my financial goal? | V3 | P3 |
| FR-AI-03 | **Secure AI assistant architecture: AI never has direct database access.** Mandated data path: `user question → intent detection → financial query → Analytics Engine → structured data → AI → natural-language answer` | V3 | P3 |
| FR-AI-04 | AI Insights / Recommendation — explanation and smart suggestion, e.g. "Food expense is about 35% higher than last month. A significant part of this increase relates to restaurants and food delivery." | V3 | P3 |
| FR-AI-05 | Receipt extraction via OCR: the user sends a receipt photo and the system extracts amount, date, merchant, line items, and category (via an OCR service or a Vision model) | V3 | P3 |

### 6.19 V4 — Advanced intelligence and family finance (§9)

| ID | Requirement | Ver | Pri |
|---|---|---|---|
| FR-V4-01 | Advanced forecasting and detection of complex financial-behaviour patterns | V4 | P4 |
| FR-V4-02 | Personalized Financial Coach | V4 | P4 |
| FR-V4-03 | Automatic planning to reach goals | V4 | P4 |
| FR-V4-04 | Advanced scenario modelling and personalized budget suggestions | V4 | P4 |
| FR-V4-05 | Family financial management: members, shared account, family budgets and goals, shared reporting | V4 | P4 |

### 6.20 Supplementary ideas (§16) — proposals, not committed requirements

The source presents these as *"ideas that could help differentiate and sustain the business"* — they are **not assigned to any version** and must be treated as candidate scope requiring a decision.

| ID | Idea | Version assignment |
|---|---|---|
| ID-01 | **Offline-first** design with later synchronization — argued as an important competitive advantage because financial data is sensitive and many users want to log expenses without internet | **Not specified** |
| ID-02 | **Local-only mode** — optional fully-private mode where all data stays on the user's device, no cloud | **Not specified** |
| ID-03 | Gentle savings gamification — symbolic rewards, badges, streaks for consecutive days of budget adherence, without making the experience unserious | **Not specified** |
| ID-04 | Phone home-screen widget — one-tap transaction entry and daily financial summary | **Not specified** |
| ID-05 | Anonymous benchmarking against similar users — fully aggregated and anonymous, **must be strictly opt-in**: "Your food spending is 15% above the average of users like you" | **Not specified** |
| ID-06 | **Freemium revenue model** — Free: transaction entry, dashboard, monthly report, max one active budget/goal. Pro (subscription): unlimited budgets and goals, advanced Insight and Forecasting, full Export, AI Assistant (later versions) | **Not specified** |
| ID-07 | Quick entry via messenger assistants — Telegram or WhatsApp bot, as a complement to the main app | **Not specified** |

**ID-01, ID-02, and ID-06 are architecture-determining and cannot be deferred past the architecture phase.** See §16 and the approval list.

### 6.21 Explicitly out of scope (§10)

Deliberately excluded from early versions due to high technical, security, legal, and infrastructure complexity:

- Direct bank account connection (Open Banking)
- Performing real bank transactions from inside the app
- In-app payments
- Direct bank-card management or a full banking system

> "Early versions focus solely on personal financial management and analysis of data entered by the user."

---

## 7. Non-Functional Requirements

Extracted from §4 (design principles), §14 (KPIs), §15 (risks), §16 (ideas), §8.3 (AI security).

| ID | Requirement | Source |
|---|---|---|
| NFR-01 | **Entry speed:** recording an expense must take no more than a few seconds; measurable target **under 10 seconds** average | §4.1, §14 |
| NFR-02 | **Minimal default form:** amount + category required, everything else optional | §4.1, §6.1 |
| NFR-03 | **Report comprehensibility:** every report must carry at least one plain-language conclusion sentence | §4.2 |
| NFR-04 | **Determinism:** all financial calculations (sums, percentages, budget, health score) must be performed **deterministically** by the Backend / Financial Engine | §4.3 |
| NFR-05 | **Testability:** those calculations must be testable | §4.3 |
| NFR-06 | **Auditability:** the financial core must be auditable (قابل ممیزی) | §15 |
| NFR-07 | **AI independence:** AI is only a layer for natural input and explanation of outputs — **never a producer of numbers** | §4.3, §8 |
| NFR-08 | **Extensibility:** the architecture must allow adding AI, OCR, and advanced forecasting **without rewriting the core** | §4.4 |
| NFR-09 | **User data control:** the user must be able to view, edit, delete, and export their data (CSV/Excel/PDF) at any time | §4.5 |
| NFR-10 | **Data encryption** for sensitive financial data | §15 |
| NFR-11 | **No direct banking connection** in early versions (a privacy/security control, not just a scope cut) | §15, §10 |
| NFR-12 | **AI cost control at scale:** AI used only in the interaction/explanation layer, never in core calculations | §15 |
| NFR-13 | **AI isolation:** AI must never have direct database access; all AI access goes through the Analytics Engine as structured data | §8.3 |
| NFR-14 | **Data-structure stability:** the transaction table must be usable as NLP training data in V3 **without structural change** | §6.1.1 |
| NFR-15 | **Privacy for benchmarking (if adopted):** fully aggregated, anonymous, strictly opt-in | §16.5 |
| NFR-16 | **Offline capability (if adopted):** offline-first with later sync | §16.1 |
| NFR-17 | **Local-only option (if adopted):** all data on device, no cloud | §16.2 |

**Not specified:** performance/latency budgets for reports and queries, availability/uptime targets, scale targets (user count, transaction volume), platform targets (mobile/web/desktop), supported languages beyond Persian, accessibility requirements, backup/disaster recovery, data-retention policy, regulatory/compliance obligations, authentication and authorization mechanisms (including whether app-lock/biometrics exist), audit-log retention, and localization of the calendar (Jalali vs. Gregorian — see A-11).

---

## 8. MVP Scope (V1)

Source statement of intent (§5): *"Prove the core value: recording and understanding expenses."*

### 8.1 In scope for MVP

**P0 — essential (§12):** expense/income recording, accounts, categories, transactions, dashboard, weekly/monthly reports, charts.

**P1 — important (§12):** budgets, goals, period comparison, alerts, insights, health score, recurring transactions, export.

Full MVP feature list per §5: transactions, accounts, categorization, dashboard, reports, charts, budgets, goals, alerts, rule-based insights, financial health score, export.

Plus, from §6 detail: the §6.1.1 short-text-input + deterministic category-detection engine, daily and yearly reports, transaction search/filter/sort.

### 8.2 Requirements that should NOT be part of the MVP

Requested explicitly by the analysis brief. These fall into three groups.

**(a) Assigned by the source to later versions — must be excluded from MVP:**
all of FR-FCS-01, FR-PAT-01, FR-DBT-01, FR-SUB-01, FR-NW-01, FR-WIF-01 (V2); FR-AI-01…05 (V3); FR-V4-01…05 (V4), including the couple/family persona.

**(b) Explicitly out of the roadmap entirely (§10):** Open Banking, real bank transactions, in-app payments, card/banking management. These must not be designed for, only architecturally not-precluded.

**(c) Unassigned ideas (§16) that this analysis recommends keeping out of MVP build scope — while flagging that two of them are architectural decisions that cannot be deferred:**

| Item | Recommendation | Rationale |
|---|---|---|
| ID-03 Gamification | Exclude from MVP | Pure UX addition; no dependency; does not serve "prove the core value" |
| ID-04 Home-screen widget | Exclude from MVP | Platform-specific; depends on an unmade platform decision |
| ID-05 Anonymous benchmarking | Exclude from MVP | Requires an aggregate-data pipeline, opt-in consent flow, and privacy review; high cost, low MVP value |
| ID-07 Messenger bot entry | Exclude from MVP | Separate channel/integration surface; complementary to the main app by the source's own wording |
| ID-06 Freemium model | Exclude the **paywall mechanics** from MVP build; **decide the model now** | Entitlement limits ("max one active budget/goal") change budget and goal domain design |
| ID-01 Offline-first | Exclude only if decided against **now** | Offline-first is not retrofittable; it determines the entire data/sync model |
| ID-02 Local-only mode | Exclude only if decided against **now** | Determines whether a server is even authoritative; not retrofittable |

**(d) MVP requirements that carry unresolved specification risk** (in scope per the source, but cannot be built as written):
FR-FHS-01…03 (Health Score — no formula, and depends on V2-only debt data), FR-ALR-03/05/06/07 (no thresholds), FR-NLQ-06 (no threshold value), FR-NLQ-08 (no "normal ceiling" definition and no MVP Asset entity).

---

## 9. Future Scope

### V2 — Advanced Finance (§5, §7)
Goal: more advanced analysis and planning. Contains: statistical forecasting, spending-pattern analysis, debt management, subscriptions, net worth, assets, what-if scenarios. Entities added: **Debt, Subscription, Asset**.

### V3 — AI Layer (§5, §8)
Goal: become a smart financial assistant. Contains: natural-language entry, conversational AI assistant, AI Insights, smart recommendations, receipt OCR. **Constraint: AI is a layer on top of the financial platform, not a replacement for it.**

### V4 — Financial Copilot (§5, §9)
Goal: deep personalization and family finance. Contains: personal financial coach, behavioural analysis, automatic goal planning, family finance.

### Version → priority mapping (§12)
| Priority | Contents | Version |
|---|---|---|
| P0 — essential | Expense/income entry, accounts, categories, transactions, dashboard, weekly/monthly reports, charts | V1 |
| P1 — important | Budgets, goals, period comparison, alerts, Insights, Health Score, recurring transactions, Export | V1 |
| P2 — advanced | Forecasting, debt management, subscriptions, Net Worth, assets, What-if | V2 |
| P3 — AI | Natural-language input, AI Assistant, AI Insights/Recommendation, OCR | V3 |
| P4 — future | Family finance, Financial Coach, advanced personalization, advanced forecasting | V4 |

---

## 10. Domain Entities

### 10.1 Entities named by the source (§11.2)

| Entity | Version | Source-stated attributes |
|---|---|---|
| **User** | V1 | Not specified |
| **Account** (حساب/کیف پول) | V1 | name, type, initial balance, current balance (calculated). Types: bank account, bank card, cash, digital wallet, savings account, investment account |
| **Category** | V1 | 13 defaults listed; user-created custom categories supported |
| **Transaction** (Expense / Income / Transfer) | V1 | amount, category, account, description, date, type |
| **RecurringTransaction** | V1 | amount, repetition period, start date, end date, category, account |
| **Budget** | V1 | category, monthly cap; derived: consumed amount, consumption % |
| **Goal** | V1 | target amount, current amount, remaining, deadline; derived: required monthly saving, progress |
| **Alert** | V1 | Attributes not specified; 7 alert types listed in §6.14 plus 3 budget alerts in §6.9 |
| **Insight** | V1 | Attributes not specified; 4 generating rules listed in §6.12 |
| **Debt** | V2 | debt/receivable, installment, paid amount, remaining amount, due date |
| **Subscription** | V2 | Attributes not specified; monthly subscriptions, total cost |
| **Asset** | V2 | Attributes not specified; examples: gold, car, property, foreign currency |

### 10.2 Entities implied but not named — flagged, not assumed

These are **implied by stated requirements** but never declared as entities. They are listed as findings requiring a decision, not as requirements:

- **FinancialHealthScore** — §6.13 requires a score out of 100 across 7 inputs; whether it is stored/historized or computed on read is **Not specified**.
- **Transfer linkage** — FR-TX-03 requires a transfer to touch two accounts and be excluded from income/expense; how a transfer is represented (one record with source+destination, or a linked pair) is **Not specified**.
- **BaseDictionary** (FR-NLQ-04) — described as "a fixed in-system list", explicitly *not* a maintained data asset; the source explicitly says the similarity layer needs **no separate table**.
- **Report** — reports are described as outputs, never as stored entities.
- **Family / Household, Member** — implied by FR-V4-05, V4 only.

### 10.3 Relationships stated or directly implied

- User `1..*` → Account; User `1..*` → Category (custom); User `1..*` → Transaction; User `1..*` → Budget; User `1..*` → Goal; User `1..*` → Alert; User `1..*` → Insight.
- Transaction `*..1` → Account; Transaction `*..1` → Category (optional in quick entry — see A-12).
- Transfer: Transaction → **two** Accounts (source, destination) — representation Not specified.
- RecurringTransaction `*..1` → Category, `*..1` → Account; relationship between a RecurringTransaction and the Transactions it generates: **Not specified** (see A-6).
- Budget `*..1` → Category; period = month.
- Account.currentBalance is **derived** from initialBalance + transactions (FR-ACC-03) — a calculation, not a stored fact per the source's wording.
- Insight and Alert are **derived outputs** of the Rule Engine over Transaction/Budget/Goal data.
- Goal has no stated relationship to Account or Transaction — **Not specified** (A-7).
- Category ← Transaction is the **sole data source** for the FR-NLQ-05 similarity engine.

---

## 11. Business Rules and Financial Calculation Rules

### 11.1 Core financial rules (explicit in the source)

| ID | Rule | Source |
|---|---|---|
| BR-01 | **Transfers between the user's own accounts are excluded from income and expense calculations.** | §6.1 |
| BR-02 | `Account.currentBalance = initialBalance ± transactions` — computed, never fetched from a bank | §6.2 |
| BR-03 | All financial calculations are performed by the Backend / Financial Engine, **deterministically and testably** | §4.3 |
| BR-04 | AI never produces financial numbers | §4.3, §8 |
| BR-05 | Savings and savings rate are first-class computed metrics of the monthly report | §6.6 |
| BR-06 | Monthly report must compare against both the **previous month** and the **3-month average** | §6.6 |
| BR-07 | Weekly report must compare against the **previous week** | §6.6 |
| BR-08 | Budget consumption % = consumed / cap, presented as a progress bar; the worked example is 3,600,000 / 5,000,000 = 72% | §6.9 |
| BR-09 | Budgets are defined **per category, monthly** | §6.9 |
| BR-10 | Goal: `remaining = target − current`; `required monthly saving = remaining / months to deadline` (worked example: (100M − 40M)/6 = 10M) | §6.11 |
| BR-11 | Financial Health Score is a value **0–100**, derived from savings rate, debt, budget consumption, income stability, expense growth, goal progress, emergency balance — **rule-based in MVP** | §6.13 |

### 11.2 Threshold rules (Rule Engine)

| ID | Trigger | Threshold | Source |
|---|---|---|---|
| BR-12 | Budget warning | ≥ 80% of category budget | §6.9 |
| BR-13 | Budget exhausted | 100% of category budget | §6.9 |
| BR-14 | Budget exceeded | > category budget cap | §6.9 |
| BR-15 | Insight: overall expense rise vs. last month | > 20% | §6.12 |
| BR-16 | Insight: single-category growth | > 30% | §6.12 |
| BR-17 | Insight: single-category decrease | > 20% | §6.12 |
| BR-18 | Insight: savings-rate decline vs. last month | threshold **Not specified** | §6.12 |
| BR-19 | Alert: abnormal expense increase | threshold **Not specified** | §6.14 |
| BR-20 | Alert: account balance dropping | threshold **Not specified** | §6.14 |
| BR-21 | Alert: falling behind a goal | threshold **Not specified** | §6.14 |
| BR-22 | Alert: savings-rate decline | threshold **Not specified** | §6.14 |
| BR-23 | Alert: upcoming recurring payment | lead time **Not specified** | §6.10, §6.14 |

### 11.3 Category-detection rules (§6.1.1)

| ID | Rule |
|---|---|
| BR-24 | Parse short text into: number + multiplier (thousand/million) + remaining word(s) |
| BR-25 | **Order is fixed:** base dictionary first, then user-history similarity. Never the reverse |
| BR-26 | History similarity uses a text-similarity algorithm (Levenshtein or n-gram) against the *same user's* prior transaction descriptions |
| BR-27 | A match is accepted only when similarity **exceeds a defined threshold** (value Not specified) |
| BR-28 | On accepted match, assign the category of the **nearest similar transaction** |
| BR-29 | On no match, ask the user **once**; the answer enters history and drives all future automatic detection |
| BR-30 | The whole detection path must remain **fully deterministic and testable** |
| BR-31 | **Unusual-amount guard:** when the amount far exceeds the user's normal amount ceiling, prompt "expense or new asset?" **before** recording, to avoid distorting the monthly expense report |

### 11.4 Rules that must be derived — currently unstated

These calculations are *required* by stated features but have **no stated formula**:
savings (income − expense? net of transfers?), savings rate denominator, "3-month average" definition (calendar months? rolling?), income stability, expense growth, emergency balance, goal progress %, "normal amount ceiling", month boundary definition, and the handling of a transaction whose category is empty at quick-entry time.

---

## 12. User Flows

Reconstructed strictly from stated requirements. Steps not described in the source are marked.

### UF-1 — Quick transaction entry (the core loop, §6.1)
1. User opens entry (default minimal form).
2. Enters **amount**, taps a **category icon**.
3. Optionally sets account, description, date, type.
4. Saves. Target: **< 10 seconds**.
5. Account balance, dashboard, budget consumption update. *(Update timing/mechanism: Not specified.)*

### UF-2 — Short text entry with automatic category detection (§6.1.1)
1. User types e.g. «۲۰۰ اسنپ».
2. System extracts number + multiplier + word.
3. **Layer 1:** check base dictionary → match? assign category → go to 6.
4. **Layer 2:** compute text similarity vs. the user's own past transaction descriptions → above threshold? assign the nearest transaction's category → go to 6.
5. No match → **ask the user once** to select a category; record it in history.
6. **Unusual-amount check:** amount far above normal ceiling → ask "record as expense, or as a new asset?" *(The "new asset" branch has no MVP destination — A-4.)*
7. Save transaction.

### UF-3 — Account setup
1. User defines a financial source (bank account / card / cash / digital wallet / savings / investment).
2. Enters name, type, **initial balance**.
3. Current balance thereafter is computed from transactions.
*(Onboarding sequence, whether this is mandatory at first launch: Not specified.)*

### UF-4 — Transfer between own accounts (§6.1)
1. User selects transfer type, source account, destination account, amount.
2. Both account balances update.
3. **The transfer is excluded from income and expense totals and from all reports of income/expense.**

### UF-5 — Daily check-in (dashboard, §6.5)
User opens home → sees total + per-account balance, month's income/expense/savings, transaction count, top spending category, budget and goal status, most important active alerts.

### UF-6 — Review a report (§6.6)
User picks a period (daily / weekly / monthly / yearly) → sees figures, category breakdown, comparisons (prev period, 3-month average for monthly) → **reads the written summary sentence** → optionally exports (CSV/Excel/PDF).

### UF-7 — Compare two periods (§6.8)
User selects two periods → sees numeric deltas **and** an analytical sentence connecting income change, expense change, and savings-rate effect.

### UF-8 — Set and track a budget (§6.9)
1. User picks a category, sets a monthly cap.
2. Spending accrues; a progress bar shows % consumed.
3. Rule engine fires at 80%, at 100%, and on exceeding the cap.
4. Alerts surface on the dashboard.

### UF-9 — Set and track a goal (§6.11)
1. User defines goal name, target amount, deadline.
2. System shows current, remaining, progress, and required monthly saving.
3. Alert fires when the user falls behind. *(How "current" is updated: Not specified — A-7.)*

### UF-10 — Recurring transaction (§6.10)
1. User defines amount, repetition period, start/end date, category, account.
2. System reminds **before** the due date.
3. *(Whether the occurrence auto-posts or requires confirmation: Not specified — A-6.)*

### UF-11 — Receive an insight / alert (§6.12, §6.14)
Rule engine evaluates conditions → generates an Insight or Alert → surfaced on the dashboard ("most important active alerts") and measured by the §14 engagement KPI. *(Evaluation trigger — on write, scheduled, or on read — and notification channel: Not specified.)*

### UF-12 — Export (§6.15)
User selects transactions or a report → chooses CSV / Excel / PDF → receives the file.

### UF-13 — V3 conversational assistant (§8.3)
`user question → intent detection → financial query → Analytics Engine → structured data → AI → natural-language answer`. **AI never touches the database.**

### Flows not specified anywhere
Sign-up / sign-in, onboarding, account recovery, data deletion of the whole account, multi-device sync, subscription purchase/upgrade (if ID-06 is adopted), permission/consent flows.

---

## 13. Feature Dependencies

The source states a mandatory build order (§11):

`Transaction System → Financial Engine → Analytics Engine → Budget & Goals → Insight Engine → Forecasting → AI Layer`

with the stated intent that **AI sits last, as an addable layer**.

### Dependency map (derived from the requirements)

```
Category ─┐
Account  ─┼─→ Transaction ──→ Financial Engine ──→ Analytics Engine ──→ Reports (§6.6)
User     ─┘        │            (balances,            (trends,      ├─→ Charts (§6.7)
                   │             totals,               period        └─→ Period comparison (§6.8)
                   │             savings)              comparison,
                   │                  │                spend patterns)
                   │                  ├─→ Dashboard (§6.5)
                   │                  ├─→ Budget (§6.9) ──┐
                   │                  └─→ Goal (§6.11) ───┤
                   │                                      ├─→ Insight/Rule Engine (§6.12, §6.14)
                   │                                      │       └─→ Alerts, Insights
                   │                                      └─→ Health Score (§6.13)
                   │
                   └─→ Category-detection engine (§6.1.1)   [feeds on Transaction history]
                   └─→ RecurringTransaction (§6.10) ──→ reminders
                   └─→ Export (§6.15)

V2:  Analytics Engine ──→ Forecasting (§7.1), Spend patterns (§7.2)
     Debt (§7.3), Asset (§7.5) ──→ Net Worth (§7.5) ──→ Health Score inputs
     Forecasting + Goal ──→ What-if (§7.6)
V3:  Analytics Engine ──(structured data only)──→ AI Layer (§8.3)
     Transaction history ──(training data, unchanged schema)──→ NLP engine (§6.1.1)
V4:  AI Layer + Analytics ──→ Coach, auto-planning; User ──→ Family
```

### Hard dependencies worth calling out
1. **Everything depends on Transaction.** It is both the operational record and the *training/matching corpus* for category detection (FR-NLQ-05) and, later, the V3 NLP engine (FR-NLQ-10).
2. **Category detection depends on transaction history** — meaning it is inherently weak for new users, which is exactly why FR-NLQ-07 (ask once) exists. This is a cold-start dependency, not a defect.
3. **Health Score depends on debt level and emergency balance**, neither of which exists as MVP data — a genuine cross-version dependency violation (A-8).
4. **Insights and alerts depend on at least two periods of history** — a brand-new user can trigger almost none of them. Empty/cold-state behaviour: **Not specified**.
5. **Budget alerts depend on Budget existing**; the freemium idea (ID-06) would cap budgets at one, which changes what the alert engine can produce for free users.
6. **What-if (V2) depends on both Goal (V1) and Forecasting (V2).**
7. **AI layer (V3) depends on the Analytics Engine being query-addressable** — FR-AI-03's path is only implementable if Analytics exposes structured, parameterized financial queries. This is an MVP-era design obligation even though the feature is V3.
8. **Export depends on reports and transactions**, and its "full Export" variant is a freemium gate in ID-06.

---

## 14. Risks and Constraints

### 14.1 Risks stated in the source (§15) with their stated mitigations

| Risk | Stated mitigation |
|---|---|
| User churn due to difficulty of data entry | Minimal entry form, shortcuts, future voice/natural-text input |
| Distrust of calculation accuracy | Financial core fully deterministic, AI-independent, **auditable** |
| Sensitivity of financial data and privacy | Data encryption, no direct bank connection in early versions, full user control over data |
| High cost of AI at scale | Use AI only in the interaction/explanation layer, not in core calculations |
| Competition with existing finance apps | Focus on fast entry + understandable insight as the core competitive advantage |

### 14.2 Business/product constraints

- **C-1:** Early versions handle **only user-entered data** — no Open Banking, no real transactions, no in-app payments, no card management (§10).
- **C-2:** The product team must **not** build or maintain a large category dictionary (§6.1.1).
- **C-3:** AI must remain an addable final layer; the core must never be rewritten to accommodate it (§4.4, §5, §11).
- **C-4:** The MVP category engine must not use AI (§6.1.1).
- **C-5:** The V3 NLP engine must reuse the transaction table **without schema change** (§6.1.1).

### 14.3 Additional risks identified by this analysis (not in the source)

- **R-A: Health Score is unbuildable as specified.** Seven named inputs, zero defined formulas, and two inputs that have no MVP data source. Shipping a wrong-feeling 0–100 number directly attacks the "distrust of calculation accuracy" risk the document itself flags as critical.
- **R-B: The similarity engine's quality is unmeasurable without a threshold and an evaluation set.** A too-low threshold silently miscategorizes; a too-high one degrades to "ask every time" and destroys the <10s KPI.
- **R-C: Silent auto-categorization vs. trust.** FR-NLQ-06 says "automatically suggest"; if the system auto-*assigns* without visible confirmation, users may accumulate wrong categories that then poison the history the engine learns from (a feedback loop).
- **R-D: MVP surface is large.** P0 + P1 together span 16 feature areas including reports at four granularities, five chart types, a rule engine, a scoring system, and three export formats — heavy for an MVP whose stated purpose is only "prove that recording and understanding expenses works".
- **R-E: Offline-first / local-only are not retrofittable.** Deferring the ID-01/ID-02 decision past architecture risks exactly the core rewrite that C-3 forbids.
- **R-F: Calendar and number localization.** Persian users, Persian digits, Jalali months — and every budget/report rule is month-boundary-dependent. Getting this wrong invalidates every monthly calculation.
- **R-G: Monetary precision.** Toman amounts in the billions (the source's own «۱۰۰۰ میلیون» example) combined with percentage and averaging math require an explicit precision/rounding policy; none is stated. Floating-point drift would directly violate NFR-04/NFR-06.

---

## 15. Ambiguities and Open Questions

| ID | Item | Where | Nature |
|---|---|---|---|
| A-1 | "Recurring transaction" is listed as a **transaction type** in §6.1 but as a **separate entity** in §6.10/§11.2 | §6.1 vs §6.10, §11.2 | **Conflict** |
| A-2 | Similarity threshold value and the choice between Levenshtein and n-gram are left open ("e.g.") | §6.1.1 | Incomplete |
| A-3 | "Normal amount ceiling" for the unusual-amount guard is undefined (per-user? per-category? statistical?) | §6.1.1 | Incomplete |
| A-4 | The unusual-amount guard offers "record as a **new asset**" — but `Asset` is a **V2** entity | §6.1.1 vs §11.2 | **Conflict** |
| A-5 | Period comparison says "this quarter vs. last quarter, etc." — the full set of comparable periods is open | §6.8 | Incomplete |
| A-6 | Recurring transactions: does the system **auto-create** the transaction on the due date, or only remind? Allowed repetition periods? Reminder lead time? | §6.10 | Incomplete |
| A-7 | Goal "current amount": manually entered, linked to a savings account, or derived from computed savings? | §6.11 | Incomplete |
| A-8 | Health Score requires **debt level** and **emergency balance**; Debt is V2 and emergency balance is never defined | §6.13 vs §11.2 | **Conflict** |
| A-9 | Alert thresholds for abnormal expense increase, balance drop, goal lag, savings-rate decline are all unstated; delivery channel unstated | §6.14 | Incomplete |
| A-10 | V2 pattern analysis needs transaction **time of day**, but the transaction schema lists only **date** | §7.2 vs §6.1 | **Conflict** (forward-compat) |
| A-11 | Calendar system (Jalali vs. Gregorian) is never stated, yet all budgets/reports are month-bounded | Throughout | Missing |
| A-12 | Quick entry requires amount + category, but §6.1.1 allows saving after asking "once" — can a transaction exist **without** a category? | §6.1 vs §6.1.1 | Ambiguous |
| A-13 | "Savings" is used throughout (dashboard, reports, health score) but never defined. Is it `income − expense`, or only money moved to a savings account? | §6.5, §6.6, §6.13 | Missing definition |
| A-14 | "3-month average" — rolling 3 months or the previous 3 calendar months? Including or excluding the current month? | §6.6 | Ambiguous |
| A-15 | Are Insights and Alerts distinct concepts? §6.12 and §6.14 overlap heavily (both cover expense increase and savings-rate decline); §11.2 lists only `Alert` and `Insight` as separate entities | §6.12 vs §6.14 | Ambiguous / overlapping |
| A-16 | Target platform is never stated (mobile app? web? both?) — yet §16.4 mentions a phone widget and §4.1 describes touch interaction | Throughout | Missing |
| A-17 | Authentication, accounts, sign-up, multi-device: entirely absent, yet `User` is entity #1 and §16.2 offers a no-cloud mode | §11.2 vs §16.2 | Missing |
| A-18 | Multi-currency / foreign currency: §7.5 lists "ارز" (foreign currency) as a V2 **asset**, but no currency field or FX handling is defined anywhere | §7.5 | Missing |
| A-19 | Income categories: the 13 default categories are all expense-oriented; how income is categorized is unstated | §6.3 | Missing |
| A-20 | §16 ideas carry **no version assignment** — including the freemium model, which constrains budget/goal limits | §16 | Unassigned |
| A-21 | Rounding/precision policy for money and percentages is unstated, despite NFR-04's determinism requirement | Throughout | Missing |
| A-22 | When is the rule engine evaluated — on transaction write, on a schedule, or on dashboard read? Affects alert freshness and cost | §6.12, §6.14 | Missing |
| A-23 | Deleting a category or an account that has transactions: behaviour unstated (and it would corrupt the §6.1.1 history corpus) | §6.3, §6.2 | Missing |
| A-24 | Editing/deleting a past transaction retroactively changes balances, budgets, insights, and the health score — recalculation and audit policy unstated, though NFR-06 demands auditability | §6.4 vs §15 | Missing |
| A-25 | Empty/cold-start state: what the dashboard, reports, insights, and health score show for a user with no history | Throughout | Missing |

---

## 16. Architectural Principles That Must Be Preserved

These are drawn from the source and are **binding** on any future architecture. They are stated as principles, not as technology choices.

### AP-1 — The financial core is deterministic (§4.3, §15)
Every financial number — sums, percentages, budgets, savings, health score — is produced by the Financial Engine, and the same inputs must always produce the same output. No probabilistic component may ever be in the path that produces a number shown to the user as fact.

### AP-2 — The financial core is testable (§4.3)
The calculation layer must be exercisable in isolation from UI, storage, and any external service. Its correctness must be demonstrable by test, not by inspection.

### AP-3 — The financial core is auditable (§15)
A user (and the team) must be able to trace any displayed figure back to the transactions and rules that produced it. This is the stated mitigation for the "distrust of calculation accuracy" risk, and it carries implications for how edits, deletions, and recalculations are recorded (see A-24).

### AP-4 — The financial core is independent of AI (§4.3, §5, §8)
> "AI is a layer on top of the financial platform, not a replacement for it."

AI is permitted only two roles: (a) interpreting natural-language *input*, and (b) *explaining* outputs the engine already computed. AI is never a source of numbers.

### AP-5 — AI is isolated from data (§8.3)
The mandated path is `question → intent → financial query → Analytics Engine → structured data → AI → answer`. **AI never has direct database access.** Any architecture must make this structurally impossible, not merely conventional.

### AP-6 — Layer separation (§11.1)
Six named layers with explicit responsibilities:

| Layer | Responsibility |
|---|---|
| Transaction System | Create, edit, delete transactions and accounts |
| Financial Engine | Deterministic calculations: balance, income/expense totals, budget, savings |
| Analytics Engine | Trend analysis, period comparison, spending patterns |
| Insight / Rule Engine | Generate alerts and insights from pre-defined rules |
| Forecasting | Statistical prediction from historical data |
| AI Layer (V3+) | Natural-language input, conversation, explanation, and recommendation over structured data |

The document's stated benefit of this separation: *"a system that is more accurate, more testable, more reliable, and independent of future changes in AI models."*

### AP-7 — Build order is the dependency order (§11)
`Transaction System → Financial Engine → Analytics Engine → Budget & Goals → Insight Engine → Forecasting → AI Layer`. Each layer must be complete and useful before the next is added.

### AP-8 — Extensibility without core rewrite (§4.4)
Adding AI, OCR, and advanced forecasting later must not require rewriting the core. Extension points must exist from day one, even while unused.

### AP-9 — Schema stability for future NLP (§6.1.1)
The transaction table must be usable directly as V3 NLP training data **without structural change**. This makes the Transaction schema a long-lived contract, not an implementation detail.

### AP-10 — Rules are explicit and externalized (§6.9, §6.12, §6.14)
Thresholds (80%, 100%, 20%, 30%) are business rules, not scattered constants. They must be inspectable and changeable as rules, consistent with AP-2 and AP-3.

### AP-11 — User data sovereignty (§4.5)
View, edit, delete, and export must be first-class capabilities, not afterthoughts — including export in three formats.

### AP-12 — Minimal-input UX is an architectural constraint, not a UI preference (§4.1)
The <10-second target constrains how much the system may require at write time, and therefore what may be mandatory in the data model and what must be inferred or deferred.

### AP-13 — Every analytical output carries a narrative (§4.2)
A report is not complete without its conclusion sentence. The sentence generation for MVP is **rule-based** (AP-4) — narrative generation must therefore be a deterministic, templated capability of the engine layer, not a presentation-layer flourish.

---

## 17. Technical Implications

Implications only — **no technology is being chosen here.** Each is a consequence of a stated requirement.

1. **Money representation needs an exact-arithmetic policy.** NFR-04 (determinism) + NFR-06 (auditability) + toman amounts reaching 10⁹ + percentage math ⇒ a defined precision, rounding mode, and storage unit are prerequisites. (A-21)
2. **Derived-vs-stored balance is a real decision.** FR-ACC-03 says balance is *calculated*. Recomputing from history is the most auditable; it has performance consequences as history grows. The document does not decide this.
3. **Retroactive edits demand a recalculation strategy.** Editing an old transaction changes balances, past budget states, past insights, and the health score. AP-3 (auditability) implies some form of change history. (A-24)
4. **Time is a domain concept, not a utility.** Month boundaries drive budgets, monthly reports, the 3-month average, and goal deadlines. Calendar system (A-11), timezone, and week-start day must be defined once and used everywhere.
5. **The rule engine must be data-driven.** Thresholds appear in at least 11 rules, four of which are undefined. They should be configurable rule definitions so they can be tuned without touching calculation logic (AP-10).
6. **The narrative generator is a first-class engine component.** FR-REP-01, FR-CMP-02, and the executive-summary example all require templated, deterministic sentence construction with variable substitution and comparative logic — in Persian.
7. **The similarity engine has a performance profile.** Comparing each new input against a user's full transaction-description history is O(history). This needs a bounded strategy (recency window, candidate pre-filter) that does **not** compromise determinism (BR-30).
8. **Transfers need a representation that structurally enforces BR-01.** Whatever the model, income/expense aggregation must be unable to accidentally include transfers.
9. **The Analytics Engine must be query-addressable from day one.** FR-AI-03's mandated path only works if Analytics exposes named, parameterized financial queries returning structured data. Designing Analytics as a UI-shaped API would make V3 unbuildable without violating AP-8.
10. **Export in three formats is three different concerns** (CSV = data, Excel = formatted data, PDF = rendered document with charts and narrative). PDF in particular is a rendering pipeline, not a serializer.
11. **Offline-first (ID-01) and local-only (ID-02) are data-architecture forks.** Either implies conflict resolution, local persistence, and possibly a client-side calculation engine — which would put AP-1/AP-2 (currently assigned to "Backend and Financial Engine" in §4.3) partly on the client. This is a decision that must be made before architecture, not after.
12. **The freemium model (ID-06) is an entitlement concern** that touches budget and goal creation, export, insights, and forecasting. If adopted at all, entitlement checks must be designed in, not bolted on.
13. **Persian-language processing is a core-path dependency.** FR-NLQ-02 must handle Persian digits, Persian number words, and the thousand/million multipliers; text similarity (BR-26) must handle Persian normalization (ی/ي, ک/ك, ZWNJ, diacritics). This is deterministic text processing, and it is on the critical path of the product's headline feature.
14. **Alert/insight generation timing affects everything downstream** — freshness, cost, and whether alerts are stored entities or computed views. (A-22)
15. **The 7 health-score inputs span four subsystems** (transactions, budgets, goals, and V2 debt). Until the formula and the V2 dependency are resolved, this feature cannot be scoped.

---

## 18. Recommended Next Steps

Ordered, and deliberately stopping short of architecture.

1. **Resolve the blocking ambiguities.** At minimum A-1, A-4, A-8, A-11, A-12, A-13, A-14, A-21 — these change the data model and the calculation definitions.
2. **Write the calculation specification.** A precise, testable definition of every financial figure: savings, savings rate, 3-month average, budget consumption, goal progress, required monthly saving, and each of the seven health-score inputs — each with a worked example, as the source itself does for budget (72%) and goals (10M).
3. **Decide the version assignment of the §16 ideas**, prioritizing ID-01 (offline-first), ID-02 (local-only), and ID-06 (freemium) — the three that are not retrofittable.
4. **Fix the rule catalogue.** All thresholds from §6.9/§6.12/§6.14 in one table with defined values, including the four currently blank ones, plus a decision on the Insight-vs-Alert overlap (A-15).
5. **Specify the category-detection engine precisely:** the base dictionary's exact word list, the similarity algorithm, the threshold, the normalization rules for Persian text, the candidate scope, the suggest-vs-auto-assign behaviour (R-C), and the unusual-amount ceiling definition.
6. **Confirm the MVP cut.** Given R-D, decide explicitly whether all of P0+P1 ships in V1, or whether V1 ships P0 plus a named subset of P1. This is the source's own step 1 in §17.
7. **Lock the Transaction schema as a long-lived contract** (AP-9), including the date/time question raised by A-10.
8. **Then** — and only then — proceed to data model and Financial Engine design (§17 step 2 of the source), followed by a prototype of quick entry + dashboard (§17 step 3).

---

## DECISIONS THAT REQUIRE HUMAN APPROVAL

Each item below must be decided by a human before architecture or implementation begins. None of them can be safely inferred from the document.

### Scope and product strategy

| # | Decision | Why it blocks |
|---|---|---|
| D-01 | **Is the MVP all of P0 + P1, or P0 plus a named subset of P1?** | Determines whether budgets, goals, insights, health score, recurring, and export are in V1 at all (R-D) |
| D-02 | **Is the product offline-first (ID-01)?** | Not retrofittable; determines the entire data and sync model |
| D-03 | **Is a local-only / no-cloud mode offered (ID-02)?** | Determines whether the server is authoritative and where the Financial Engine runs — directly affects §4.3's "Backend and Financial Engine" wording |
| D-04 | **Is the freemium model (ID-06) adopted, and is it in V1?** | Its limit of "max one active budget/goal" constrains the budget and goal domain design |
| D-05 | **Version assignment for ID-03 (gamification), ID-04 (widget), ID-05 (benchmarking), ID-07 (messenger bot)** | Currently unassigned; ID-05 additionally requires a privacy and consent design |
| D-06 | **Target platform(s): mobile, web, or both** (A-16) | Everything about delivery, offline, and the §16.4 widget depends on it |
| D-07 | **Is the Financial Health Score in the MVP at all?** | As specified it is unbuildable (A-8, R-A) and, if wrong, it attacks the product's own core trust proposition |

### Domain model

| # | Decision | Why it blocks |
|---|---|---|
| D-08 | **Is RecurringTransaction a transaction type or a separate entity?** (A-1) | Core schema decision |
| D-09 | **How is a transfer represented, and how is BR-01 structurally enforced?** | The single most important correctness rule in the product |
| D-10 | **Does Transaction store time-of-day as well as date?** (A-10) | V2 pattern analysis needs it; AP-9 forbids changing the schema later |
| D-11 | **Can a transaction exist without a category?** (A-12) | Affects quick entry, the <10s KPI, and all category reporting |
| D-12 | **Calendar system: Jalali or Gregorian (or both), plus week-start day and timezone** (A-11) | Every monthly and weekly calculation depends on it |
| D-13 | **Single-currency (toman) or multi-currency?** (A-18) | Retrofitting currency is a schema-wide change |
| D-14 | **How is Goal "current amount" sourced** — manual, linked account, or derived savings? (A-7) | Determines whether Goal is standalone or coupled to accounts |
| D-15 | **How are income transactions categorized?** (A-19) | The 13 defaults are expense-oriented |
| D-16 | **Delete/edit semantics for categories and accounts that have transactions** (A-23) | Deleting history also degrades the §6.1.1 similarity engine |

### Financial calculation definitions

| # | Decision | Why it blocks |
|---|---|---|
| D-17 | **The definition of "savings" and "savings rate"** (A-13) | Used on the dashboard, in three reports, in insights, alerts, and the health score |
| D-18 | **The definition of "3-month average"** (A-14) | Required by the monthly report |
| D-19 | **The full Financial Health Score formula**: the seven inputs, their definitions, weights, and what to do when debt data does not exist in MVP (A-8) | Feature is unbuildable without it |
| D-20 | **Money precision, storage unit, and rounding policy** (A-21, R-G) | Required for NFR-04 determinism and NFR-06 auditability |
| D-21 | **Whether account balance is stored or always recomputed** | Audit/performance trade-off |
| D-22 | **Recalculation and audit policy for retroactive edits and deletions** (A-24) | AP-3 auditability depends on it |

### Rules engine

| # | Decision | Why it blocks |
|---|---|---|
| D-23 | **The four missing thresholds**: abnormal expense increase, account-balance drop, goal lag, savings-rate decline (A-9, BR-18…BR-22) | Alerts cannot be implemented |
| D-24 | **The recurring-payment reminder lead time and whether occurrences auto-post** (A-6) | Changes whether recurring writes to the ledger |
| D-25 | **Are Insight and Alert one concept or two?** (A-15) | They overlap on two rules today |
| D-26 | **When the rule engine runs** — on write, on schedule, or on read (A-22) | Affects freshness, storage, and cost |
| D-27 | **Notification channel(s) for alerts** | Not specified anywhere |
| D-28 | **Cold-start behaviour** for dashboard, reports, insights, and score (A-25) | The first-run experience is the retention-critical moment |

### Category-detection engine (§6.1.1)

| # | Decision | Why it blocks |
|---|---|---|
| D-29 | **The exact base-dictionary word list** (FR-NLQ-04 says "a few dozen") | Layer 1 of the headline feature |
| D-30 | **The similarity algorithm and its threshold value** (A-2) | Determines accuracy and the <10s KPI |
| D-31 | **Suggest vs. auto-assign** — is the detected category shown for confirmation or applied silently? (R-C) | Wrong choice poisons the history corpus the engine learns from |
| D-32 | **The "normal amount ceiling" definition** for the unusual-amount guard (A-3) | Needed for FR-NLQ-08 |
| D-33 | **What the "record as a new asset" branch does in MVP, given Asset is a V2 entity** (A-4) | An MVP flow currently terminates in a non-existent entity |
| D-34 | **Persian text normalization rules** (ی/ي, ک/ك, ZWNJ, diacritics, Persian/Arabic/Latin digits) | On the critical path of the product's headline feature |

### Non-functional targets

| # | Decision | Why it blocks |
|---|---|---|
| D-35 | **Authentication, account model, and multi-device expectations** (A-17) | `User` is entity #1 and nothing about identity is specified |
| D-36 | **Encryption scope**: what is encrypted, at rest and/or in transit, and under whose key (NFR-10) | Especially consequential if D-03 (local-only) is yes |
| D-37 | **Performance and scale targets** — report latency, transaction volume per user, concurrent users | None are stated |
| D-38 | **Data retention, backup, and full-account-deletion policy** | Implied by NFR-09 user control; never specified |
| D-39 | **What "auditable" means operationally** (NFR-06) — user-facing traceability, internal audit log, or both | It is the stated mitigation for the product's most dangerous risk |
| D-40 | **Accessibility and language scope** (Persian only? RTL-only?) | Not specified |

---

*Analysis complete. Per instruction, no architecture, technology selection, or implementation follows. Awaiting explicit approval to proceed.*
