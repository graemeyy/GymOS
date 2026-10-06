import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { UnsubscribeForm } from "@/components/member/unsubscribe-form";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default function UnsubscribePage() {
  return (
    <AuthFrame title="Unsubscribe">
      <Suspense>
        <UnsubscribeForm />
      </Suspense>
    </AuthFrame>
  );
}
