# Permissions

Who can do what in the GymOS staff console. Each staff account has one **role**, and a role is a named set of **permissions**. Roles live in the database, so an owner or admin can change them on the Roles page (`/admin/roles`) without a new release. Members never have staff permissions; the member app only ever shows a member their own account.

This page describes the five roles GymOS starts with. If someone has edited them on the Roles page, the Roles page is the truth for that gym.

## The starting roles

- **Owner**: everything, including the owner-only actions below. There is always at least one active owner.
- **Admin**: everything except branding (`branding.edit`, D-124), importing data (`data.import`, D-130) and the owner-only actions.
- **Manager**: runs the gym day to day (members, bookings, the timetable and roster, shop orders, products and stock, refunds, announcements) and sees the money and the audit log. Can't change prices, plans, settings, staff accounts or roles, and can't download finance reports.
- **Front desk**: checks members in, handles bookings and shop orders, and sees schedules and the member list. No prices, settings or money, and no members' private details.
- **Trainer**: their own classes and attendance, and only the member details those classes need. No permissions at all by default.

Least privilege: "See money" and "See members' private details" are off for Front desk and Trainer. Someone with "Manage roles" can turn them on.

## The full matrix

"Yes" means the role has the permission when GymOS is first set up.

| Permission | What it allows | Owner | Admin | Manager | Front desk | Trainer |
| --- | --- | :---: | :---: | :---: | :---: | :---: |
| **Members** | | | | | | |
| See members (`members.view`) | The member list and each member's name, status, plan, visits and class bookings. | Yes | Yes | Yes | Yes | No |
| See members' private details (`members.view_sensitive`) | Email and contact details, staff notes, payment history and amounts owing. | Yes | Yes | Yes | No | No |
| Add and change members (`members.edit`) | Add members, edit their details, write notes, change, pause or cancel memberships, adjust benefits, reissue passes and archive members. | Yes | Yes | Yes | No | No |
| **Classes and front desk** | | | | | | |
| Run the timetable and roster (`classes.manage`) | Create, edit and cancel classes and timetable slots, and edit staff shifts. | Yes | Yes | Yes | No | No |
| Manage bookings (`bookings.manage`) | Book members into any class, manage waitlists and mark attendance for any class. | Yes | Yes | Yes | Yes | No |
| Check members in (`checkin.scan`) | Scan passes or look members up at the front desk and record visits. | Yes | Yes | Yes | Yes | No |
| **Shop** | | | | | | |
| Handle shop orders (`orders.manage`) | Pack, hand over and cancel shop orders, and adjust stock counts. | Yes | Yes | Yes | Yes | No |
| Edit products, stock and equipment (`products.edit`) | Add and edit shop products, stock items and equipment records, and approve repairs. Prices need "Change prices". | Yes | Yes | Yes | No | No |
| **Money** | | | | | | |
| Change prices (`prices.edit`) | Set or change what a membership plan costs (price, billing interval and guest rate) or a shop product's prices. | Yes | Yes | No | No | No |
| See money (`finance.view`) | Payments, takings, finance reports, revenue on the dashboard and plan member counts. | Yes | Yes | Yes | No | No |
| Download finance reports (`finance.export`) | Finance CSV exports for the accountant or BAS. | Yes | Yes | No | No | No |
| Issue refunds (`refunds.issue`) | Refund payments through Stripe or record a manual refund. | Yes | Yes | Yes | No | No |
| **Running the gym** | | | | | | |
| Edit plans (`plans.edit`) | Change plans' names, descriptions and benefits, and retire them. New plans and anything about what a plan costs need "Change prices" too. | Yes | Yes | No | No | No |
| Send announcements (`announcements.send`) | Write, publish and email announcements to members or staff. | Yes | Yes | Yes | No | No |
| Change settings (`settings.edit`) | Gym settings such as keycard entry, and adding, editing and archiving locations. | Yes | Yes | No | No | No |
| Change branding (`branding.edit`) | The gym's name, logo, colours, fonts, app name, email sender and footer, and the business details on the terms and privacy pages. | Yes | No | No | No | No |
| Import data (`data.import`) | Bring members, plans and memberships in from another system with a CSV file, and resend imported members' invitations. | Yes | No | No | No | No |
| Manage staff accounts (`staff.manage`) | Invite staff, assign roles and deactivate accounts. Nobody can give a role with permissions they don't have themselves. | Yes | Yes | No | No | No |
| Manage roles (`roles.manage`) | Edit what each role can do and create custom roles, within the permissions you have yourself. | Yes | Yes | No | No | No |
| See the audit log (`audit.view`) | Who changed what and when, with old and new values, and its CSV export. | Yes | Yes | Yes | No | No |

`tests/integration/permissions.test.ts` checks that the roles the database migration creates match this table (through `lib/auth/permissions.ts`), and `tests/integration/rbac.test.ts` calls every staff API route as every starting role, plus a custom role, and checks each is allowed or refused exactly as the table says.

## What every staff member can do

Any active staff account, whatever its role, can:

