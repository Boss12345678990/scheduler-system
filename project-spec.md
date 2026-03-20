## Goal: Create a web application that can be used to schedule tasks and events.

## Project Features:

1. Authentication system
Users must be able to register and log in securely.

2. Employee management
After a new user signs in for the first time, they should be directed to an employee management page where they can:

- Add employees
- Edit employees
- Delete employees
- View an employee list

3. Employee profile (use design from /design/employee-profile.png)
Each employee should have a profile page that shows information such as:

- Basic employee details, only name, role, and phone number
- How many days the employee has worked in the current month

4. Scheduling system (use design from /design/scheduling-system.png)
The main scheduling interface should be a calendar view.

In the calendar:

- Each date appears as a calendar cell.
- When the user clicks on a date cell, a dialog window opens.
- In the dialog, the user can assign employees to shifts.

There are three shift types:

- Morning shift
- Afternoon shift
- Night shift

Each shift can have one or more employees assigned.

5. AI Scheduling Assistant (use design from /design/ai-scheduling-assistant.png)

- AI-agent can be used to generate a schedule based on the user's needs.
- Ai-agent can introduce the system to the user and guide them through the process of using the system.
- Ai-agent can answer user questions about the system.
- Provide monthly summaries of employee work hours and days worked.


## User Flow:

1. User registers and logs in. If they are a new user, they will be directed to the employee management page.
2. User adds employees. If they are a new user, they will be directed to the scheduling page.
3. User schedules employees.

## Tech Stack:
- Frontend: React + javascript
- Backend: Node.js + Express + javascript
- Database: MongoDB