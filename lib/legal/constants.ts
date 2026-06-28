// lib/legal/constants.ts
//
// Shared identity constants used across the legal pages (Privacy, Terms) and
// the account-deletion flow. Extracted so the app name, operating entity, and
// contact address live in one place instead of being re-declared per file.

export const APP_NAME = "Expatise";
export const DEVELOPER_ENTITY = "Maverix n Matrix";
export const CONTACT_EMAIL = "maverixnmatrix@gmail.com";

// AccountDeletionClient refers to the same mailbox as CONTACT_EMAIL but under
// the name SUPPORT_EMAIL. Kept as a distinct export so that file can import the
// same value without changing the name it uses locally.
export const SUPPORT_EMAIL = CONTACT_EMAIL;
