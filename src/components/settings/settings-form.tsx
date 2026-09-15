"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Monitor, Moon, Sun } from "lucide-react";
import { updateSettingsAction } from "@/app/actions/preferences";
import { useI18n } from "@/i18n/provider";
import type { Locale, Theme } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useActionFeedback } from "@/components/items/use-action-feedback";

type Props = {
  initial: { displayName: string; locale: Locale; timezone: string; theme: Theme };
  timeZones: string[];
};

const THEME_ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

export function SettingsForm({ initial, timeZones }: Props) {
  const { m } = useI18n();
  const router = useRouter();
  const { showError } = useActionFeedback();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const zones = timeZones.includes(values.timezone) ? timeZones : [values.timezone, ...timeZones];

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateSettingsAction(values);
          if (!result.ok) {
            if (result.fieldErrors) setErrors(result.fieldErrors);
            else showError(result.error);
            return;
          }
          setErrors({});
          // Apply the theme immediately; the cookie keeps it on the next server render.
          const root = document.documentElement;
          if (values.theme === "system") root.removeAttribute("data-theme");
          else root.setAttribute("data-theme", values.theme);
          toast.success(m.settings.saved);
          router.refresh();
        });
      }}
    >
      <section className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5 sm:p-6" aria-labelledby="settings-profile">
        <h2 id="settings-profile" className="font-display text-lg font-semibold text-ink">
          {m.settings.profile}
        </h2>
        <Field label={m.settings.displayName} optionalLabel={m.common.optional} error={errors.displayName ? m.validation.tooLong.replace("{max}", "80") : undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={values.displayName}
              maxLength={80}
              autoComplete="nickname"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => setValues((v) => ({ ...v, displayName: e.target.value }))}
            />
          )}
        </Field>
      </section>

      <section className="flex flex-col gap-6 rounded-card border border-line bg-surface p-5 sm:p-6" aria-labelledby="settings-preferences">
        <h2 id="settings-preferences" className="font-display text-lg font-semibold text-ink">
          {m.settings.preferences}
        </h2>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">{m.settings.language}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["ar", "en"] as const).map((locale) => (
              <label key={locale} className="relative">
                <input
                  type="radio"
                  name="locale"
                  value={locale}
                  checked={values.locale === locale}
                  onChange={() => setValues((v) => ({ ...v, locale }))}
                  className="peer sr-only"
                />
                <span
                  lang={locale}
                  className="flex min-h-12 cursor-pointer items-center justify-center rounded-control border border-line px-3 font-medium text-ink transition-colors peer-checked:border-ink peer-checked:bg-surface-muted peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
                >
                  {m.settings.languages[locale]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={m.settings.timezone} hint={m.settings.timezoneHint} error={errors.timezone ? m.validation.timezone : undefined}>
          {({ id, describedBy, invalid }) => (
            <div className="flex flex-col gap-2">
              <Select id={id} value={values.timezone} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => setValues((v) => ({ ...v, timezone: e.target.value }))} dir="ltr">
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => {
                  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                  if (detected) setValues((v) => ({ ...v, timezone: detected }));
                }}
              >
                {m.settings.detectTimezone}
              </Button>
            </div>
          )}
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">{m.settings.theme}</legend>
          <div className="grid grid-cols-3 gap-2">
            {(["system", "light", "dark"] as const).map((theme) => {
              const Icon = THEME_ICONS[theme];
              return (
                <label key={theme} className="relative">
                  <input
                    type="radio"
                    name="theme"
                    value={theme}
                    checked={values.theme === theme}
                    onChange={() => setValues((v) => ({ ...v, theme }))}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-control border border-line px-2 py-2 text-sm font-medium text-ink transition-colors peer-checked:border-ink peer-checked:bg-surface-muted peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus sm:flex-row sm:gap-2">
                    <Icon className="size-4.5" aria-hidden />
                    {m.settings.themes[theme]}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={pending}>
          {m.common.save}
        </Button>
      </div>
    </form>
  );
}
