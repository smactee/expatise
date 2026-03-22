import type { Metadata } from "next";
import AccountDeletionClient from "./AccountDeletionClient";

export const metadata: Metadata = {
  title: "Account & Data Deletion · Expatise",
  description:
    "How to request deletion of your Expatise account and associated data (in-app or by email).",
};

type AccountDeletionPageProps = {
  searchParams?: Promise<{
    deleted?: string | string[] | undefined;
  }>;
};

export default async function AccountDeletionPage({
  searchParams,
}: AccountDeletionPageProps) {
  const params = (await searchParams) ?? {};
  const rawDeleted = params.deleted;
  const deleted = Array.isArray(rawDeleted)
    ? rawDeleted[0] === "1"
    : rawDeleted === "1";

  return <AccountDeletionClient deleted={deleted} />;
}