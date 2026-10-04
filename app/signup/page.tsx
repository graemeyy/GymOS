import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SignUpForm } from "@/components/member/sign-up-form";

export const metadata: Metadata = { title: "Join" };

export default function SignUpPage() {
  return (
    <AuthFrame
      title="Join the gym"
      footer={
        <>
          Already a member? <Link href="/login" className="font-medium text-plate underline underline-offset-2">Sign in</Link>. If you joined at the front desk, ask staff to set up online access.
        </>
      }
    >
      <Suspense>
        <SignUpForm />
      </Suspense>
    </AuthFrame>
  );
}
