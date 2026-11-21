# PWS V1 — Product Requirements Document (PRD)

**Product:** PWS — Personal Wallet & Spending  
**Version:** 1.0  
**Document status:** Finalized product definition  
**Release scope:** V1 / MVP  
**Platform:** Android-first, installable Progressive Web App (PWA)  
**Primary currency:** PKR (₨)  
**Primary language:** English (initial release)  
**Design mode:** Light theme  
**Product model:** Individual, offline-first personal finance management

---

# 1. Executive Summary

## 1.1 Product overview

PWS is a simple, offline-first personal finance application that helps individuals record income and expenses, understand their spending habits, manage budgets, and maintain control over their financial records.

The product is designed around one central principle:

**A user should be able to manage personal finances quickly, reliably, and without depending on an internet connection or creating an account.**

PWS provides five primary navigation areas:

1. Home
2. Transactions
3. Analytics
4. Budget
5. More / Settings

Its primary action is Add Transaction.

The application uses a unified financial data source. Transactions entered by users drive the balance, transaction history, analytics, and budget calculations. An optional opening balance establishes the user's starting financial position. Monthly budgets support rollover of unused amounts.

## 1.2 Product vision

To make everyday personal finance tracking accessible, understandable, and reliable through a lightweight application that gives users a clear picture of their money without unnecessary complexity.

## 1.3 Problem statement

Individuals often need a straightforward way to answer basic financial questions:

- How much money do I currently have available?
- How much did I earn?
- How much did I spend?
- Where is my money going?
- Am I staying within my budget?
- Can I access my records when I am offline?
- Can I recover my financial data if something goes wrong?

PWS addresses these needs through transaction recording, financial summaries, spending analytics, budget tracking, and user-controlled data backup.

**Product hypothesis:** A focused experience with low-friction transaction entry and understandable financial summaries can make consistent personal finance tracking easier.

This is a product hypothesis to validate through actual usage, not a claim supported by completed user research.

---

# 2. Product Goals and Objectives

## 2.1 Primary goals

| ID | Goal | Expected outcome |
|---|---|---|
| G-01 | Simplify financial tracking | Users can record income and expenses quickly |
| G-02 | Improve financial visibility | Users can understand income, expenses, and available balance |
| G-03 | Support spending awareness | Users can review weekly and monthly spending patterns |
| G-04 | Enable budget control | Users can set limits, monitor spending, and carry forward unused budget |
| G-05 | Protect financial records | Users can export and restore their data |
| G-06 | Support offline usage | Core financial operations work without internet access |
| G-07 | Maintain simplicity | Users can access essential functions without complicated onboarding |

## 2.2 Secondary goals

- Provide reusable categories and payment methods.
- Keep financial calculations consistent throughout the application.
- Support an installable mobile experience.
- Make the product maintainable and extensible for future releases.

## 2.3 Non-goals

The following are deliberately excluded from V1:

- AI financial advice or AI spending recommendations.
- Bank account integration.
- Automatic bank transaction imports.
- Investment and stock tracking.
- OCR receipt scanning.
- Multiple currencies.
- Social finance features.
- Shared wallets or family accounts.
- Complex accounting functionality.
- Advanced notifications.
- Cloud account registration and cloud synchronization in the initial MVP.

These exclusions protect the product from unnecessary scope expansion.

---

# 3. Target Users and User Needs

PWS is intended for individual users who want to understand and manage their everyday finances.

## 3.1 Primary user groups

### Persona A — Everyday Expense Tracker

**Profile:** An individual who wants to record daily spending.

Needs:

- Quickly add expenses.
- Categorize transactions.
- View recent spending.
- Check available balance.

Success scenario:  
The user purchases groceries, records the expense, and immediately sees the updated financial summary.

### Persona B — Monthly Budget Planner

**Profile:** An individual who manages monthly income and spending limits.

Needs:

- Define a monthly budget.
- Carry unused budget into the next month.
- Set category spending limits.
- Monitor remaining budget.
- Understand overspending.

Success scenario:  
The user sets a food budget, records food purchases, and sees how much of the limit remains. Any unused overall monthly budget is added to the next month's available budget.

### Persona C — Financial Awareness User

**Profile:** An individual who wants to understand where their money goes.

Needs:

- Review weekly spending.
- Compare income and expenses.
- Identify high-spending categories.
- Review historical transactions.

Success scenario:  
The user opens Analytics and discovers that food expenses represent a significant portion of their monthly spending.

These are representative product personas, not validated research profiles.

---

# 4. Product Structure and Information Architecture

## 4.1 Primary navigation

| Navigation | Main responsibility |
|---|---|
| Home | Financial overview and recent activity |
| Transactions | Complete income and expense history |
| Analytics | Financial summaries and spending breakdown |
| Budget | Spending limits and budget progress |
| More | Categories, payment methods, backup, preferences and help |

**Primary action:** + Add Transaction

## 4.2 Sitemap

PWS V1

- Home
  - Welcome / Setup
  - Initial Opening Balance Setup
  - Overview
  - Recent Transactions

- Add Transaction
  - Expense
  - Income

- Transactions
  - All
  - Income
  - Expense
  - Transaction Detail
    - Edit
    - Delete Confirmation

