import { colors } from "@together/shared/tokens";
import { Mail } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Text } from "@/components/ui/Text";
import { appleNativeAvailable, sendEmailCode, signInWithApple, signInWithBrowser, verifyEmailCode } from "@/lib/auth";
import { useT } from "@/lib/i18n";

/**
 * Apple (native sheet on iOS), Google, and a 6-digit email code. On the dark
 * Atlas ground. Calls onSignedIn once the session exists.
 */
export function SignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  const t = useT();
  const [appleNative, setAppleNative] = useState(false);
  const [busy, setBusy] = useState<"apple" | "google" | "email" | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"buttons" | "email" | "code">("buttons");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => {
    appleNativeAvailable().then(setAppleNative).catch(() => undefined);
  }, []);

  async function run(kind: "apple" | "google", action: () => Promise<void>) {
    if (busy) return;
    setBusy(kind);
    setError("");
    try {
      await action();
      onSignedIn?.();
    } catch (err) {
      const code = (err as { code?: string }).code;
      // Closing the Apple sheet is not an error
      if (code !== "ERR_REQUEST_CANCELED") setError(t("product.signIn.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (busy || !/^\S+@\S+\.\S+$/.test(email.trim())) return;
    setBusy("email");
    setError("");
    try {
      await sendEmailCode(email);
      setStep("code");
    } catch {
      setError(t("product.signIn.sendFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    if (busy || code.length < 6) return;
    setBusy("email");
    setError("");
    try {
      await verifyEmailCode(email, code);
      onSignedIn?.();
    } catch {
      setError(t("product.signIn.invalidCode"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      {appleNative ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={12}
          style={{ height: 52 }}
          onPress={() => run("apple", signInWithApple)}
        />
      ) : Platform.OS === "android" ? (
        <Button tone="light" label={t("product.signIn.apple")} busy={busy === "apple"} onPress={() => run("apple", () => signInWithBrowser("apple"))} />
      ) : null}
      <Button tone="light" label={t("product.signIn.google")} busy={busy === "google"} onPress={() => run("google", () => signInWithBrowser("google"))} />

      {step === "buttons" && (
        <Button tone="ghost" icon={Mail} label={t("product.signIn.email")} onPress={() => setStep("email")} />
      )}
      {step === "email" && (
        <View style={{ gap: 8 }}>
          <Field
            value={email}
            onChangeText={setEmail}
            autoFocus
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder={t("product.signIn.emailPlaceholder")}
            accessibilityLabel={t("product.signIn.emailLabel")}
            onSubmitEditing={send}
            style={{ textAlign: "left", writingDirection: "ltr" }}
          />
          <Button tone="brass" label={t("product.signIn.sendCode")} busy={busy === "email"} onPress={send} />
        </View>
      )}
      {step === "code" && (
        <View style={{ gap: 8 }}>
          <Text variant="small" color="rgba(241,243,239,0.75)" align="center">
            {t("product.signIn.codeSent", { email: email.trim() })}
          </Text>
          <Field
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            accessibilityLabel={t("product.signIn.codeLabel")}
            onSubmitEditing={verify}
            style={{ textAlign: "center", fontSize: 26, letterSpacing: 10, writingDirection: "ltr" }}
          />
          <Button tone="brass" label={t("product.signIn.verify")} busy={busy === "email"} disabled={code.length < 6} onPress={verify} />
          <Button tone="ghost" label={t("product.signIn.changeEmail")} onPress={() => setStep("email")} style={{ borderWidth: 0 }} />
        </View>
      )}
      {error ? (
        <Text variant="small" weight="medium" color={colors.brass300} align="center" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
