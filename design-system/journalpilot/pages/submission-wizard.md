# Submission Wizard Page Overrides

> **PROJECT:** JournalPilot
> **Generated:** 2026-06-13 15:05:41
> **Page Type:** Submission Workflow

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/journalpilot/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## JournalPilot Override

Use this page as a manuscript submission workflow: stepper, autosave state, accessible forms, co-author management, upload cards, declarations, and final review. Ignore generated lead-magnet, hero, funnel-conversion, and marketing CTA section guidance.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1200px (standard)
- **Layout:** Full-width sections, centered content
- **Sections:** 1. Wizard header and progress, 2. Current step form, 3. Contextual validation/help, 4. Sticky or local step actions, 5. Review and submit summary

### Spacing Overrides

- Use compact dashboard spacing from the Master file. Avoid sparse landing-page spacing.

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Step colors should communicate workflow progress without relying on color alone. CTA uses the app primary/accent colors.

### Component Overrides

- Avoid: No feedback after submit
- Avoid: Allow multiple clicks during processing
- Avoid: Icon buttons without labels
- Avoid: Placeholder-only inputs

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Focus indicators, autosave feedback, loading spinner, success/error feedback
- Forms: Show loading then success/error state
- Interaction: Disable button and show loading state
- Accessibility: Use label with for attribute or wrap input
- CTA Placement: Step navigation actions; final submit action only on review step