- Analytics
  - Week
  - Month
  - Category Breakdown

- Budget
  - Monthly Budget
  - Budget Rollover
  - Set Budget
  - Edit Category Budget

- More / Settings
  - Categories
  - Payment Methods
  - Opening Balance Settings
  - Export Data
  - Restore Data
    - Confirmation
    - Success
    - Error
  - Preferences
  - Help & FAQ
  - About

- Supporting States
  - Empty
  - Loading
  - Error
  - Success

---

# 5. Feature Prioritization

The MoSCoW framework is used to separate essential launch requirements from secondary functionality.

| Priority | Meaning |
|---|---|
| P0 — Must Have | Essential for a functional V1 |
| P1 — Should Have | Important supporting functionality |
| P2 — Could Have | Useful but not required for initial launch |
| P3 — Won't Have in V1 | Explicitly deferred |

## 5.1 Feature overview

| Feature | Priority | Release |
|---|---|---|
| First-time setup | P0 | V1 |
| Initial opening balance | P0 | V1 |
| Home overview | P0 | V1 |
| Add income and expense | P0 | V1 |
| Automatic transaction time capture | P0 | V1 |
| Transaction history | P0 | V1 |
| Transaction details | P0 | V1 |
| Edit and delete | P0 | V1 |
| Financial calculations | P0 | V1 |
| Weekly and monthly analytics | P0 | V1 |
| Category breakdown | P0 | V1 |
| Monthly budget | P0 | V1 |
| Monthly budget rollover | P0 | V1 |
| Category budget | P1 | V1 |
| Categories management | P1 | V1 |
| Payment methods management | P1 | V1 |
| Export and restore | P0 | V1 |
| Preferences | P1 | V1 |
| Help and FAQ | P2 | V1 |
| About | P2 | V1 |
| Cloud synchronization | P3 | Future |
| AI financial assistant | P3 | Future |

---

# 6. Core Functional Requirements

## FR-01 — First-Time Setup and Onboarding

**Priority:** P0

### Purpose

Allow users to start using PWS without complicated registration or unnecessary setup.

### Requirements

- Display a welcome/setup experience on first launch.
- Allow an optional user name.
- Allow the user to optionally verify an email address using an emailed sign-in link.
- Allow the user to enter an initial opening balance.
- The opening balance must be optional.
- If skipped, the opening balance defaults to zero.
- Do not require account registration.
- Do not require an internet connection.
- Allow the user to continue to Home without verifying an email address.
- Provide a clear Continue to Home action.
- Initialize the local application data where required.

### Acceptance criteria

- A new user can reach Home without creating an account.
- Email verification is optional; a user can continue while offline or while an email link is pending.
- Skipping the optional name does not prevent application usage.
- Skipping the opening balance initializes it to zero.
- Entering an opening balance initializes the user's financial position correctly.
- Reopening the app does not unnecessarily repeat onboarding.
- The app remains usable offline.

---

## FR-02 — Opening Balance Management

**Priority:** P0

### Purpose

Allow users who are starting to track their finances to enter the amount of money they already have, rather than incorrectly starting their financial position at zero.

### Requirements

- Users can enter an initial opening balance during setup.
- The opening balance is stored separately from income and expense transactions.
- Opening balance must be a valid monetary amount.
- The user must be able to review the opening balance in the appropriate settings or financial overview area.
- Any later correction must be handled as an explicit opening-balance adjustment, not by creating an artificial income transaction.
- The application must recalculate the available balance after an opening-balance change.

### Financial calculation

**Available Balance = Opening Balance + Total Income − Total Expenses**

Where:

- Opening Balance is the user's starting financial amount.
- Total Income is the sum of recorded income transactions.
- Total Expenses is the sum of recorded expense transactions.

### Important rules

- Opening balance is not income.
- It must not inflate income analytics.
- It must not appear as an ordinary income transaction in transaction history.
- If no opening balance is entered, its value is zero.
- All financial views must use the same opening-balance value when calculating the available balance.

### Acceptance criteria

- A user can start with a non-zero opening balance.
- A user can start with a zero opening balance.
- The Home balance reflects the opening balance correctly.
- Adding income increases the available balance.
- Adding expenses decreases the available balance.
- Opening balance is excluded from income and expense analytics.
- Correcting the opening balance updates the financial position consistently.

---

## FR-03 — Home Dashboard

**Priority:** P0

### Purpose

Provide an immediate understanding of the user's financial position.

### Required information

- Greeting / welcome.
- Available balance.
- Total income.
- Total expenses.
- Weekly spending summary.
- Recent transactions.
- Primary Add Transaction action.

### Financial calculation

Available Balance = Opening Balance + Total Income − Total Expenses

### Acceptance criteria

- Home displays values calculated from actual opening-balance and transaction records.
- Adding a transaction updates the relevant financial summary.
- Editing or deleting a transaction updates all dependent values.
- Updating the opening balance recalculates available balance.
- Recent transactions reflect the latest saved records.
- Empty states appear when there is no financial activity.

### Important rule

Home must never rely on manually hardcoded financial totals.

---

## FR-04 — Add Transaction

**Priority:** P0

### Purpose

Allow users to record income or expenses with minimal effort.

