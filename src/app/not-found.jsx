import Link from "next/link";
import { SurfaceCard } from "../components/ui/Surface";
export default function NotFound() {
  return <main data-as-ui="error" className="as-loading-page"><SurfaceCard><h1>Page not found</h1><p>The page may have moved, or this address is incomplete.</p><Link href="/workspace">Return to your workspace →</Link></SurfaceCard></main>;
}
