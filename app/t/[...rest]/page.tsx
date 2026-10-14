import { notFound } from "next/navigation";

// Pre-branch table links (/t/<n>) are retired (menu-browsing spec): always "table not found".
export default function RetiredTablePath() {
  notFound();
}