### Transaction types

- Income
- Expense

### Required transaction fields

| Field | Requirement |
|---|---|
| Type | Required: Income or Expense |
| Amount | Required, positive numeric value |
| Category | Required |
| Description | Optional |
| Payment Method | Selectable from available methods |
| Date | Required, defaults to the current date; user can select another date |
| Time | Automatically captured when the transaction is first saved; not manually editable |

### Functional requirements

- Users select Income or Expense.
- Users enter an amount.
- Users select a category.
- Users can add an optional description.
- Users can select a payment method.
- Users can choose a transaction date.
- The transaction date defaults to the current date.
- The application automatically captures the current time at the moment of the initial save.
- The captured time is stored with the transaction and cannot be manually edited.
- The automatically captured time is preserved when the transaction is edited.
- The application validates the input before saving.
- Successful transactions are stored locally.
- The user receives a non-blocking success confirmation.

### Financial rules

- Amount must be greater than zero.
- Negative amounts are not accepted.
- The user selects the transaction type instead of entering a signed amount.
- Expense and income are stored as positive amounts with a separate transaction type.
- PKR is the only supported currency in V1.

### Acceptance criteria

- A valid income transaction can be saved.
- A valid expense transaction can be saved.
- Invalid amounts are rejected with a clear message.
- Transaction date is stored correctly.
- Time is captured automatically at initial save.
- Users cannot manually change the captured time.
- Editing a transaction does not replace its original captured time.
- A transaction remains available after refreshing or reopening the application.
- If saving fails, the user is informed and the entered draft is retained.

---

## FR-05 — Transaction History

**Priority:** P0

### Purpose

Allow users to review their financial activity.

### Requirements

- Display all transactions.
- Separate Income and Expense views.
- Show transaction amount, category, date, automatically captured time, and relevant details.
- Provide access to transaction details.
- Organize transactions using date-based grouping.

### Acceptance criteria

- All saved transactions appear in the history.
- Income and Expense views display the correct records.
- Transaction details match the saved record.
- Recorded time is displayed consistently where transaction details are shown.
- Empty states are provided when a list contains no records.

### V1 scope clarification

Advanced search and filtering are excluded from the current MVP. The primary history controls are All, Income, and Expense.

---

## FR-06 — Transaction Details, Editing and Deletion

**Priority:** P0

### Purpose

Give users control over existing financial records.

### Requirements

- Open an individual transaction.
- Display its complete available information, including date and automatically captured time.
- Allow editing through the reusable transaction form.
- Allow deletion through a confirmation dialog.
- Provide a safe cancellation path.
- Do not allow manual editing of the original captured time.

### Acceptance criteria

- Saving changes updates the original transaction.
- Editing a transaction does not change its original captured time.
- Canceling an edit does not change the stored record.
- Deletion requires explicit confirmation.
- Canceling deletion preserves the transaction.
- Confirmed deletion removes the transaction.
- All dependent financial summaries recalculate after modification or deletion.

---

## FR-07 — Financial Calculations and Data Consistency

**Priority:** P0

### Purpose

Ensure that financial information remains accurate across the entire application.

### Core calculations

Total Income = Sum of income transactions

Total Expenses = Sum of expense transactions

Available Balance = Opening Balance + Total Income − Total Expenses

Category Spending = Sum of expense transactions assigned to that category

### Requirements

- Maintain one source of truth for financial records.
- Home, Analytics, and Budget must derive relevant information from the same transaction data.
- Opening balance must be treated as a separate starting value.
- Opening balance must not be included in income or expense totals.
- Avoid storing redundant calculated totals as independent financial records.
- Use consistent currency formatting.

### Acceptance criteria

- The same transaction set produces consistent totals across relevant screens.
- Adding, editing, and deleting records updates dependent views.
- Updating opening balance recalculates the available balance.
- Income is never accidentally included in expense totals.
- Category calculations use the correct category association.
- Opening balance does not appear in income analytics.

---

## FR-08 — Analytics

**Priority:** P0

### Purpose

Help users understand their financial activity over time.

### Required views

- Weekly analytics.
- Monthly analytics.
- Category spending breakdown.

### Requirements

- Calculate income and expenses from transactions.
- Group spending by category.
- Display spending information through clear visualizations.
- Support weekly and monthly reporting periods.
- Keep opening balance separate from income analytics.
- Provide an entry point to personal notes from Analytics.
- Let users create, search, edit, pin, archive, and delete notes stored on the device.
- Keep personal notes separate from financial records and Cloud Sync.

### Acceptance criteria

- Weekly analytics use the correct seven-day period.
- Monthly analytics use the correct calendar month.
- Category totals match the underlying expense records.
- Opening balance does not inflate income totals.
- Empty analytics states are displayed when no relevant records exist.
- Analytics update after transaction changes.
- Opening a note displays its editable content, and note changes persist between app launches on the same device.

---

## FR-09 — Budget Management

**Priority:** P0

### Purpose

Help users set spending limits, monitor their progress, and retain unused budget for future months.

### Required functionality

- Set a monthly budget.
- Edit the monthly budget.
- Carry unused monthly budget into the following month.
- Set category budgets.
- Edit category budgets.
- Display spending progress.
- Display remaining budget.
- Display the amount carried forward where relevant.

