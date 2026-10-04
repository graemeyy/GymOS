import type { Metadata } from "next";
import { MemberShell } from "@/components/member/member-shell";

export const metadata: Metadata = { title: "My membership" };

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <MemberShell>{children}</MemberShell>;
}
