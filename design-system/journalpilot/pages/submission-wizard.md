# Submission Wizard Page Overrides

> **PROJECT:** JournalPilot
> **Generated:** 2026-06-13 00:11:30
> **Page Type:** General

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/journalpilot/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## JournalPilot Override

Use this page as a manuscript submission workflow: stepper, autosave state, accessible forms, co-author management, upload cards, declarations, and final review. Ignore generated hero, funnel-conversion, and marketing CTA section guidance.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1200px (standard)
- **Layout:** Full-width sections, centered content
- **Sections:** 1. Wizard header and progress, 2. Current step form, 3. Contextual validation/help, 4. Sticky or local step actions, 5. Review and submit summary

### Spacing Overrides

- No overrides — use Master spacing

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Step colors: 1 (Red/Problem), 2 (Orange/Process), 3 (Green/Solution). CTA: Brand color

### Component Overrides

- Avoid: No feedback after submit
- Avoid: Allow multiple clicks during processing
- Avoid: Icon buttons without labels

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Haptic feedback (vibration), voice guidance, focus indicators (4px+ ring), motion options, alt content, semantic
- Forms: Show loading then success/error state
- Interaction: Disable button and show loading state
- Accessibility: Add aria-label for icon-only buttons
- CTA Placement: Step navigation actions; final submit action only on review step
