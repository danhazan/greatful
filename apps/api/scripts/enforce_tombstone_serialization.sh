#!/usr/bin/env bash
# CI enforcement: forbid manual tombstone serialization outside canonical paths.
set -euo pipefail

EXIT_CODE=0

ALLOWED_PATTERNS=(
    "app/core/user_serialization.py"
    "app/models/user.py"
    "app/core/resurrection.py"
    "app/models/deleted_user_auth_identity.py"
    "app/services/user_deletion_service.py"
    "app/repositories/post_repository.py"
    "app/schemas/user.py"
    "tests/"
)

function is_allowed() {
    local file="$1"
    for allowed in "${ALLOWED_PATTERNS[@]}"; do
        if [[ "$file" == *"$allowed"* ]]; then
            return 0
        fi
    done
    return 1
}

echo "=== Tombstone Serialization Enforcement ==="
echo "Checking for manual deleted-user construction..."

# Check: manual "is_deleted" set to True (not False — that's for active users)
while IFS= read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    lineno=$(echo "$line" | cut -d: -f2)
    if is_allowed "$file"; then
        continue
    fi
    content=$(echo "$line" | cut -d: -f3-)
    # Skip Pydantic model field definitions
    if echo "$content" | grep -qE "is_deleted.*:\s*bool"; then
        continue
    fi
    if echo "$content" | grep -qE '(is_deleted.*:.*True|"is_deleted".*:.*true|'"'"'is_deleted'"'"'.*:.*True)'; then
        echo "ERROR: $file:$lineno - Manual is_deleted=True detected (bypasses serialize_public_user_reference)"
        EXIT_CODE=1
    fi
done < <(grep -rn "is_deleted" --include="*.py" apps/api/app/ 2>/dev/null || true)

# Check: manual "Deleted user" name label outside allowed paths
while IFS= read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    lineno=$(echo "$line" | cut -d: -f2)
    if is_allowed "$file"; then
        continue
    fi
    content=$(echo "$line" | cut -d: -f3-)
    if echo "$content" | grep -qE "['\"]name['\"].*:.*['\"]Deleted user['\"]"; then
        echo "ERROR: $file:$lineno - Manual 'Deleted user' label detected (bypasses serialize_public_user_reference)"
        EXIT_CODE=1
    fi
done < <(grep -rn "Deleted user" --include="*.py" apps/api/app/ 2>/dev/null || true)

if [ $EXIT_CODE -eq 0 ]; then
    echo "PASS: All tombstone serialization adheres to canonical contract."
else
    echo ""
    echo "FAIL: Manual tombstone serialization detected. Refactor to use"
    echo "      serialize_public_user_reference() from app.core.user_serialization."
fi

exit $EXIT_CODE