- see the dashboard (revenue figures only with "See money"; the equipment panel only with stock or equipment access, below);
- see the class schedule, the weekly timetable and the staff roster of shifts;
- see the plans list (how many members are on each plan only with "See money");
- see announcements;
- see the Roles page, read-only, so everyone can check what their role allows;
- see the names of other active staff, for trainer and roster pickers;
- change their own password.

## Locations

A role says what someone can do; their **locations** say where (D-128). Set them on the Staff page when there's more than one location. An empty list means every location, including ones added later, and owners always cover every location. Someone limited to some locations:

- checks members in, books classes, marks attendance, and manages classes, timetable slots, shifts, stock and orders at their locations only;
- sees lists and combined reports (dashboard, finance, payments, exports) for their locations only, and is refused when asking for another;
- can only give their own locations to staff they invite or edit, and can't send an announcement to every location.

Members aren't limited by location for staff, because members can train at several locations. Which locations a *member* can use is set by their plan (D-126).

## Rules that depend on the record

Some access depends on which record it is, not just the permission:

- **Trainers and their own classes.** Anyone without "See members", "Manage bookings" or "Run the timetable and roster" (a Trainer by default) sees only the classes they teach, with the names of the members booked into them and nothing more about those members. They can mark attendance for their own classes only. "Manage bookings" marks attendance for any class.
- **Members' private details.** Without "See members' private details", member records come back with email, staff notes, payments and amounts owing left out (shown as hidden), and the member search looks at names only, so it can't be used to check whether an email address belongs to a member. A member's payments need both "See members' private details" and "See money".
- **Stock and equipment lists** are for anyone with "Handle shop orders" or "Edit products, stock and equipment" (Front desk, Manager, Admin and Owner by default, not Trainers).
- **Prices.** "Edit plans" or "Edit products, stock and equipment" alone change everything about a plan or product except what it costs. Creating a plan or product, adding a product variant, or changing a price, billing interval or guest rate also needs "Change prices". Screens show prices read-only, with "Only admins can change this", to anyone who can't change them.

## Only owners can

- manage the gym's billing account with GymOS, change where payouts go, and delete the gym's data (GymOS has no screens for these yet; when it does, they'll be owner-only);
- transfer ownership: give someone the Owner role or take it away;
- edit the Owner role's name or description (its permissions can't be changed: an owner always has everything), or change or deactivate an owner's account.

## Safeguards

These hold however roles are set up, and the server enforces them:

- There's always at least one active owner. Two owners demoting each other at the same moment can't both succeed.
- Nobody can give a permission they don't have: not by creating or editing a role, and not by giving someone a role with more permissions than their own.
- Nobody can change, deactivate or resend an invitation to someone whose role is more powerful than theirs, and only an owner can touch an owner.
- Nobody can change their own role or deactivate themselves.
- Preset roles can be edited but not deleted. A custom role can be deleted once nobody has it.

## Staff accounts

- **Inviting.** Someone with "Manage staff accounts" invites a person by email and chooses their role. The email has a link to set their own password; it works once, for 7 days. If email isn't set up, the inviter gets the link to pass on in person. Only a hash of the link is stored. Resending makes the old link stop working.
- **Changing a role** signs the person out everywhere; they sign in again with the new role.
- **Deactivating** signs the person out and stops them signing in, without deleting anything: their name stays on the audit log, classes and shifts. Reactivating lets them back in.

## How changes take effect

A staff member's role and its permissions are read from the database on every request, so a change to a role applies to everyone on it at their next click. The browser hides buttons a role can't use, but that's a convenience: every API route checks the permission itself through one shared helper (`staffRoute` in `lib/http/route.ts`, which calls `requireStaff` in `lib/auth/session.ts`), and services check the record-level rules above (`lib/auth/access.ts`, `lib/members/privacy.ts`, and the price checks in `lib/plans/service.ts` and `lib/shop/service.ts`).

## The audit log

The audit log (`/admin/audit`, needs "See the audit log") records who did what and when. For every change to prices, plans, products, settings, roles and staff accounts, and for refunds, it keeps the old and new values. It can be filtered by area, person and dates, and exported as CSV with the old and new values in their own columns. Failed staff sign-ins are recorded against the account (as "Sign-in attempt", since whoever tried may not be the account holder); attempts with an email that isn't a staff account aren't recorded. Entries can't be edited or deleted.

## For developers

- Permissions, their descriptions and the starting roles are in `lib/auth/permissions.ts`. The migration `20261008000000_roles_and_permissions` inserts the starting roles with fixed ids (`role_owner`, `role_admin`, `role_manager`, `role_staff`, `role_trainer`).
- A route declares what it needs: `staffRoute({ permission: "members.edit" }, ...)`, a list for "any of these", or `null` for any active staff member.
- To add a permission: add it to `PERMISSIONS`, `PERMISSION_INFO` and a group, decide which starting roles get it, add a migration that appends it to those roles (`UPDATE "Role" SET "permissions" = array_append(...) WHERE "preset" IN (...)`), extend the preset test in `permissions.test.ts` to read that migration too, update this page, and add the route cases to `rbac.test.ts`.
- The old fixed `Staff.role` column is kept in step with each person's role (Owner, Manager for Admin and Manager, Front desk, Trainer; Front desk for custom roles) so the migration can be rolled back without anyone gaining access; nothing reads it for access.
