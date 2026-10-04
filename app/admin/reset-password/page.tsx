import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthFrame title="Choose a new password">
      <Suspense>
        <ResetPasswordForm forgotHref="/admin/forgot-password" />
      </Suspense>
    </AuthFrame>
  );
}
