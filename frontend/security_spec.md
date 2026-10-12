# EcoRoute Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default Deny**: All paths not explicitly matched in `/users/{userId}` or `/users/{userId}/savedRoutes/{routeId}` are strictly denied.
2. **Identity & Ownership**:
   - A `UserCommuteProfile` document at `/users/{userId}` can only be read, created, or updated by the authenticated, email-verified user whose `request.auth.uid == userId` and `incoming().uid == request.auth.uid`.
   - A `SavedCommuteRoute` document at `/users/{userId}/savedRoutes/{routeId}` can only be accessed if the parent user document `/users/{userId}` exists, belongs to `request.auth.uid`, and `incoming().uid == request.auth.uid`.
3. **Strict Schema & Volumetric Bounds**:
   - `uid`: string, `1 <= size <= 128`, matches `^[a-zA-Z0-9_\-]+$`.
   - `displayName`: string, `1 <= size <= 80`.
   - `preferredMode` / `travelMode`: enum `['bike', 'walk', 'transit']`.
   - `tempUnit`: enum `['C', 'F']`.
   - `aqiAlertThreshold`: int, `40 <= val <= 150`.
   - `updatedAt` / `createdAt`: must equal `request.time`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating `/users/user_1` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `auth = { uid: 'user_1', token: { email_verified: false } }`, creating `/users/user_1` -> `PERMISSION_DENIED`.
3. **Cross-User Profile Hijack**: `auth.uid = 'attacker_1'`, writing to `/users/victim_1` -> `PERMISSION_DENIED`.
4. **UID Payload Mismatch**: `auth.uid = 'user_1'`, writing `uid: 'user_2'` inside `/users/user_1` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Adding `isAdmin: true` to `/users/user_1` -> `PERMISSION_DENIED` via `hasOnly()`.
6. **Oversized DisplayName DoS**: `displayName` of 5,000 characters -> `PERMISSION_DENIED` via `size() <= 80`.
7. **Invalid Enum Injection**: `preferredMode: 'helicopter'` -> `PERMISSION_DENIED`.
8. **Out-of-Bounds AQI Threshold**: `aqiAlertThreshold: 9999` -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: `updatedAt: Timestamp.fromMillis(1000)` instead of `request.time` -> `PERMISSION_DENIED`.
10. **Orphaned Subcollection Write**: Creating `/users/user_1/savedRoutes/route_1` when `/users/user_1` does not exist -> `PERMISSION_DENIED` via `exists()` Master Gate.
11. **Malformed Document ID Poisoning**: Creating `/users/user_1/savedRoutes/bad$id!@#` -> `PERMISSION_DENIED` via `isValidId(routeId)`.
12. **Immutable Field Mutation**: Updating `createdAt` or `uid` on an existing saved route -> `PERMISSION_DENIED`.

## 3. Test Runner (`firestore.rules.test.ts` reference)
All 12 payloads are verified against the validation helpers `isValidUserProfile` and `isValidSavedRoute` to guarantee `PERMISSION_DENIED`.
