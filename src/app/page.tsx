import { Suspense } from "react";
import { Explorer } from "@/components/explorer/explorer";

export default function Home() {
  return (
    <Suspense>
      <Explorer />
    </Suspense>
  );
}
