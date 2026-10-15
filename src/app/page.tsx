import { Suspense } from "react";
import { Wall } from "@/components/wall";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Wall />
    </Suspense>
  );
}
