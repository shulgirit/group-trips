import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { formatDayLabel } from "@together/i18n/format";
import { googleMapsUrl } from "@together/shared/nav";
import { tripDays } from "@together/shared/trip";
import { colors } from "@together/shared/tokens";
import { useMutation } from "convex/react";
import { type Href, Stack, router } from "expo-router";
import { BedDouble, CalendarDays, Check, Coins, Pencil, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, Switch, View } from "react-native";
import { ConfirmSheet } from "@/components/more/ConfirmSheet";
import { Group, Row, styles as rowStyles } from "@/components/more/Row";
import { GuideAvatar } from "@/components/trips/GuideAvatar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ChipRow } from "@/components/ui/ChipRow";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { CurrencyPicker } from "@/components/more/CurrencyPicker";
import { tripCurrencies } from "@together/shared/currency";
import { type TKey, useLocale, useT } from "@/lib/i18n";
import { useFamilies, useTrip } from "@/lib/trip";

/** Currency names in the UI language; ISO codes where the engine has no Intl.DisplayNames (Hermes). */
function currencyNames(codes: string[], locale: string): string {
  let names: { of(code: string): string | undefined } | null = null;
  try {
    const DisplayNames = (Intl as { DisplayNames?: new (l: string[], o: { type: string }) => { of(code: string): string | undefined } }).DisplayNames;
    if (DisplayNames) names = new DisplayNames([locale], { type: "currency" });
  } catch {
    names = null;
  }
  return codes.map((code) => names?.of(code) ?? code).join(" · ");
}

