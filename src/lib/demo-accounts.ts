import { Role } from "@/generated/prisma/enums";

export interface DemoAccount {
  role: Role;
  email: string;
  password: string;
  name: string;
  department: string;
}

/** Demo logins for local/staging — seeded via `npm run db:seed`. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "ADMIN",
    email: "admin@ngohub.local",
    password: "Admin@123",
    name: "System Admin",
    department: "Administration",
  },
  {
    role: "MANAGER",
    email: "manager@ngohub.local",
    password: "Manager@123",
    name: "Program Manager",
    department: "Programs",
  },
  {
    role: "ACCOUNTANT",
    email: "accountant@ngohub.local",
    password: "Account@123",
    name: "Finance Accountant",
    department: "Finance",
  },
  {
    role: "HR",
    email: "hr@ngohub.local",
    password: "Hr@123",
    name: "HR Officer",
    department: "Human Resources",
  },
  {
    role: "COORDINATOR",
    email: "coordinator@ngohub.local",
    password: "Coord@123",
    name: "Field Coordinator",
    department: "Field Operations",
  },
  {
    role: "STAFF",
    email: "staff@ngohub.local",
    password: "Staff@123",
    name: "Field Staff",
    department: "Field Operations",
  },
];
