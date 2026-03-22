import type { Metadata } from "next";
import AccountDeletionClient from "./AccountDeletionClient";

export const metadata: Metadata = {
  title: "Account & Data Deletion · Expatise",
  description:
    "How to request deletion of your Expatise account and associated data (in-app or by email).",
};

export default function AccountDeletionPage() {
  return <AccountDeletionClient />;
}