### Core calculations

Monthly Available Budget = Monthly Base Budget + Previous Month's Unused Budget

Remaining Budget = Monthly Available Budget − Actual Monthly Spending

Budget Progress (%) = Actual Monthly Spending ÷ Monthly Available Budget × 100

### Budget rollover rules

1. The budget cycle follows the calendar month.
2. The user's defined monthly budget is the base allocation for each month.
3. At the end of each month, any positive unused amount is carried forward.
4. The carried-forward amount is added to the next calendar month's base budget.
5. Actual spending is deducted from the combined available budget.
6. If the user spends more than the available budget, the unused amount is zero. Overspending does not create a negative carry-forward.
7. The application must retain month-specific budget and rollover information so historical budget reports remain consistent.
8. A change to a future month's base budget must not silently rewrite previous months' spending history.

### Example

| Month | Base Budget | Carry Forward | Available Budget | Actual Spending | Unused Amount |
|---|---:|---:|---:|---:|---:|
| January | ₨20,000 | ₨0 | ₨20,000 | ₨15,000 | ₨5,000 |
| February | ₨20,000 | ₨5,000 | ₨25,000 | ₨18,000 | ₨7,000 |
| March | ₨20,000 | ₨7,000 | ₨27,000 | ₨29,000 | ₨0 |

### Acceptance criteria

- Users can enter a positive PKR base budget.
- Users can update their monthly budget.
- Actual spending is calculated from relevant expense transactions.
- Unused positive budget carries into the next calendar month.
- The next month's available budget includes its base allocation and prior carry-forward.
- Overspending does not create a negative rollover.
- Remaining amounts update when transactions change.
- Historical months retain their correct budget and rollover values.
- The UI distinguishes base budget, carried-forward amount, available budget, and actual spending.
- Zero or invalid budget amounts are handled safely.

### Important distinction

A budget is user-defined information. Actual spending is derived from transaction records. Carried-forward budget is a separate amount derived from the previous month's unused budget. These must not be treated as transaction income.

**Category-budget rollover is not yet defined.** The confirmed carry-forward decision applies to the overall monthly budget. Category-specific rollover behaviour remains a product clarification.

---

## FR-10 — Categories Management

**Priority:** P1

### Purpose

Allow users to organize income and expenses into meaningful groups.

### Requirements

- Display available categories.
- Provide supplied default categories.
- Allow category management.
- Associate transactions with valid categories.
- Distinguish income and expense categories where applicable.

### Acceptance criteria

- Users can select valid categories while recording transactions.
- Category changes are reflected in relevant transaction and analytics views.
- Existing transaction relationships are not silently broken by category management.

Category deletion and reassignment rules require final confirmation before implementation.

---

## FR-11 — Payment Methods Management

**Priority:** P1

### Purpose

Allow users to identify how transactions were paid or received.

### Requirements

- Display available payment methods.
- Provide supplied default methods.
- Allow users to manage the available list.
- Support selecting a payment method while adding or editing a transaction.

### Acceptance criteria

- A transaction can reference a valid payment method.
- The selected method is visible in transaction details.
- Invalid or deleted method references are handled safely.

---

## FR-12 — Export Data

**Priority:** P0

### Purpose

Give users control over their financial information and provide a backup mechanism.

### Requirements

- Export the user's local finance data.
- Generate a structured backup file.
- Include relevant financial records and settings.
- Include opening balance and required budget rollover history.
- Include transaction dates and automatically captured times.
- Include a backup format version.
- Provide a clear success or error state.

### Acceptance criteria

- A valid export produces a downloadable backup.
- The exported data can be read and validated.
- The export includes all required records and financial settings.
- Opening balance is preserved.
- Budget rollover history is preserved.
- Transaction dates and captured times are preserved.
- Export failure does not modify the user's original data.

---

## FR-13 — Restore Data

**Priority:** P0

### Purpose

Allow users to recover their financial records from a previous backup.

### Requirements

- Allow selection of a backup file.
- Validate the backup format and content.
- Display a confirmation before replacing existing records.
- Restore transactions, opening balance, budget information, and relevant settings.
- Restore original transaction dates and captured times.
- Perform the restore safely.
- Provide success and error states.

### Acceptance criteria

- Invalid files are rejected.
- Existing data is not replaced before confirmation.
- A successful restore produces consistent records and relationships.
- Opening balance is restored correctly.
- Budget rollover information is restored correctly.
- Transaction dates and captured times remain intact.
- Failed restores do not leave partially replaced data.
- The user receives a clear success or error message.

Restore is a destructive operation and must be treated as a high-risk user action.

---

## FR-14 — Preferences

**Priority:** P1

### Purpose

Allow users to manage supported application preferences.

### Source-defined preferences

- Currency: PKR fixed.
- Date format.
- Basic notifications.
- Opening balance management.

### Acceptance criteria

- Supported preferences can be viewed and changed where applicable.
- Preferences persist after reopening the application.
- Currency cannot be changed to an unsupported currency in V1.
- Any opening-balance correction is handled explicitly and recalculates financial information consistently.

Exact date-format options and notification types remain to be finalized.

---

## FR-15 — Help, FAQ and About

