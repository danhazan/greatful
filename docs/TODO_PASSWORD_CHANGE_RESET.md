# Plan for Password Change and Reset Functionality

This document outlines the implementation plan for adding secure password change and reset functionalities.

## Core Principle: Segregation of Auth Methods

The system will enforce a strict separation between OAuth-based and password-based authentication. A user can be one of two types, but never both simultaneously.

- **Password User:** Identified by `oauth_provider` being `NULL` in the `users` table. They have a valid `hashed_password` and can use all password-related features.
- **OAuth User:** Identified by `oauth_provider` being set (e.g., 'google'). Their `hashed_password` is an empty string, and they are blocked from using any password-related features.

The only way for a user to transition from an OAuth User to a Password User will be via a future "Unlink and Swap" feature.

---

## Phase 1: Backend Implementation

### 1. Database Migration (Alembic)

- **Action:** Create a new Alembic migration script.
- **Details:** The script will create a new table named `password_reset_tokens` to store temporary, single-use tokens for the "Forgot Password" flow.
- **Schema:**
    - `id`: Primary Key
    - `user_id`: Foreign Key to `users.id`
    - `token`: String, unique, indexed
    - `expires_at`: DateTime
    - `is_used`: Boolean, default `False`

### 2. Service Layer Updates

- **`UserService` (`apps/api/app/services/user_service.py`):**
    - **New Function:** `update_password(user: User, new_password: str)`
    - **Logic:** This central function will take a user object and a new plain-text password. It will use `get_password_hash` from `core.security` to hash the password and save it to the user's `hashed_password` field.

- **`AuthService` (`apps/api/app/services/auth_service.py`):**
    - **New Function:** `generate_password_reset_token(email: str) -> str`
    - **Logic:**
        1. Finds the user by email.
        2. **Enforcement Check:** If the user is an OAuth User, it will raise an exception.
        3. For a Password User, it generates a secure random token, stores it in the `password_reset_tokens` table with an expiration, and returns the token.
    - **New Function:** `reset_password_with_token(token: str, new_password: str)`
    - **Logic:**
        1. Validates the token from the `password_reset_tokens` table (exists, not expired, not used).
        2. Finds the associated user.
        3. Calls `user_service.update_password()` to update the user's password.
        4. Invalidates the token by setting `is_used` to `True`.

### 3. API Endpoints

- **Change Password (for logged-in Password Users):**
    - **Endpoint:** `PUT /api/v1/users/me/password`
    - **File:** `apps/api/app/api/v1/users.py`
    - **Request Body:** `{"current_password": "...", "new_password": "..."}`
    - **Logic:**
        1. Requires authentication.
        2. Fetches the current user.
        3. **Enforcement Check:** Rejects the request with a 403 error if `user.oauth_provider` is not `NULL`.
        4. Verifies `current_password` using `security.verify_password`.
        5. Calls the new `user_service.update_password` function.

- **Forgot/Reset Password (for logged-out Password Users):**
    - **Endpoint 1:** `POST /api/v1/auth/forgot-password`
        - **File:** `apps/api/app/api/v1/auth.py`
        - **Request Body:** `{"email": "..."}`
        - **Logic:**
            1. Calls `auth_service.generate_password_reset_token`.
            2. **Note:** As per requirements, this endpoint will **not** send an email in the initial implementation. For development and testing, it will return the generated token directly in the HTTP response.
    - **Endpoint 2:** `POST /api/v1/auth/reset-password`
        - **File:** `apps/api/app/api/v1/auth.py`
        - **Request Body:** `{"token": "...", "new_password": "..."}`
        - **Logic:** Calls `auth_service.reset_password_with_token` to validate the token and finalize the password change.

---

## Phase 2: Future Work

### 1. Email Integration

- The `forgot-password` endpoint will need to be integrated with an email service (e.g., SMTP, SendGrid) to send the reset link to the user instead of returning the token in the response.

### 2. Unlink and Swap Feature

- A dedicated flow will be created to allow OAuth Users to become Password Users.
- **Proposed Endpoint:** `POST /api/v1/users/me/unlink-and-set-password`
- **Proposed Logic:** This endpoint will take a `new_password` and perform an atomic "swap" in the database: hash and set the `hashed_password` while simultaneously setting `oauth_provider` and `oauth_id` to `NULL`.

### 3. Frontend UI/UX Flow

- **Change Password (Profile/Settings Page):**
    - A "Password" section will be added.
    - **For Password Users:** It will show a form with "Current Password", "New Password", and "Confirm New Password" fields.
    - **For OAuth Users:** This section will be hidden or will display a message indicating that password management is not applicable for social accounts.
- **Forgot Password (Login Page):**
    - A "Forgot your password?" link will lead to a page with an email input field.
    - After submission, a generic confirmation message will be shown.
    - The user will receive an email with a link to the "Reset Password" page.
- **Reset Password Page:**
    - Accessed via the link from the email (containing the token in the URL).
    - The page will have "New Password" and "Confirm New Password" fields.
    - On success, the user is redirected to the login page.

---

## Phase 1.5: Backend Testing

To ensure the reliability and security of the new functionality, a comprehensive test suite will be implemented.

### Test File Structure

- **Unit Tests:** `apps/api/tests/unit/test_password_management.py` - For isolated testing of service-layer business logic.
- **Integration Tests:** `apps/api/tests/integration/test_password_api.py` - For testing the full API workflow, including database interactions and security.

### Unit Test Cases (`test_password_management.py`)

- **`test_update_password_hashes_correctly`**: Verifies that `UserService.update_password` correctly hashes and updates a user's password.
- **`test_generate_reset_token_for_password_user`**: Ensures a token is successfully generated and stored for a standard user.
- **`test_generate_reset_token_blocked_for_oauth_user`**: Confirms that OAuth users cannot generate a password reset token.
- **`test_generate_reset_token_for_nonexistent_user`**: Checks that the function fails gracefully for an email that doesn't exist, preventing user enumeration.
- **`test_reset_password_with_valid_token`**: Validates the successful password reset flow with a correct token.
- **`test_reset_password_fails_with_invalid_token`**: Ensures an incorrect or non-existent token is rejected.
- **`test_reset_password_fails_with_expired_token`**: Ensures an expired token is rejected.
- **`test_reset_password_fails_with_used_token`**: Ensures a token that has already been used is rejected.

### Integration Test Cases (`test_password_api.py`)

- **`test_change_password_success_for_password_user`**: Verifies a logged-in standard user can change their password with the correct credentials.
- **`test_change_password_fails_with_wrong_current_password`**: Ensures the change password endpoint rejects requests with an incorrect current password.
- **`test_change_password_forbidden_for_oauth_user`**: Enforces that a logged-in OAuth user receives a 403 Forbidden error when trying to change a password.
- **`test_forgot_password_success_for_password_user`**: Checks that the `forgot-password` endpoint returns a token for a standard user.
- **`test_forgot_password_graceful_fail_for_oauth_user`**: Confirms the `forgot-password` endpoint returns a generic success message without a token for an OAuth user.
- **`test_reset_password_success_with_valid_token`**: Tests the full E2E reset flow via the API, from token generation to successful password update.
- **`test_reset_password_fails_with_bad_token`**: Ensures the `reset-password` endpoint rejects invalid tokens with a 400 Bad Request error.
