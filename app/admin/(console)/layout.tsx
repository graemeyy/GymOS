import { StaffSessionProvider } from "@/components/admin/staff-session";
import { AdminShell } from "@/components/admin/admin-shell";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffSessionProvider>
      <AdminShell>{children}</AdminShell>
    </StaffSessionProvider>
  );
}
