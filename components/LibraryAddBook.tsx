"use client";

import { useRouter } from "next/navigation";
import { AddBookPanel } from "./FindBook";
import { useShell } from "./Shell";

export default function LibraryAddBook() {
  const router = useRouter();
  const { toast } = useShell();
  return <AddBookPanel toast={toast} onAdded={() => router.refresh()} />;
}
