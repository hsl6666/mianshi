# Report Feedback Suggestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an editable report-level feedback suggestion on the report page and show the saved suggestion read-only on the matching bid-file version.

**Architecture:** Store the canonical feedback in `project_attachments.report_feedback` and mirror it into the structured report JSON as `feedback_suggestion`. A version-scoped PATCH endpoint updates both values in one transaction. Report JSON replacement preserves an existing version feedback value.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite-compatible migrations, React, TypeScript, Ant Design.

---

### Task 1: Persist And Synchronize Report Feedback

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/db.py`
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/services/bidding_companies.py`
- Modify: `backend/app/api/bidding_companies.py`
- Test: `backend/tests/test_bid_upload_third_party_submission.py`

- [ ] Add a nullable `report_feedback` text field and migration.
- [ ] Add a PATCH payload schema capped at 2000 characters.
- [ ] Add a version-scoped endpoint that writes `report_feedback` and `feedback_suggestion` together.
- [ ] Preserve saved feedback when replacement report JSON is uploaded.
- [ ] Verify persistence and synchronization using the existing temporary SQLite test setup.

### Task 2: Add Report Page Feedback Editor

**Files:**
- Modify: `frontend/src/features/bidding/types.ts`
- Modify: `frontend/src/features/bidding/api.ts`
- Modify: `frontend/src/features/bidding/utils/technicalReportPage2Adapter.ts`
- Modify: `frontend/src/features/bidding/components/TechnicalReportPage2.tsx`

- [ ] Parse `feedback_suggestion` into the report view model.
- [ ] Add the `八、反馈建议` multiline input and explicit save button.
- [ ] Save through the version-scoped endpoint and retain unsaved text on failure.

### Task 3: Show Read-Only Feedback On Bid Versions

**Files:**
- Modify: `frontend/src/features/bidding/types.ts`
- Modify: `frontend/src/features/bidding/components/ProjectHierarchyPanel.tsx`
- Modify: `frontend/src/features/bidding/components/ProjectMobileCardList.tsx`

- [ ] Expose `report_feedback` in bid-version API responses.
- [ ] Add a read-only desktop table column with truncated text and full tooltip.
- [ ] Add a read-only mobile feedback row when feedback exists.

### Task 4: Verify

- [ ] Run `python -m unittest backend.tests.test_bid_upload_third_party_submission backend.tests.test_db_migrations`.
- [ ] Run `npm run build` in `frontend`.
- [ ] Run `git diff --check` for all modified source and test files.
