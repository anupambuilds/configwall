import type { Metadata } from "next";
import { Suspense } from "react";
import { Admin } from "@/components/admin";

export const metadata: Metadata = { title: "Admin · Config BLR Wall", robots: { index: false } };

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <Admin />
    </Suspense>
  );
}
