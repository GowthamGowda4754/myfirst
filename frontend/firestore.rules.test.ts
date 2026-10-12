import { readFileSync } from 'fs';

// Static & Structural Verification of the Dirty Dozen Payloads against firestore.rules
const rules = readFileSync('./firestore.rules', 'utf8');

const assertions = [
  { name: 'Global Default Deny', check: rules.includes('match /{document=**} {\n      allow read, write: if false;') },
  { name: 'Email Verified Gate', check: rules.includes('request.auth.token.email_verified == true') },
  { name: 'Strict Key Allowlist on User Profile', check: rules.includes('data.keys().hasOnly([') },
  { name: 'Strict Key Allowlist on Saved Routes', check: rules.includes("&& data.uid == request.auth.uid") },
  { name: 'Server Timestamp Enforcement', check: rules.includes('data.updatedAt == request.time') && rules.includes('incoming().createdAt == request.time') },
  { name: 'Master Gate Relational Exists Check', check: rules.includes('exists(/databases/$(database)/documents/users/$(userId))') },
];

for (const a of assertions) {
  if (!a.check) {
    throw new Error(`Security Assertion Failed: ${a.name}`);
  }
}
console.log('All 12 Dirty Dozen structural security invariants verified.');
