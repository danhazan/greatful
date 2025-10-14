# Plan for Password Change and Reset Functionality

> **Implementation Note**: This comprehensive password management system was entirely designed, planned, and implemented using **gemini-cli** (Google's Gemini AI) in fine detail. The AI assistant analyzed the existing authentication architecture, designed the OAuth/password user segregation system, created the complete backend API endpoints with proper security measures, implemented the frontend UI components with React state management, established the database schema with Alembic migrations, wrote comprehensive test suites covering unit and integration testing, and provided detailed documentation. Every aspect from the initial planning through final implementation was executed through AI-driven development, demonstrating the capability of modern AI tools to handle complex, production-ready feature development with proper security considerations, error handling, and user experience design.

This document outlines the implementation plan for adding secure password change and reset functionalities, covering both backend and frontend.

## Core Principle: Segregation of Auth Methods

The system will enforce a strict separation between OAuth-based and password-based authentication. A user can be one of two types, but never both simultaneously.

- **Password User:** Identified by `oauth_provider` being `NULL` in the `users` table. They have a valid `hashed_password` and can use all password-related features.
- **OAuth User:** Identified by `oauth_provider` being set (e.g., 'google'). Their `hashed_password` is an empty string, and they are blocked from using any password-related features.

The only way for a user to transition from an OAuth User to a Password User will be via a future "Unlink and Swap" feature.

---

## Phase 1: Backend Implementation (Completed)

### 1. Database Migration (Alembic)

- **Action:** A new Alembic migration script was created to add a `password_reset_tokens` table.
- **Schema:** `id`, `user_id`, `token`, `expires_at`, `is_used`.

### 2. Service Layer Updates

- **`UserService`:** A new `update_password` function was added to handle hashing and saving a new password.
- **`AuthService`:** New functions `generate_password_reset_token` and `reset_password_with_token` were added to manage the token lifecycle for password resets.

### 3. API Endpoints

- **`PUT /api/v1/users/me/password`:** Endpoint for logged-in Password Users to change their password. Rejects requests from OAuth users.
- **`POST /api/v1/auth/forgot-password`:** Endpoint to initiate a password reset. Generates a token for Password Users and returns a generic message for OAuth or non-existent users.
- **`POST /api/v1/auth/reset-password`:** Endpoint to finalize a password reset using a valid token.

### 4. Backend Testing (Completed)

- A comprehensive test suite was implemented, covering all new backend logic and endpoints.
- **Unit Tests:** `apps/api/tests/unit/test_password_management.py`
- **Integration Tests:** `apps/api/tests/integration/test_password_api.py`

---

## Phase 2: Frontend Implementation

### Part 0: Refactoring for Clarity

1.  **Rename State and Handlers in `profile/page.tsx`:**
    *   `isEditing` -> `isEditingProfile`
    *   `handleCancelEdit` -> `handleCancelProfileEdit`
    *   `editForm` -> `profileEditForm`
    *   `setEditForm` -> `setProfileEditForm`
    *   Other ambiguous names will be reviewed and renamed for specificity.

### Part 1: "Edit Account" Section on Profile Page

1.  **Modify `profile/page.tsx`:**
    *   Introduce `isEditingAccount` state and `handleEditAccount` handler.
    *   Add a new "Edit Account" button with a `<Shield>` icon next to the "Edit Profile" button.
    *   Create a new, conditionally rendered "Account" editing section that appears when `isEditingAccount` is true.

2.  **Relocate and Enhance Username Component:**
    *   Move the username input and its error handling logic from the profile form to the new account form.
    *   The username input will be `readOnly` by default, with a "Change" button to make it editable.

3.  **Implement "Change Password" Component:**
    *   **Conditional Rendering:** This component will only be visible to non-OAuth users. The `UserProfile` type will be updated to include the `oauth_provider` field.
    *   **UI Flow:** A `readOnly` password field (`********`) will be displayed with a "Change" button. Clicking it will reveal the "Current Password", "New Password", and "Confirm New Password" input fields below.
    *   **Validation:** Implement client-side validation for matching new passwords and API error handling. A `useRef` will be used to scroll to password errors on submission.

4.  **Implement Save/Cancel Logic:**
    *   Create a `handleSaveAccount` function to manage API calls for updating the username and/or password.
    *   Create a `handleCancelAccountEdit` function to reset the form.

### Part 2: "Forgot/Reset Password" Pages

1.  **Create New Pages (`/auth/forgot-password` and `/auth/reset-password`):**
    *   These pages will reuse the exact layout and styling of the existing `login` and `signup` pages to ensure a consistent user experience.
    *   They will **not** include the Google and Facebook OAuth login buttons.
    *   The `/forgot-password` page will have a single email input and a submit button.
    *   The `/reset-password` page will have inputs for "New Password" and "Confirm New Password", and will read the reset token from the URL.

2.  **Update Login Page (`/auth/login`):**
    *   Add a "Forgot your password?" link near the password input field.

---

## ✅ Implementation Status: COMPLETED

All phases of the password change and reset functionality have been successfully implemented and are fully documented in **[Authentication and Password Management](AUTHENTICATION_AND_PASSWORD_MANAGEMENT.md)**.

### What Was Implemented:
- ✅ **Phase 1**: Complete backend implementation with comprehensive testing
- ✅ **Phase 2**: Complete frontend implementation with all UI components
- ✅ **Account Editing Section**: Profile page with Shield icon and account management
- ✅ **Password Change**: Full functionality for non-OAuth users
- ✅ **Forgot/Reset Password Pages**: Complete flow with consistent styling
- ✅ **OAuth User Restrictions**: Proper segregation and error handling

### Documentation:
The complete implementation is now documented in:
- **[Authentication and Password Management](AUTHENTICATION_AND_PASSWORD_MANAGEMENT.md)** - Complete system documentation
- **[Common Fixes](COMMON_FIXES.md)** - Implementation patterns and troubleshooting

---

## Phase 3: Future Work

- **Email Integration:** The `forgot-password` endpoint will be integrated with an email service to send the reset link to the user.
- **Unlink and Swap Feature:** A dedicated flow will be created to allow OAuth Users to become Password Users by setting a password, which will nullify their OAuth credentials in the database.