**Priority:** P2

### Purpose

Provide basic product guidance and application information.

### Requirements

- Provide a Help / FAQ area.
- Explain essential application functionality.
- Explain the distinction between opening balance, income, and expenses.
- Explain how monthly budget rollover works.
- Provide an About section with product information.

These pages must not block the delivery of core financial functionality.

---

# 7. Best-Case User Scenarios

The following scenarios describe the intended successful user experience. They also provide a foundation for QA testing.

## Scenario 01 — First-Time User

**Goal:** Start using PWS without registration.

1. User opens PWS.
2. Welcome / Setup appears.
3. User optionally enters a name.
4. User enters an opening balance or skips the field.
5. User continues to Home.
6. Home displays the correct initial financial position.
7. User can immediately add an income or expense.

**Expected outcome:** The user reaches a usable application without account creation or mandatory internet access. The financial starting point is initialized correctly.

## Scenario 02 — Record a Daily Expense

**Goal:** Record a purchase.

Example:

- Type: Expense
- Amount: ₨500
- Category: Food
- Payment Method: Cash
- Description: Lunch
- Date: Current date by default
- Time: Automatically captured when saved

Flow:

Home → Add Transaction → Expense → Enter Details → Save

**Expected outcome:**

- Expense is saved.
- Transaction date and captured time are stored.
- Transaction history updates.
- Home expense total updates.
- Available balance decreases by ₨500.
- Relevant analytics and budget calculations update.

## Scenario 03 — Record Monthly Income

**Goal:** Record salary or other income.

Example:

- Type: Income
- Amount: ₨40,000
- Category: Salary
- Date: Selected transaction date
- Time: Automatically captured when saved

**Expected outcome:**

- Income is saved.
- Income total increases.
- Available balance increases.
- Transaction history displays the new record with its date and captured time.

## Scenario 04 — Start With an Existing Balance

**Goal:** Initialize PWS using money the user already has.

Example:

- Opening balance: ₨30,000
- Total income: ₨10,000
- Total expenses: ₨4,000

Calculation:

Available Balance = ₨30,000 + ₨10,000 − ₨4,000

**Expected outcome:** Home displays ₨36,000. The opening balance is not counted as income or shown as an ordinary income transaction.

## Scenario 05 — Review Financial Position

**Goal:** Understand current finances.

1. User opens Home.
2. Reviews opening balance where relevant.
3. Reviews total income.
4. Reviews total expenses.
5. Reviews available balance.
6. Reviews recent transactions.

**Expected outcome:** The user can understand their current financial position without manually calculating totals.

## Scenario 06 — Understand Weekly Spending

**Goal:** Identify spending patterns.

1. User opens Analytics.
2. Selects Week.
3. Reviews the seven-day spending chart.
4. Reviews category breakdown.

**Expected outcome:** The user can understand how much was spent during the selected week and which categories contributed to that spending.

## Scenario 07 — Create and Monitor a Budget

**Goal:** Control monthly spending.

Example:

- Monthly base budget: ₨20,000
- Previous month's unused budget: ₨5,000
- Available budget: ₨25,000
- Actual spending: ₨12,500
- Remaining budget: ₨12,500

Flow:

Budget → Set Budget → Enter Amount → Save → Review Progress

**Expected outcome:** The application displays the base budget, carried-forward amount, available budget, actual spending, and remaining amount.

## Scenario 08 — Carry Unused Budget Forward

**Goal:** Retain unused budget for the next month.

1. User has a monthly base budget of ₨20,000.
2. Actual monthly spending reaches ₨15,000.
3. The month ends with ₨5,000 unused.
4. The next calendar month begins.
5. The application adds ₨5,000 to the next month's base budget.

**Expected outcome:** The next month's available budget is ₨25,000, assuming its base budget remains ₨20,000.

## Scenario 09 — Correct a Transaction

**Goal:** Fix an incorrect transaction.

1. User opens Transactions.
2. Selects a transaction.
3. Opens Transaction Detail.
4. Selects Edit.
5. Changes the amount or other editable details.
6. Saves changes.

**Expected outcome:** The original record is updated and all dependent financial calculations are recalculated. Its original automatically captured time remains unchanged.

## Scenario 10 — Delete an Incorrect Transaction

**Goal:** Remove an incorrect record safely.

1. User opens a transaction.
2. Selects Delete.
3. Reviews the confirmation dialog.
4. Confirms deletion.

**Expected outcome:** The transaction is removed and Home, Analytics, and Budget reflect the updated data.

## Scenario 11 — Use PWS Without Internet

**Goal:** Continue managing finances offline.

1. User opens the previously installed application.
2. Internet connectivity is unavailable.
3. User adds an expense.
4. User opens transaction history.
5. User checks Home and Budget.

**Expected outcome:** Core financial functionality continues working using local data.

## Scenario 12 — Export a Backup

**Goal:** Preserve financial records.

1. User opens More.
2. Opens Export Data.
3. Starts an export.
4. Receives the generated backup file.

**Expected outcome:** The user obtains a valid backup containing transactions, opening balance, budget rollover information, and required settings without changing the original records.

## Scenario 13 — Restore an Existing Backup

**Goal:** Recover financial data.

