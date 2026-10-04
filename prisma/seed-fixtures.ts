import type { ProductCategory, Status } from "@prisma/client";
import { DAY_MS, HOUR_MS } from "../lib/time";

// Fictional data only. Every name, email and number below is made up; emails
// use the reserved example.com domain.

export const DEMO_STAFF = [
  { name: "Mel Hartigan", email: "owner@example.com", role: "OWNER" },
  { name: "Tom Nguyen", email: "manager@example.com", role: "MANAGER" },
  { name: "Aisha Rahman", email: "frontdesk@example.com", role: "FRONT_DESK" },
  { name: "Lachie Brennan", email: "trainer@example.com", role: "TRAINER" },
] as const;

export const daysAgo = (days: number, hours = 0) => new Date(Date.now() - days * DAY_MS - hours * HOUR_MS);

export function inDays(days: number, hourUtc: number, minute = 0) {
  const d = new Date(Date.now() + days * DAY_MS);
  d.setUTCHours(hourUtc, minute, 0, 0);
  return d;
}

type SeedMember = {
  name: string;
  email: string;
  plan: string;
  status: Status;
  retentionScore: number;
  lastSeenDays: number | null;
  visitsPerWeek: number;
  login?: boolean;
  notes?: string;
};

export const DEMO_MEMBERS: SeedMember[] = [
  { name: "Charlotte Pham", email: "charlotte.pham@example.com", plan: "unlimited", status: "ACTIVE", retentionScore: 96, lastSeenDays: 0, visitsPerWeek: 5, login: true },
  { name: "Jack O'Sullivan", email: "jack.osullivan@example.com", plan: "standard", status: "ACTIVE", retentionScore: 88, lastSeenDays: 1, visitsPerWeek: 4, login: true },
  { name: "Priya Sharma", email: "priya.sharma@example.com", plan: "unlimited", status: "ACTIVE", retentionScore: 91, lastSeenDays: 0, visitsPerWeek: 5 },
  { name: "Mitchell Greaves", email: "mitchell.greaves@example.com", plan: "standard", status: "PAST_DUE", retentionScore: 54, lastSeenDays: 2, visitsPerWeek: 2, notes: "Card declined on last renewal." },
  { name: "Ngaio Tipene", email: "ngaio.tipene@example.com", plan: "off-peak", status: "ACTIVE", retentionScore: 79, lastSeenDays: 1, visitsPerWeek: 3 },
  { name: "Daniel Kowalski", email: "daniel.kowalski@example.com", plan: "standard", status: "ACTIVE", retentionScore: 31, lastSeenDays: 15, visitsPerWeek: 1, notes: "Asked about pausing over summer." },
  { name: "Grace Liu", email: "grace.liu@example.com", plan: "unlimited", status: "ACTIVE", retentionScore: 85, lastSeenDays: 0, visitsPerWeek: 4 },
  { name: "Sam Whitlock", email: "sam.whitlock@example.com", plan: "off-peak", status: "CANCELED", retentionScore: 12, lastSeenDays: 60, visitsPerWeek: 0 },
  { name: "Olivia Marchetti", email: "olivia.marchetti@example.com", plan: "standard", status: "PAUSED", retentionScore: 45, lastSeenDays: 21, visitsPerWeek: 0 },
  { name: "Ben Adeyemi", email: "ben.adeyemi@example.com", plan: "unlimited", status: "ACTIVE", retentionScore: 93, lastSeenDays: 0, visitsPerWeek: 5 },
  { name: "Tahlia Moore", email: "tahlia.moore@example.com", plan: "standard", status: "ACTIVE", retentionScore: 67, lastSeenDays: 3, visitsPerWeek: 2 },
  { name: "Hamish Fraser", email: "hamish.fraser@example.com", plan: "off-peak", status: "ACTIVE", retentionScore: 58, lastSeenDays: 7, visitsPerWeek: 2 },
  { name: "Mei Tanaka", email: "mei.tanaka@example.com", plan: "unlimited", status: "ACTIVE", retentionScore: 71, lastSeenDays: 1, visitsPerWeek: 3 },
  { name: "Riley Dunstan", email: "riley.dunstan@example.com", plan: "standard", status: "PAST_DUE", retentionScore: 48, lastSeenDays: 4, visitsPerWeek: 2 },
  // Signed up online yesterday and hasn't chosen a plan yet.
  { name: "Oliver Brandt", email: "oliver.brandt@example.com", plan: "", status: "PENDING", retentionScore: 100, lastSeenDays: null, visitsPerWeek: 0, login: true },
];

export const CLASSES = [
  { name: "Barbell Basics", instructor: "Lachie Brennan", day: 0, hourUtc: 20, durationMinutes: 60, capacity: 10 },
  { name: "Conditioning", instructor: "Lachie Brennan", day: 1, hourUtc: 7, durationMinutes: 45, capacity: 16 },
  { name: "Mobility", instructor: "Tom Nguyen", day: 1, hourUtc: 22, durationMinutes: 45, capacity: 12 },
  { name: "Strongman", instructor: "Lachie Brennan", day: 3, hourUtc: 22, durationMinutes: 75, capacity: 8 },
  { name: "Conditioning", instructor: "Lachie Brennan", day: 4, hourUtc: 7, durationMinutes: 45, capacity: 16 },
];

