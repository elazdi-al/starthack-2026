import { redirect } from "next/navigation";

/** Redirect the root URL to the default tab. */
export default function Home() {
  redirect("/greenhouse");
}
