import type { Metadata } from "next";
import { Suspense } from "react";
import { People } from "@/components/people";

export const metadata: Metadata = { title: "People · Figma Config BLR Wall" };

export default function PeoplePage() {
  return (
    <Suspense fallback={null}>
      <People />
    </Suspense>
  );
}
