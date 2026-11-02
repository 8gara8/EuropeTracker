import Link from "next/link";
import { PageHeader } from "@/components/layout/chrome";

export default function NotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <p className="text-sm">There is no page here. The <Link href="/archive">archive</Link> lists every brief.</p>
    </>
  );
}