1. User opens Restore Data.
2. Selects a valid backup.
3. Application validates the file.
4. User reviews the replacement confirmation.
5. User confirms restoration.

**Expected outcome:** Local records, opening balance, budget rollover information, and original transaction timestamps are restored safely.

## Scenario 14 — Recover From an Operation Failure

**Goal:** Avoid accidental data loss.

Example: An expense cannot be saved.

1. User enters transaction information.
2. Save operation fails.
3. Application displays a clear error.
4. User's entered information remains available.
5. User retries.

**Expected outcome:** The application never silently discards the user's work.

---

# 8. Exception and Edge-Case Requirements

A finance application must handle more than ideal user flows.

| Situation | Expected application behaviour |
|---|---|
| Empty transaction history | Display a helpful empty state |
| Opening balance skipped | Initialize opening balance to zero |
| Invalid opening balance | Reject and explain validation |
| Amount is zero | Reject and explain validation |
| Negative amount | Reject |
| Invalid amount format | Show field-level error |
| Missing required category | Prevent saving |
| Database write fails | Retain draft and show error |
| User cancels editing | Preserve original record |
| User cancels deletion | Preserve transaction |
| Restore file is invalid | Reject without replacing records |
| Restore is interrupted | Preserve recoverable data and avoid partial replacement |
| No budget exists | Show setup prompt |
| Budget is exceeded | Show accurate overspending state; do not carry a negative amount forward |
| Unused budget remains | Carry positive remainder into the next month |
| No analytics data exists | Show empty analytics state |
| Device is offline | Continue supported local operations |
| Application is reopened | Restore locally persisted records |
| Transaction is edited | Preserve its original captured time |
| Transaction date is changed | Update the selected date without manually changing the captured time |

---

# 9. Non-Functional Requirements

These requirements define the expected quality of the product.

## NFR-01 — Usability

- The application must be understandable for everyday users.
- Core actions should require minimal interaction.
- Financial information must be visually distinguishable.
- Errors must use clear, actionable language.
- Opening balance and monthly budget rollover must be understandable to ordinary users.

## NFR-02 — Reliability

- Successful financial operations must persist.
- The application must not silently lose entered data.
- Failed operations must provide appropriate feedback.
- Financial calculations must remain consistent.
- Budget rollover must not duplicate or lose unused amounts.

## NFR-03 — Offline Availability

- Core financial operations must not depend on an active internet connection.
- Previously stored records must remain accessible offline.
- The installed application must provide the required local experience.

## NFR-04 — Performance

- Navigation should feel responsive.
- Common local reads and writes should complete without noticeable unnecessary delay.
- Large transaction histories should not make the application unusable.

Exact numerical performance targets require testing on representative devices.

## NFR-05 — Data Integrity

- Financial values must be stored and calculated consistently.
- Transactions must retain valid category and payment-method relationships.
- Opening balance must remain separate from transaction income and expenses.
- Budget rollover must be calculated and retained consistently across month boundaries.
- Restore operations must be validated and protected.
- Calculated information must have a single source of truth.
- Transaction capture time must remain stable after editing.

## NFR-06 — Security and Privacy

- Financial records must remain under the user's control.
- The application must avoid unnecessary collection of personal information.
- Sensitive financial details should not be exposed through unnecessary logs.
- Local data protection limitations must be documented accurately.

## NFR-07 — Maintainability

- The application should use reusable UI components.
- Business logic should be separated from presentation.
- Data access should be centralized.
- Database changes should be handled through controlled migrations.
- Financial calculations and budget rollover rules should be implemented as testable business logic.

## NFR-08 — Compatibility

- Mobile-first responsive behaviour.
- Installable PWA support.
- Android-focused interaction design.
- Same core application intended to support a future Android package.

---

# 10. UX and Design Requirements

The product should preserve the approved design direction.

| Design element | Requirement |
|---|---|
| Theme | Light only |
| Primary currency | PKR |
| Typography | Inter |
| Primary color | #17634f |
| Background | #F8FAFC |
| Surface | #FFFFFF |
| Main text | #111827 |
| Secondary text | #6B7280 |
| Border | #E5E7EB |
| Income | #16A34A |
| Expense | #DC2626 |
| Reference frame | 390 × 844 |
| Horizontal gutter | 16 px |
| Spacing scale | 4, 8, 12, 16, 24, 32 px |

### Navigation principles

- Keep the five primary destinations.
- Keep Add Transaction as the primary action.
- Clearly show the active navigation destination.
- Do not add unnecessary navigation items.

### State coverage

Every important screen should account for applicable:

- Default state.
- Loading state.
- Empty state.
- Focus state.
- Validation state.
- Error state.
- Success state.
- Disabled state.

### Financial presentation principles

- Display opening balance distinctly from income.
- Display base monthly budget separately from carried-forward budget.
- Display the total available budget clearly.
- Use consistent date and time presentation.
- Do not visually imply that opening balance is newly earned income.

---

# 11. Data and Financial Business Rules

This section defines product-level data expectations. The final database schema belongs in a separate Technical Architecture Document.

## 11.1 Primary data entities

