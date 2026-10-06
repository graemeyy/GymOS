export interface Person {
  id: string;
  name: string | null;
  email: string;
}
export interface ClassRow {
  id: string;
  name: string;
  instructor: string | null;
  trainer: { id: string; name: string } | null;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  location: { id: string; name: string } | null;
  bookings: { id: string; memberId: string; status: "BOOKED" | "ATTENDED" | "NO_SHOW"; member: Person }[];
  waitlist: { id: string; memberId: string; member: Person }[];
}
