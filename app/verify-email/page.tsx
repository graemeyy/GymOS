import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata: Metadata = { title: "Confirm your email" };

export default function VerifyEmailPage() {
  return (
    <AuthFrame title="Confirm your email">
      <Suspense>
        <VerifyEmailForm />
      </Suspense>
    </AuthFrame>
  );
}
