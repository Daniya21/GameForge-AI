import { redirect } from "next/navigation";

export default function RemovedBibleRedirect() {
  redirect("/projects");
}