/** Who you are on the trip: pick your family, then your name. */
function WhoAmI() {
  const t = useT();
  const { id, me } = useTrip();
  const families = useFamilies();
  const linkSeat = useMutation(api.memberships.linkSeat);
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const linkedFamily = families?.find((f) => f.id === me.familyId);
  const linkedMember = linkedFamily?.members.find((m) => m.id === me.memberKey);

  async function link(familyId: string, memberKey: string) {
    setError("");
    try {
      await linkSeat({ tripId: id, familyId: familyId as Id<"families">, memberKey });
      setPicking(null);
    } catch {
      setError(t("common.errors.saveFailed"));
    }
  }

  return (
    <View style={[rowStyles.surface, { padding: 16, gap: 12 }]}>
      {linkedMember ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon icon={Check} size={16} color={colors.route500} />
          <Text variant="small" color={colors.ink700} style={{ flex: 1 }}>
            {t("settings.account.linkedTo", { member: linkedMember.name, family: linkedFamily?.name ?? "" })}
          </Text>
        </View>
      ) : (
        <Text variant="small" color={colors.ink700}>
          {t("settings.account.whoAreYou")}
        </Text>
      )}
      {families === undefined ? (
        <ActivityIndicator color={colors.ink500} />
      ) : (
        <>
          <ChipRow>
            {families.map((family) => (
              <Chip key={family.id} label={family.name} active={picking === family.id || (!picking && me.familyId === family.id)} onPress={() => setPicking(picking === family.id ? null : family.id)} />
            ))}
          </ChipRow>
          {picking && (
            <View style={{ backgroundColor: colors.chart100, borderRadius: 16, padding: 8 }}>
              <ChipRow>
                {families
                  .find((f) => f.id === picking)
                  ?.members.map((member) => (
                    <Chip key={member.id} label={member.name} active={me.memberKey === member.id && me.familyId === picking} onPress={() => link(picking, member.id)} />
                  ))}
              </ChipRow>
            </View>
          )}
        </>
      )}
      {error ? (
        <Text accessibilityRole="alert" variant="small" color={colors.terra600}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Free text the guide knows about the group — every member may edit it. */
function AboutUs() {
  const t = useT();
  const { id, doc, config, avatarUrl } = useTrip();
  const save = useMutation(api.trips.setAboutUs);
  const [text, setText] = useState(doc.aboutUs ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const avatar = doc.ai.avatar?.kind === "bot" ? `bot:${doc.ai.avatar.id}` : avatarUrl;

  async function submit() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      await save({ tripId: id, aboutUs: text.trim() });
      setMessage(config.ai.aboutSaved);
    } catch {
      setMessage(t("common.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[rowStyles.surface, { padding: 16, gap: 12 }]}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <GuideAvatar avatar={avatar} emoji={config.ai.moreEmoji} size={36} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="medium">{config.ai.aboutTitle}</Text>
          <Text variant="small" color={colors.ink500}>
            {config.ai.aboutDescription}
          </Text>
        </View>
      </View>
      <Field
        value={text}
        onChangeText={setText}
        multiline
        accessibilityLabel={config.ai.aboutTitle}
        placeholder={config.ai.aboutPlaceholder}
        style={{ minHeight: 120, textAlignVertical: "top" }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Button label={saving ? t("common.saving") : t("common.save")} onPress={submit} busy={saving} />
        {message ? (
          <Text accessibilityRole="text" variant="small" color={colors.ink700} style={{ flex: 1 }}>
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Trip settings: you, the trip's details, organizer controls, then the danger zone. */
export default function Settings() {
  const t = useT();
  const { locale } = useLocale();
  const { id, doc, config, me, isAdmin, isKid } = useTrip();
  const setSettings = useMutation(api.trips.setSettings);
  const leave = useMutation(api.memberships.leave);
  const removeTrip = useMutation(api.trips.remove);
  const [dialog, setDialog] = useState<"leave" | "purge" | null>(null);
  const [error, setError] = useState("");
  const isOwner = me.role === "owner";

  const currencies = tripCurrencies(config);
  const setCurrencies = useMutation(api.trips.setCurrencies);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const dayCount = tripDays(config).length;

  async function run(action: "leave" | "purge", failKey: TKey) {
    setError("");
    try {
      await (action === "leave" ? leave({ tripId: id }) : removeTrip({ tripId: id }));
      setDialog(null);
      router.replace("/trips");
    } catch {
      setError(t(failKey));
    }
  }

  return (
    <>
      <CurrencyPicker key={String(currencyOpen)} open={currencyOpen} initial={currencies} onClose={() => setCurrencyOpen(false)} onSave={async (codes) => {
          await setCurrencies({ tripId: id, currencies: codes });
        }} />
      <Stack.Screen options={{ title: t("settings.title") }} />
      <Screen edges={[]}>
        <Group title={t("settings.sections.you")}>
          <Row icon={Pencil} label={t("product.account.title")} description={t("settings.sections.youHint")} onPress={() => router.push("/account")} last />
        </Group>
        <WhoAmI />

        <Group title={t("settings.sections.trip")}>
          <Row
            icon={CalendarDays}
            label={t("settings.trip.dates")}
            description={`${formatDayLabel(config.startDate, locale)} – ${formatDayLabel(config.endDate, locale)} · ${t("settings.trip.days", { count: dayCount })}`}
          />
          {config.homeBase && (
            <Row
              icon={BedDouble}
              label={`${t("settings.trip.homeBase")}: ${config.homeBase.name}`}
              description={config.homeBase.address}
              onPress={() => Linking.openURL(googleMapsUrl(config.homeBase!, config.searchRegionHint))}
            />
          )}
          <Row icon={Coins} label={t("settings.trip.currency")} description={currencyNames(currencies, locale)} onPress={isAdmin ? () => setCurrencyOpen(true) : undefined} last={!isAdmin} />
          {isAdmin && (
            <Row
              icon={Trash2}
              // "settings.trip.membersCanDeletePlaces" is missing from packages/i18n (reported)
              label={t("settings.trip.membersCanDeletePlaces")}
              trailing={
                <Switch
                  value={doc.membersCanDeletePlaces}
                  onValueChange={(value) => {
                    setSettings({ tripId: id, membersCanDeletePlaces: value }).catch(() => setError(t("common.errors.saveFailed")));
                  }}
                  trackColor={{ true: colors.route500, false: colors.chart300 }}
                />
              }
              last
            />
          )}
        </Group>
        {isAdmin && <Button tone="soft" icon={Pencil} label={t("product.admin.editTrip")} onPress={() => router.push(`/new?trip=${id}` as Href)} />}

        <AboutUs />

        {!isKid && (
          <Group title={t("product.admin.dangerTitle")}>
            <View style={{ padding: 16, gap: 12 }}>
              {isOwner && (
                <Text variant="small" color={colors.ink500}>
                  {t("product.admin.deleteTripHint")}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => setDialog(isOwner ? "purge" : "leave")}
                style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.terra100, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}
              >
                <Text weight="medium" color={colors.terra600} align="center">
                  {isOwner ? t("product.admin.deleteTrip") : t("product.admin.leave")}
                </Text>
              </Pressable>
            </View>
          </Group>
        )}

        {error && !dialog ? (
          <Text accessibilityRole="alert" variant="small" color={colors.terra600}>
            {error}
          </Text>
        ) : null}
        <Text variant="caption" color={colors.ink400} align="center">
          {config.signature}
        </Text>
      </Screen>

      <ConfirmSheet
        open={dialog === "leave"}
        title={t("product.admin.leaveConfirm")}
        description={t("product.admin.leaveText")}
        items={[t("product.admin.leaveItems.chats"), t("product.admin.leaveItems.documents"), t("product.admin.leaveItems.location"), t("product.admin.leaveItems.shared")]}
        confirmWord={t("common.confirm.word")}
        confirmLabel={t("product.admin.leaveAction")}
        error={error}
        onConfirm={() => run("leave", "product.admin.leaveFailed")}
        onClose={() => {
          setDialog(null);
          setError("");
        }}
      />
      <ConfirmSheet
        open={dialog === "purge"}
        title={t("product.admin.deleteTripTitle", { name: config.name })}
        description={t("product.admin.deleteTripText")}
        items={[
          t("product.admin.deleteTripItems.content"),
          t("product.admin.deleteTripItems.files"),
          t("product.admin.deleteTripItems.chats"),
          t("product.admin.deleteTripItems.people"),
        ]}
        confirmWord={t("common.confirm.word")}
        confirmLabel={t("product.admin.deleteTrip")}
        error={error}
        onConfirm={() => run("purge", "product.admin.deleteTripFailed")}
        onClose={() => {
          setDialog(null);
          setError("");
        }}
      />
    </>
  );
}
