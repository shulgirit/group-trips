import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { verifyEmailCode } from "@/lib/auth";

/**
 * Development only: completes an email-code sign-in from a deep link
 * (together://dev-sign-in?email=…&otp=…), so simulator checks can run without
 * tapping. It still needs a real code; release builds redirect away.
 */
export default function DevSignIn() {
  const { email, otp, next } = useLocalSearchParams<{ email?: string; otp?: string; next?: string }>();
  const [status, setStatus] = useState("signing in…");
  useEffect(() => {
    if (!__DEV__ || !email || !otp) return;
    verifyEmailCode(email, otp)
      .then(() => router.replace((next as "/trips") || "/trips"))
      .catch((err: Error) => setStatus(err.message));
  }, [email, otp, next]);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen>
      <Text>{status}</Text>
    </Screen>
  );
}
