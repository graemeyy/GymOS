import { StaffSessionProvider } from "@/components/admin/staff-session";
import { LocationFilterProvider } from "@/components/admin/location-filter";
import { AdminShell } from "@/components/admin/admin-shell";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffSessionProvider>
      <LocationFilterProvider>
        <AdminShell>{children}</AdminShell>
      </LocationFilterProvider>
    </StaffSessionProvider>
  );
}
