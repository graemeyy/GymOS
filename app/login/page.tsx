import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Member sign in" };

export default function MemberLoginPage() {
  return (
    <AuthFrame
      title="Member sign in"
      footer={
        <>
          Staff use the <Link href="/admin/login" className="font-medium text-plate underline underline-offset-2">staff sign-in</Link>.
        </>
      }
    >
      <Suspense>
        <SignInForm endpoint="/api/auth/member-login" home="/member" prefix="/member" />
      </Suspense>
    </AuthFrame>
  );
}
