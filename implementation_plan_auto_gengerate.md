# Auto-Schedule Generation Feature

Add a "Generate Schedule" button that auto-assigns employees to shifts based on role priority, working hours, unavailable days, and clinic operating hours.

## User Review Required

> [!IMPORTANT]
> **Role System Change**: The current `role` field (`牙助` / `櫃台`) will be replaced by a **3-category system**:
> | # | Label | Can work as 牙助? | Can work as 櫃台? |
> |---|-------|:-:|:-:|
> | 1 | 牙助 | ✅ primary | ❌ |
> | 2 | 櫃台 | ❌ | ✅ primary |
> | 3 | 牙助+櫃台 | ✅ secondary | ✅ secondary |
>
> Priority for **牙助** positions: `1 > 3` · Priority for **櫃台** positions: `2 > 3`

> [!NOTE]
> **Operating hours read from** [operating-hour.png](file:///c:/Users/Msi/Documents/scheduler-system/client/src/assets/operating-hour.png):
> | Day | Shifts | Hours |
> |-----|--------|-------|
> | 星期一 Mon | 午 + 晚 | 14:00-17:30 ; 18:30-20:00 |
> | 星期二 Tue | 早 + 午 | 09:30-12:00 ; 14:00-17:45 |
> | 星期三 Wed | 休診 | — |
> | 星期四 Thu | 午 + 晚 | 15:00-17:30 ; 18:30-20:00 |
> | 星期五 Fri | 早 + 午 | 09:30-12:00 ; 14:00-17:45 |
> | 星期六 Sat | 早 + 午 | 09:30-12:00 ; 14:00-16:00 |
> | 星期日 Sun | 休診 | — |
> *註: 國定假日時營業時間可能有所變動*

> [!IMPORTANT]
> **Shift Requirements**: Every active shift requires **at least 2 牙助 + 1 櫃台** (fixed rule).

---

## Proposed Changes

### Employee Model & API

#### [MODIFY] [Employee.js](file:///c:/Users/Msi/Documents/scheduler-system/server/models/Employee.js)
- Change `role` enum from `['牙助', '櫃台']` → `['牙助', '櫃台', '牙助+櫃台']`
- Add `workingHours` field (Number, default: 0) — manually entered by owner
- Add `unavailableDays` field (Array of Strings, e.g. `['Monday', 'Wednesday']`) — weekdays the employee cannot work
- Update `ROLE_COLORS` to include all 3 types
- Update `pre('save')` hook for new roles

#### [MODIFY] [employees.js](file:///c:/Users/Msi/Documents/scheduler-system/server/routes/employees.js)
- Update POST/PUT handlers to accept `workingHours` and `unavailableDays`
- Update field list in PUT handler

---

### Operating Hours Config

#### [NEW] [operatingHours.js](file:///c:/Users/Msi/Documents/scheduler-system/client/src/assets/operatingHours.js)
- Export `OPERATING_HOURS` based on [operating-hour.png](file:///c:/Users/Msi/Documents/scheduler-system/client/src/assets/operating-hour.png):
  - Mon: `{ morning: false, afternoon: true, night: true }` (14:00-17:30, 18:30-20:00)
  - Tue: `{ morning: true, afternoon: true, night: false }` (09:30-12:00, 14:00-17:45)
  - Wed: closed (`dayoff: true`)
  - Thu: `{ morning: false, afternoon: true, night: true }` (15:00-17:30, 18:30-20:00)
  - Fri: `{ morning: true, afternoon: true, night: false }` (09:30-12:00, 14:00-17:45)
  - Sat: `{ morning: true, afternoon: true, night: false }` (09:30-12:00, 14:00-16:00)
  - Sun: closed (`dayoff: true`)
- Export `SHIFT_REQUIREMENTS`: `{ 牙助: 2, 櫃台: 1 }` per active shift
- Store hours per shift for hour-tracking algorithm

---

### Schedule Generation Backend

#### [MODIFY] [schedules.js](file:///c:/Users/Msi/Documents/scheduler-system/server/routes/schedules.js)
- Add `POST /api/schedules/generate` endpoint accepting `{ month: "YYYY-MM" }`
- Algorithm:
  1. Load all active employees with their roles, workingHours, unavailableDays
  2. For each day in the month, check operating hours → determine active shifts
  3. Skip Wed/Sun (closed days per config)
  4. For each active shift, assign employees by priority:
     - **牙助 slots** (need 2): pick from role=`牙助` first, then `牙助+櫃台`
     - **櫃台 slots** (need 1): pick from role=`櫃台` first, then `牙助+櫃台`
  5. Skip employees whose unavailable weekday matches the day (e.g. employee unavailable on Monday → skip all Mondays)
  6. Balance workload: track cumulative assigned shifts per employee, prefer those with fewer assigned shifts
  7. Upsert schedules for each day (overwrites existing month schedules)
- Returns generated schedule count + any warnings (e.g., "not enough 牙助 for date X")

#### [MODIFY] [operatingHours.js](file:///c:/Users/Msi/Documents/scheduler-system/server/routes/schedules.js) *(same file)*
- Import operating hours config (duplicated server-side as a constant, since the client asset can't be imported on server)

---

### Frontend Changes

#### [MODIFY] [StaffPage.jsx](file:///c:/Users/Msi/Documents/scheduler-system/client/src/pages/StaffPage.jsx)
- Expand role dropdown: add `牙助+櫃台` option
- Add `workingHours` number input field to add/edit modal
- Add `unavailableDays` weekday multi-select checkboxes (Mon–Sun) to add/edit modal
- Update `ROLE_COLORS` map for 3 roles
- Include new fields in form state and API calls

#### [MODIFY] [SchedulePage.jsx](file:///c:/Users/Msi/Documents/scheduler-system/client/src/pages/SchedulePage.jsx)
- Add "⚡ Generate Schedule / 自動排班" button in the footer
- On click: call `POST /api/schedules/generate` with current month
- Show loading state during generation
- Show success/warning toast after completion, then refresh calendar

#### [MODIFY] [ShiftModal.jsx](file:///c:/Users/Msi/Documents/scheduler-system/client/src/components/ShiftModal.jsx)
- Update role groups from 2 → 3 categories with correct colors
- Update validation to use new role categories

#### [MODIFY] [EmployeeProfilePage.jsx](file:///c:/Users/Msi/Documents/scheduler-system/client/src/pages/EmployeeProfilePage.jsx)
- Display `workingHours` and `unavailableDays` (weekday names) in profile details

#### [MODIFY] [api.js](file:///c:/Users/Msi/Documents/scheduler-system/client/src/services/api.js)
- No changes needed (generic axios wrapper)

---

## Verification Plan

### Browser Testing
1. **Employee CRUD**: Add employee with 3 roles, workingHours, unavailableDays → verify save/display
2. **Generate Schedule**: Click "Generate Schedule" → verify shifts respect operating hours, priority, unavailable weekdays, and 2+1 requirement
3. **Click through calendar days** to confirm assignments match expected role priorities