| Entity | Purpose |
|---|---|
| Transaction | Stores income and expense records, including transaction date and captured time |
| Category | Classifies transactions |
| Payment Method | Identifies payment channels |
| Opening Balance | Stores the user's initial financial position |
| Budget | Stores user-defined base spending limits and rollover information |
| Budget History | Preserves month-specific budget allocation, spending, and rollover values |
| Preferences | Stores supported application settings |

## 11.2 Data relationships

- A transaction belongs to a transaction type.
- A transaction references a category.
- A transaction may reference a payment method.
- A transaction stores a user-selected date and an automatically captured time.
- Opening balance is maintained separately from transactions.
- A budget may represent a monthly overall limit or category-specific limit.
- Monthly budget history retains base allocation, carried-forward amount, and actual spending.
- Preferences belong to the local application/user context.

## 11.3 Data integrity principles

1. One transaction dataset powers all financial views.
2. Opening balance is a separate starting financial value.
3. Available balance is calculated from opening balance and recorded transactions.
4. Analytics are calculated from transactions, not opening balance.
5. Budget spending is calculated from transactions.
6. Budget limits are separate user-defined records.
7. Unused monthly budget is carried forward exactly once.
8. Editing a transaction must update all dependent views.
9. Editing a transaction must not reset its original captured time.
10. Deleting a transaction must not leave incorrect financial totals.
11. Backups must preserve the information necessary to restore valid records and financial calculations.

---

# 12. Product Constraints and Assumptions

## 12.1 Confirmed constraints from the source

- PKR only.
- Light theme only.
- Offline-friendly experience.
- Individual personal finance use.
- No mandatory account creation.
- No multi-step onboarding.
- No AI advice.
- No bank integrations.
- No advanced notifications.
- No cloud synchronization in the initial MVP.
- No advanced transaction search/filter in V1.

## 12.2 Confirmed product decisions

The following decisions have been supplied and approved for PWS V1:

| Area | Final decision |
|---|---|
| Opening balance | Users can enter an initial opening balance; subsequent balance is calculated from it and recorded transactions |
| Monthly budget | Positive unused monthly budget carries forward into the next calendar month |
| Overspending rollover | Overspending does not create a negative carry-forward |
| Transaction date | User-selectable, defaulting to the current date |
| Transaction time | Automatically captured at initial save; not manually editable |
| Editing timestamp | Original captured time remains unchanged when a transaction is edited |

## 12.3 Product assumptions requiring validation

- Users understand the distinction between income and expenses.
- Supplied default categories are sufficient for initial use.
- Users prefer a local-first experience.
- A structured backup file is an acceptable initial data-recovery mechanism.
- Weekly and monthly summaries are sufficient for the first release.

These assumptions should be validated through product testing rather than treated as proven user behaviour.

---

# 13. Success Metrics and Release Evaluation

The source documentation does not contain validated product usage benchmarks. The following are proposed internal acceptance targets, not existing performance results.

| Metric | Proposed target |
|---|---|
| Successful transaction creation | 100% of valid test cases |
| Financial calculation consistency | 100% of defined test cases |
| Opening balance calculation | 100% of defined test cases |
| Budget rollover accuracy | 100% of defined test cases |
| Timestamp persistence | 100% of defined test cases |
| Data persistence after reload | 100% of defined test cases |
| Backup export validation | 100% of valid test cases |
| Invalid backup rejection | 100% of invalid test cases |
| Offline core-flow completion | All defined core offline tests pass |
| Critical data-loss defects | Zero open at release |
| Critical navigation blockers | Zero open at release |

### Product usage metrics to monitor later

- First transaction completion rate.
- Weekly active usage.
- Transactions recorded per active user.
- Budget creation rate.
- Budget rollover usage.
- Backup export frequency.
- Application crash/error rate.

These metrics should be introduced only with appropriate privacy consideration and user consent where required.

---

# 14. Dependencies and Risks

| Risk | Potential impact | Mitigation |
|---|---|---|
| Incorrect financial calculations | Loss of user trust | Centralize and test calculations |
| Incorrect opening balance handling | Inaccurate available balance | Keep opening balance separate and test calculation rules |
| Incorrect budget rollover | Incorrect monthly budget availability | Persist month-specific rollover information and test month boundaries |
| Local database failure | Data loss | Backup and recovery strategy |
| Unsafe restore operation | Existing records overwritten | Validation and explicit confirmation |
| Duplicated financial state | Conflicting totals | One source of truth |
| Scope expansion | Delayed release | Enforce V1 exclusions |
| Poor offline handling | Core app becomes unusable | Test offline scenarios |
| Broken relationships | Incorrect category reports | Validate data references |
| Timestamp changed during editing | Loss of original transaction record timing | Preserve original captured time |
| Unclear error feedback | Users repeat actions or lose work | Consistent operation states |

---

# 15. Release Scope and Roadmap

## Release 1 — PWS V1 MVP

Deliver:

- First-time setup.
- Optional opening balance setup and management.
- Home dashboard.
- Income and expense recording.
- Automatic transaction time capture.
- Transaction history with date and time.
- Transaction details.
- Edit and delete.
- Financial calculations.
- Weekly and monthly analytics.
- Category breakdown.
- Monthly budget with unused-budget rollover.
- Category budgets.
- Categories and payment methods.
- Export and restore.
- Preferences.
- PWA installation and offline support.

