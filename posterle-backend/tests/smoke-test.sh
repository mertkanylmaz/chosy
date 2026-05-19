#!/usr/bin/env bash
# ============================================================================
# Posterle Smoke Tests
# ============================================================================
# Run after deploying migration + edge functions to verify everything works.
#
# Usage:
#   export SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
#   export SUPABASE_ANON_KEY="..."
#   export SUPABASE_SERVICE_ROLE_KEY="..."
#   export TEST_USER_JWT="..." # JWT for a real test user
#   ./smoke-test.sh
# ============================================================================

set -euo pipefail

: "${SUPABASE_URL:?Set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY}"
: "${TEST_USER_JWT:?Set TEST_USER_JWT (a real authenticated user's JWT)}"

PASS=0
FAIL=0

assert_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ✅ $label (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label — expected HTTP $expected, got $actual"
    FAIL=$((FAIL + 1))
  fi
}

assert_json_field() {
  local label="$1"
  local field="$2"
  local body="$3"
  if echo "$body" | jq -e ".$field" >/dev/null 2>&1; then
    echo "  ✅ $label — field '$field' present"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label — field '$field' missing in response"
    echo "     Body: $body"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "========================================================"
echo "Posterle Smoke Tests"
echo "========================================================"

# ---- TEST 1: curate-daily-puzzle (service role) ----
echo ""
echo "[1/5] curate-daily-puzzle (idempotent)"
RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST \
  "$SUPABASE_URL/functions/v1/curate-daily-puzzle" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "curation responds OK" "200" "$HTTP_CODE"
assert_json_field "curation returns status" "status" "$BODY"

# Run again — should be idempotent
RESPONSE2=$(curl -sS -X POST \
  "$SUPABASE_URL/functions/v1/curate-daily-puzzle" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
STATUS2=$(echo "$RESPONSE2" | jq -r '.status')
if [[ "$STATUS2" == "already_curated" ]] || [[ "$STATUS2" == "race_resolved" ]] || [[ "$STATUS2" == "curated" ]]; then
  echo "  ✅ idempotency holds (second call: $STATUS2)"
  PASS=$((PASS + 1))
else
  echo "  ❌ idempotency violated — got status: $STATUS2"
  FAIL=$((FAIL + 1))
fi

# ---- TEST 2: get-todays-puzzle (user JWT) ----
echo ""
echo "[2/5] get-todays-puzzle"
RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST \
  "$SUPABASE_URL/functions/v1/get-todays-puzzle" \
  -H "Authorization: Bearer $TEST_USER_JWT" \
  -H "Content-Type: application/json")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "today endpoint responds" "200" "$HTTP_CODE"
assert_json_field "puzzle present" "puzzle" "$BODY"
assert_json_field "attempt present" "attempt" "$BODY"
assert_json_field "pixelation_level present" "puzzle.pixelation_level" "$BODY"

# Verify no spoiler: film details should NOT be present in in_progress state
ATTEMPT_RESULT=$(echo "$BODY" | jq -r '.attempt.result')
if [[ "$ATTEMPT_RESULT" == "in_progress" ]]; then
  HAS_FILM=$(echo "$BODY" | jq -r 'has("film")')
  if [[ "$HAS_FILM" == "false" ]]; then
    echo "  ✅ spoiler protection — film details hidden during play"
    PASS=$((PASS + 1))
  else
    echo "  ❌ SPOILER LEAK — film object present during in_progress!"
    FAIL=$((FAIL + 1))
  fi
fi

# ---- TEST 3: submit-puzzle-guess (wrong guess) ----
echo ""
echo "[3/5] submit-puzzle-guess (wrong guess)"
RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST \
  "$SUPABASE_URL/functions/v1/submit-puzzle-guess" \
  -H "Authorization: Bearer $TEST_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"guess_text":"definitely_not_the_right_movie_xyz123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# If already completed from previous test runs, that's OK
if [[ "$HTTP_CODE" == "200" ]]; then
  CORRECT=$(echo "$BODY" | jq -r '.correct')
  if [[ "$CORRECT" == "false" ]]; then
    echo "  ✅ wrong guess registered correctly"
    PASS=$((PASS + 1))
  else
    echo "  ❌ wrong guess marked as correct"
    FAIL=$((FAIL + 1))
  fi
  assert_json_field "attempt counter incremented" "attempts_used" "$BODY"
elif [[ "$HTTP_CODE" == "400" ]]; then
  ERROR_CODE=$(echo "$BODY" | jq -r '.error')
  if [[ "$ERROR_CODE" == "ALREADY_COMPLETED" ]]; then
    echo "  ⚠️  attempt already completed from prior test run — skipping"
  else
    echo "  ❌ unexpected 400 error: $ERROR_CODE"
    FAIL=$((FAIL + 1))
  fi
else
  echo "  ❌ unexpected status: $HTTP_CODE"
  echo "     Body: $BODY"
  FAIL=$((FAIL + 1))
fi

# ---- TEST 4: submit without auth (should 401) ----
echo ""
echo "[4/5] auth required for submit"
RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST \
  "$SUPABASE_URL/functions/v1/submit-puzzle-guess" \
  -H "Content-Type: application/json" \
  -d '{"guess_text":"test"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
assert_status "unauthenticated rejected" "401" "$HTTP_CODE"

# ---- TEST 5: malformed body (should 400) ----
echo ""
echo "[5/5] malformed body rejected"
RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST \
  "$SUPABASE_URL/functions/v1/submit-puzzle-guess" \
  -H "Authorization: Bearer $TEST_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
assert_status "missing guess rejected" "400" "$HTTP_CODE"

# ---- Summary ----
echo ""
echo "========================================================"
echo "Results: $PASS passed, $FAIL failed"
echo "========================================================"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
