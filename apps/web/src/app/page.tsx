import { redirect } from "next/navigation";

/** The site root is the landing page; signed-in people continue to their trips from there. */
export default function Root() {
  redirect("/welcome");
}
