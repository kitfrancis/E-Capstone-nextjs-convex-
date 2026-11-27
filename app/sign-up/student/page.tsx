import { redirect } from "next/navigation";

// Students don't self-register. Their account is provisioned from the
// instructor's roster, and they sign in with Google using the rostered email.
export default function StudentSignUpPage() {
  redirect("/sign-in?role=student");
}