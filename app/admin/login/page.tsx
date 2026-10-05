import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Staff sign in" };

export default function StaffLoginPage() {
  return (
    <AuthFrame
      title="Staff sign in"
      footer={
        <>
          Members sign in on the <Link href="/login" className="font-medium text-plate underline underline-offset-2">member page</Link>. First time setting up?{" "}
          <Link href="/admin/setup" className="font-medium text-plate underline underline-offset-2">Create the owner account</Link>.
        </>
      }
    >
      <Suspense>
        <SignInForm endpoint="/api/auth/login" home="/admin" prefix="/admin" forgotHref="/admin/forgot-password" />
      </Suspense>
    </AuthFrame>
  );
}