## Release 1.1 — Quality and usability improvements

Potential improvements:

- Refined empty/error states.
- Improved accessibility.
- Better long-history performance.
- Additional usability improvements based on actual feedback.

## Future release — Cloud capabilities

Potential future scope, subject to a separate PRD:

- User accounts.
- Cloud backup and synchronization.
- Multiple-device access.
- Conflict resolution.
- Cloud account recovery.

No cloud capability is required to declare the initial local-first MVP complete.

---

# 16. MVP Release Acceptance Checklist

PWS V1 should not be considered release-ready until the following conditions are met.

### Core functionality

- [ ] User can start without registration.
- [ ] User can skip opening balance and start from zero.
- [ ] User can enter an initial opening balance.
- [ ] Available balance includes opening balance.
- [ ] Opening balance is excluded from income analytics.
- [ ] User can add income.
- [ ] User can add expenses.
- [ ] Transaction date is stored correctly.
- [ ] Transaction time is captured automatically.
- [ ] User cannot manually edit captured time.
- [ ] Original captured time is preserved after transaction editing.
- [ ] User can view transactions.
- [ ] User can view transaction details.
- [ ] User can edit transactions.
- [ ] User can delete transactions with confirmation.
- [ ] Home calculations are accurate.
- [ ] Weekly and monthly analytics are accurate.
- [ ] Category breakdown is accurate.
- [ ] User can set and edit budgets.
- [ ] Unused monthly budget carries forward.
- [ ] Overspending does not create negative carry-forward.
- [ ] Budget progress is accurate.

### Data safety

- [ ] Records persist after refresh.
- [ ] Records persist after reopening the application.
- [ ] Failed writes do not silently discard drafts.
- [ ] Export generates a valid backup.
- [ ] Backup includes opening balance and budget rollover information.
- [ ] Backup preserves transaction date and captured time.
- [ ] Invalid restore files are rejected.
- [ ] Restore requires explicit confirmation.
- [ ] Restore failure does not corrupt existing records.

### Platform

- [ ] Application works offline for core operations.
- [ ] PWA installation works.
- [ ] Mobile layouts are usable.
- [ ] Navigation works across all five destinations.
- [ ] Loading, empty, error, and success states are covered.

### Final release

- [ ] Automated tests pass.
- [ ] Production build succeeds.
- [ ] No critical defects remain.
- [ ] Real-device testing is completed.
- [ ] User-facing functionality matches the approved product scope.

---

# 17. Remaining Product Decisions

The three major product decisions concerning opening balance, monthly budget rollover, and transaction time have been resolved.

The following supporting decisions remain open and should be settled before their respective features are implemented.

| ID | Question | Why it matters |
|---|---|---|
| OQ-01 | What exact default income and expense categories should ship? | Onboarding and transaction creation |
| OQ-02 | Which default payment methods should ship? | Transaction entry |
| OQ-03 | Can users delete categories already referenced by transactions? | Data integrity |
| OQ-04 | What should happen to a transaction when its payment method is deleted? | Relationship handling |
| OQ-05 | Should category budgets also carry unused amounts forward, or should rollover apply only to the overall monthly budget? | Category budget lifecycle |
| OQ-06 | Which date formats should be supported? | Preferences and transaction display |
| OQ-07 | Which basic notifications are actually required? | Preferences and permissions |
| OQ-08 | What is the retention and migration policy for older backup formats? | Long-term recovery |

These questions do not invalidate the approved core product definition. They should be resolved before implementation of the features they affect.

---

# 18. Source of Truth and Reference Documents

This PRD is derived primarily from the existing PWS Notion documentation.

**Primary product source**  
Finance App — Sitemap, user flows, first-time use, transaction management, budget, analytics, backup/restore, design constraints and scope exclusions.

https://fallacious-cow-d73.notion.site/Finance-App-3ee6859ba04a803e8ab1fa685b404cc9

**Supporting source documents**

1. MVP Audit — feature coverage, financial logic, data integrity, edge cases and development-readiness decisions.
2. Tech Stack — platform, technology direction, architecture principles and implementation sequence.
3. Development Phase — confirmed working method: Plan → AI-assisted code → Run → Test → Fix → Understand → Confirm → Next feature.

The PRD defines product behaviour and release scope. The Technical Architecture Document will separately define implementation decisions, data schema, storage, application structure, and technology integration.

External PRD-writing reference: Figma's PRD guidance on product goals, features, user stories, release criteria and risks.

https://www.figma.com/resource-library/product-requirements-document/

---

# 19. Final Product Definition

PWS V1 is an individual, PKR-based, offline-first personal finance application.

Its essential value is the ability to:

1. Record income and expenses.
2. Establish an initial financial position using an opening balance.
3. Understand available balance.
4. Review financial activity.
5. Analyze weekly and monthly spending.
6. Set budgets and carry unused monthly budget forward.
7. Maintain control of personal finance data through backup and restore.
8. Continue using core functionality without internet access.

**Product principle:**

Build a reliable financial tracking experience before introducing advanced financial capabilities.

**V1 success means users can consistently record, understand, and protect their everyday financial information without unnecessary complexity.**
