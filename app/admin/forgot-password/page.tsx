import Link from "next/link";
import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthFrame
      title="Forgot your password?"
      footer={
        <Link href="/admin/login" className="font-medium text-plate underline underline-offset-2">
          Back to staff sign-in
        </Link>
      }
    >
      <ForgotPasswordForm kind="staff" />
    </AuthFrame>
  );
}
