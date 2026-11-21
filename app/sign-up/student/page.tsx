import { redirect } from "next/navigation";

// Students no longer sign themselves up. Their account is created when their
// instructor imports the roster, and the temporary password arrives by email.
export default function StudentSignUpPage() {
  redirect("/sign-in?role=student");
}