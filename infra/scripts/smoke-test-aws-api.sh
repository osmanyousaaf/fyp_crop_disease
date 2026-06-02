#!/usr/bin/env bash
# Hit every HTTP route exposed by backend/app.py — sanity check after deploy.
# Usage:
#   bash infra/scripts/smoke-test-aws-api.sh
#   BASE_URL=http://YOUR_EIP:5020 bash infra/scripts/smoke-test-aws-api.sh
#
# Requires: curl, python3 (no jq needed).
# Note: we avoid `set -e` so a failed curl (timeout/refused) does not exit the script silently.
set -uo pipefail

BASE_URL="${BASE_URL:-http://3.84.65.36:5020}"
BASE_URL="${BASE_URL%/}"

CURL_FAST=(curl -sS --connect-timeout 15 --max-time 60)
CURL_SLOW=(curl -sS --connect-timeout 15 --max-time 300)

echo "== Smoke test: ${BASE_URL}"
echo

json_get() {
  python3 -c "import json,sys; d=json.load(open('$1')); print(d.get('$2','') if isinstance(d,dict) else '')"
}

pass() { echo "  OK ($1)"; }
fail() { echo "  FAIL ($1)"; exit 1; }

code="$("${CURL_FAST[@]}" -o /tmp/smoke_body.json -w '%{http_code}' "${BASE_URL}/api/health")" || true
[[ -n "$code" ]] || fail "GET /api/health: empty response — curl failed (timeout?). Try: curl -v --connect-timeout 10 '${BASE_URL}/api/health'"
[[ "$code" == "200" ]] || fail "GET /api/health expected 200 got ${code}"
[[ "$(json_get /tmp/smoke_body.json ok)" == "True" ]] || fail "health JSON missing ok:true"
pass "GET /api/health → ${code}"

code="$("${CURL_FAST[@]}" -o /tmp/smoke_body.json -w '%{http_code}' "${BASE_URL}/")"
[[ "$code" == "200" ]] || fail "GET / expected 200 got ${code}"
pass "GET / → ${code}"

# Tiny 1×1 PNG — classifier may still return 200 or 500 depending on model; both prove route is live.
TINY_PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

for sector in orchard_canopy field_core; do
  code="$("${CURL_SLOW[@]}" -o /tmp/smoke_body.json -w '%{http_code}' -X POST "${BASE_URL}/api/predict" \
    -H 'Content-Type: application/json' \
    -d "{\"sector\":\"${sector}\",\"image\":\"${TINY_PNG}\"}")"
  if [[ "$code" != "200" ]] && [[ "$code" != "500" ]]; then
    fail "POST /api/predict ${sector} expected 200 or 500 got ${code} $(cat /tmp/smoke_body.json)"
  fi
  pass "POST /api/predict ${sector} → ${code}"
done

code="$("${CURL_FAST[@]}" -o /tmp/smoke_body.json -w '%{http_code}' -X POST "${BASE_URL}/api/predict" \
  -H 'Content-Type: application/json' \
  -d '{}')"
[[ "$code" == "400" ]] || fail "POST /api/predict empty expected 400 got ${code}"
pass "POST /api/predict invalid body → ${code}"

STAMP="$(date +%s)"
EMAIL="smoke_${STAMP}@example.com"

code="$("${CURL_FAST[@]}" -o /tmp/smoke_body.json -w '%{http_code}' -X POST "${BASE_URL}/api/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"testpass123\",\"name\":\"Smoke User\"}")"
[[ "$code" == "201" ]] || fail "POST /api/auth/signup expected 201 got ${code} $(cat /tmp/smoke_body.json)"
pass "POST /api/auth/signup → ${code}"

code="$("${CURL_FAST[@]}" -o /tmp/smoke_body.json -w '%{http_code}' -X POST "${BASE_URL}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"testpass123\"}")"
[[ "$code" == "200" ]] || fail "POST /api/auth/login expected 200 got ${code} $(cat /tmp/smoke_body.json)"
python3 -c "import json; d=json.load(open('/tmp/smoke_body.json')); assert d.get('access_token'), 'no token'" || fail "login missing access_token"
pass "POST /api/auth/login → ${code}"

code="$("${CURL_FAST[@]}" -o /tmp/smoke_body.json -w '%{http_code}' -X POST "${BASE_URL}/api/auth/verify" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"code\":\"000000\"}")"
[[ "$code" == "400" ]] || fail "POST /api/auth/verify bad code expected 400 got ${code}"
pass "POST /api/auth/verify (invalid code) → ${code}"

code="$("${CURL_FAST[@]}" -o /tmp/smoke_body.json -w '%{http_code}' -X POST "${BASE_URL}/api/forget-password" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\"}")"
[[ "$code" == "200" ]] || fail "POST /api/forget-password expected 200 got ${code} $(cat /tmp/smoke_body.json)"
pass "POST /api/forget-password → ${code}"

RESET_CODE="$(python3 -c "import json; print(json.load(open('/tmp/smoke_body.json')).get('code',''))")"
[[ -n "$RESET_CODE" ]] || fail "forget-password response missing code"
code="$("${CURL_FAST[@]}" -o /tmp/smoke_body.json -w '%{http_code}' -X POST "${BASE_URL}/api/auth/reset" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"code\":\"${RESET_CODE}\",\"new_password\":\"newpass456\"}")"
[[ "$code" == "200" ]] || fail "POST /api/auth/reset expected 200 got ${code} $(cat /tmp/smoke_body.json)"
pass "POST /api/auth/reset → ${code}"

code="$("${CURL_FAST[@]}" -o /tmp/smoke_body.json -w '%{http_code}' -X POST "${BASE_URL}/api/auth/google" \
  -H 'Content-Type: application/json' \
  -d '{"token":"invalid-token-for-smoke-test"}')"
[[ "$code" == "401" ]] || [[ "$code" == "500" ]] || fail "POST /api/auth/google invalid token expected 401/500 got ${code}"
pass "POST /api/auth/google (invalid token) → ${code}"

echo
echo "All smoke checks passed."