export const TEMPLATES = [
  { name: "Conditioning", trainer: "Lachie Brennan", weekday: 0, startTime: "06:00", durationMinutes: 45, capacity: 16 },
  { name: "Barbell Basics", trainer: "Lachie Brennan", weekday: 1, startTime: "18:00", durationMinutes: 60, capacity: 10 },
  { name: "Mobility", trainer: "Tom Nguyen", weekday: 2, startTime: "07:00", durationMinutes: 45, capacity: 12 },
  { name: "Conditioning", trainer: "Lachie Brennan", weekday: 3, startTime: "06:00", durationMinutes: 45, capacity: 16 },
  { name: "Strongman", trainer: "Lachie Brennan", weekday: 5, startTime: "09:00", durationMinutes: 75, capacity: 8 },
];

type SeedVariant = { sku: string; priceCents: number; stockQty: number; size?: string; colour?: string; flavour?: string };
export const PRODUCTS: { name: string; slug: string; description: string; category: ProductCategory; variants: SeedVariant[] }[] = [
  {
    name: "Ironbark tee",
    slug: "ironbark-tee",
    description: "Heavyweight cotton tee with the plate logo on the chest.",
    category: "APPAREL",
    variants: [
      { sku: "TEE-IB-S-BLK", size: "S", colour: "Black", priceCents: 3500, stockQty: 6 },
      { sku: "TEE-IB-M-BLK", size: "M", colour: "Black", priceCents: 3500, stockQty: 10 },
      { sku: "TEE-IB-L-BLK", size: "L", colour: "Black", priceCents: 3500, stockQty: 8 },
      { sku: "TEE-IB-M-WHT", size: "M", colour: "White", priceCents: 3500, stockQty: 0 },
    ],
  },
  {
    name: "Ironbark hoodie",
    slug: "ironbark-hoodie",
    description: "Midweight fleece hoodie with a kangaroo pocket.",
    category: "APPAREL",
    variants: [
      { sku: "HOOD-IB-M-GRY", size: "M", colour: "Grey", priceCents: 7500, stockQty: 4 },
      { sku: "HOOD-IB-L-GRY", size: "L", colour: "Grey", priceCents: 7500, stockQty: 3 },
    ],
  },
  {
    name: "Whey protein isolate 1 kg",
    slug: "whey-protein-isolate-1kg",
    description: "Whey protein isolate powder. 1 kg bag, about 33 serves. See the label for ingredients, allergens and nutrition information.",
    category: "SUPPLEMENTS",
    variants: [
      { sku: "WPI-1KG-CHOC", flavour: "Chocolate", priceCents: 6995, stockQty: 12 },
      { sku: "WPI-1KG-VAN", flavour: "Vanilla", priceCents: 6995, stockQty: 5 },
    ],
  },
  {
    name: "Creatine monohydrate 300 g",
    slug: "creatine-monohydrate-300g",
    description: "Unflavoured creatine monohydrate powder, 300 g tub. See the label for directions and warnings.",
    category: "SUPPLEMENTS",
    variants: [{ sku: "CREA-300", priceCents: 3995, stockQty: 9 }],
  },
  {
    name: "Lifting straps",
    slug: "lifting-straps",
    description: "Cotton lifting straps, sold as a pair.",
    category: "ACCESSORIES",
    variants: [{ sku: "STRAPS-STD", priceCents: 2500, stockQty: 15 }],
  },
  {
    name: "Chalk block 250 g",
    slug: "chalk-block-250g",
    description: "Magnesium carbonate block chalk.",
    category: "ACCESSORIES",
    variants: [{ sku: "CHALK-250", priceCents: 800, stockQty: 30 }],
  },
];

export const EQUIPMENT = [
  { name: "Treadmill 4", serialNumber: "TM-2021-004", status: "OFFLINE", lastServicedAt: daysAgo(60), partNeeded: "Drive belt", estimatedCost: 18900 },
  { name: "Cable crossover (left)", serialNumber: "CC-2019-011", status: "WARNING", lastServicedAt: daysAgo(40), partNeeded: "Coated steel cable, 3.5 m", estimatedCost: 12400 },
  { name: "Rower 2", serialNumber: "RW-2020-002", status: "OPERATIONAL", lastServicedAt: daysAgo(10), partNeeded: null, estimatedCost: null },
  { name: "Power rack A", serialNumber: "PR-2018-001", status: "OPERATIONAL", lastServicedAt: daysAgo(5), partNeeded: null, estimatedCost: null },
  { name: "Assault bike 3", serialNumber: "AB-2022-003", status: "WARNING", lastServicedAt: daysAgo(50), partNeeded: "Fan belt", estimatedCost: 6500 },
] as const;

export const INVENTORY = [
  { name: "Chalk block", category: "Consumables", sku: "CON-CHALK", quantity: 40, reorderLevel: 15, unitCostCents: 250 },
  { name: "Disinfectant spray 5 L", category: "Cleaning", sku: "CLN-SPRAY5", quantity: 3, reorderLevel: 4, unitCostCents: 3200 },
  { name: "Paper towel roll", category: "Cleaning", sku: "CLN-TOWEL", quantity: 24, reorderLevel: 12, unitCostCents: 180 },
];
