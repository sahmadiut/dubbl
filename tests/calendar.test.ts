import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getDateLib, enUS as persianEnUS } from "react-day-picker/persian";
import type { DayButton } from "react-day-picker";
import ts from "typescript";
import * as nextIntl from "next-intl";
import * as presentationProvider from "../i18n/provider";
import { Calendar, CalendarDayButton } from "../components/ui/calendar";
import { DatePicker } from "../components/ui/date-picker";
import { dateOnlyToDate, dateToDateOnly, formatDateOnly, formatInstant } from "../i18n/dates";
import { resolvePresentation, type Presentation } from "../i18n/locale";
import { PresentationProvider } from "../i18n/provider";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const knownDates = [
  ["2020-03-20", "1399-01-01"], ["2021-03-20", "1399-12-30"], ["2021-03-21", "1400-01-01"],
  ["2024-03-19", "1402-12-29"], ["2024-03-20", "1403-01-01"], ["2024-02-29", "1402-12-10"],
  ["2025-03-20", "1403-12-30"], ["2025-03-21", "1404-01-01"],
] as const;
const zones = ["UTC", "Asia/Tehran", "America/Los_Angeles", "Pacific/Kiritimati", "Pacific/Pago_Pago"];
const numeric = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
const noop = () => {};
function render(node: ReactNode, presentation: Presentation) {
  return renderToStaticMarkup(createElement(PresentationProvider, {
    presentation, messages: presentation.locale === "fa-IR" ? fa : en, now: new Date("2026-10-20T00:00:00Z"),
  }, node));
}

test("strict date-only adapters reject malformed, localized, impossible and instant values", () => {
  for (const value of ["", "2024-2-09", "2023-02-29", "2024-02-30", "2024-13-01", "2024-00-01", "2024-01-00", "0000-01-01", "1403/01/01", "۱۴۰۳-۰۱-۰۱", "2024-03-20T00:00:00Z", "2024-03-20 ", " March 20, 2024"]) {
    assert.equal(dateOnlyToDate(value), undefined, value);
    assert.throws(() => formatDateOnly(value, resolvePresentation({})), RangeError);
  }
  for (const value of ["0001-01-01", "0099-12-31", "1900-02-28", "2000-02-29", "2024-02-29", "9999-12-31"]) {
    assert.equal(dateToDateOnly(dateOnlyToDate(value)!), value);
  }
  for (const date of [new Date(NaN), new Date("+010000-01-01T00:00:00Z")]) assert.throws(() => dateToDateOnly(date), RangeError);
});

test("known Gregorian/Persian dates agree across Intl and installed DayPicker including leap/year boundaries", () => {
  const lib = getDateLib({ locale: persianEnUS, numerals: "latn", timeZone: "UTC" });
  for (const [gregorian, persian] of knownDates) {
    const date = dateOnlyToDate(gregorian)!;
    assert.equal(lib.format(date, "yyyy-MM-dd"), persian);
    const presentation = resolvePresentation({ user: { language: "en-US", calendar: "persian", numerals: "latn" } });
    const parts = new Intl.DateTimeFormat("en-US", { ...numeric, timeZone: "UTC", calendar: presentation.calendar }).formatToParts(date);
    assert.equal(["year", "month", "day"].map(type => parts.find(p => p.type === type)!.value).join("-"), persian);
    assert.equal(dateToDateOnly(date), gregorian);
  }
  assert.equal(lib.format(lib.addDays(dateOnlyToDate("2025-03-20")!, 1), "yyyy-MM-dd"), "1404-01-01");
  assert.equal(lib.format(lib.addDays(dateOnlyToDate("2024-03-19")!, 1), "yyyy-MM-dd"), "1403-01-01");
});

test("date-only display is independent of timezone while instants honor it without mutation", () => {
  const instant = new Date("2024-03-20T00:30:00.000Z");
  const before = instant.toISOString();
  for (const language of ["en-US", "fa-IR"] as const) for (const calendar of ["gregory", "persian"]) for (const numerals of ["latn", "arabext"]) {
    const presentation = resolvePresentation({ user: { language, calendar, numerals } });
    const baseline = formatDateOnly("2024-03-20", presentation, numeric);
    for (const timeZone of zones) assert.equal(formatDateOnly("2024-03-20", { ...presentation, timeZone }, numeric), baseline);
  }
  const presentation = resolvePresentation({});
  assert.equal(formatDateOnly("2024-03-20", presentation), "Mar 20, 2024");
  assert.equal(formatInstant(instant, { ...presentation, timeZone: "America/Los_Angeles" }), "Mar 19, 2024");
  assert.equal(formatInstant(instant, { ...presentation, timeZone: "Asia/Tehran" }), "Mar 20, 2024");
  assert.equal(instant.toISOString(), before);
});

test("real picker grids and selected-day callbacks round-trip canonical dates under host and user timezones", () => {
  const originalTZ = process.env.TZ;
  try {
    for (const hostZone of ["UTC", "America/Los_Angeles", "Asia/Tehran"]) {
      process.env.TZ = hostZone;
      for (const language of ["en-US", "fa-IR"] as const) for (const calendar of ["gregory", "persian"]) {
        for (const [gregorian] of [...knownDates, ["2021-03-22", "1400-01-02"] as const]) {
          const presentation = resolvePresentation({ user: { language, calendar, timeZone: "Pacific/Pago_Pago" } });
          const buttons: React.ComponentProps<typeof DayButton>[] = [];
          let selected: Date | undefined;
          const html = render(createElement(Calendar, {
            mode: "single", defaultMonth: dateOnlyToDate(gregorian), today: dateOnlyToDate("2026-10-20"),
            onSelect: (date: Date | undefined) => { selected = date; },
            components: { DayButton: props => { buttons.push(props); return createElement(CalendarDayButton, props); } },
          }), presentation);
          assert.ok(html.includes(`dir="${language === "fa-IR" ? "rtl" : "ltr"}"`));
          const button = buttons.find(props => dateToDateOnly(props.day.date) === gregorian && !props.modifiers.outside)!;
          assert.ok(button, `${hostZone}/${language}/${calendar}/${gregorian}`);
          button.onClick!({ preventDefault: noop, stopPropagation: noop } as unknown as React.MouseEvent<HTMLButtonElement>);
          assert.equal(dateToDateOnly(selected!), gregorian);
          const selectedHTML = render(createElement(Calendar, { mode: "single", selected, defaultMonth: selected }), presentation);
          assert.ok(selectedHTML.includes(`data-day="${gregorian}" data-selected-single="true"`));
        }
      }
    }
  } finally {
    if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ;
  }
});

test("calendar captions, dropdowns, day numerals and accessible labels follow independent preferences", () => {
  for (const language of ["en-US", "fa-IR"] as const) for (const calendar of ["gregory", "persian"]) for (const numerals of ["latn", "arabext"]) {
    const presentation = resolvePresentation({ user: { language, calendar, numerals } });
    const date = dateOnlyToDate("2024-03-20")!;
    const html = render(createElement(Calendar, { mode: "single", selected: date, defaultMonth: date, captionLayout: "dropdown" }), presentation);
    const year = calendar === "persian" ? "1403" : "2024";
    const renderedYear = numerals === "arabext" ? year.replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]) : year;
    assert.ok(html.includes(`>${renderedYear}</option>`), `${language}/${calendar}/${numerals}`);
    assert.ok(html.includes(language === "fa-IR" ? calendar === "persian" ? "فروردین" : "مارس" : calendar === "persian" ? "Farvardin" : "March"));
    assert.ok(html.includes(language === "fa-IR" ? "انتخاب شده" : "selected"));
    assert.ok(html.includes(`>${numerals === "arabext" ? calendar === "persian" ? "۱" : "۲۰" : calendar === "persian" ? "1" : "20"}</button>`));
    const trigger = render(createElement(DatePicker, { value: "2024-03-20" }), presentation);
    assert.ok(trigger.includes(formatDateOnly("2024-03-20", presentation)));
    assert.ok(!trigger.includes("Invalid Date"));
  }
  const presentation = resolvePresentation({ user: { language: "fa-IR" } });
  for (const value of [undefined, "2024-02-30", "۱۴۰۳/۰۱/۰۱"]) {
    assert.ok(render(createElement(DatePicker, { value }), presentation).includes(fa.SharedUI.pickADate));
  }
});

// Open the real DatePicker's portal in SSR and capture its real Calendar props.
// Only Popover's portal boundary is replaced; hooks/context and DayPicker run.
test("DatePicker selections emit ISO Gregorian strings, close the popover and preserve empty-selection behavior", () => {
  const path = "components/ui/date-picker.tsx", require = createRequire(resolve(path));
  type Props = Record<string, unknown> & { children?: ReactNode };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  for (const language of ["en-US", "fa-IR"] as const) {
    let calendarProps: React.ComponentProps<typeof Calendar> | undefined;
    const openStates: boolean[] = [], changes: string[] = [];
    const compiled = { exports: {} as { DatePicker: (props: Props) => ReactElement } };
    const inline = ({ children }: Props) => createElement("div", null, children);
    const load = (id: string) => {
      if (id === "react") return { ...React, useState: () => [true, (value: boolean) => openStates.push(value)] };
      if (id === "next-intl") return nextIntl;
      if (id === "@/i18n/provider") return presentationProvider;
      if (id === "@/components/ui/popover") return { Popover: inline, PopoverTrigger: inline, PopoverContent: inline };
      if (id === "@/components/ui/calendar") return { Calendar: (props: React.ComponentProps<typeof Calendar>) => { calendarProps = props; return createElement(Calendar, props); } };
      return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
    };
    new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
    render(createElement(compiled.exports.DatePicker, { value: "2024-03-20", onChange: (value: string) => changes.push(value) }), resolvePresentation({ user: { language, timeZone: "America/Los_Angeles" } }));
    assert.ok(calendarProps?.mode === "single");
    assert.equal(calendarProps.timeZone, "UTC");
    assert.equal(dateToDateOnly(calendarProps.selected as Date), "2024-03-20");
    const onSelect = calendarProps.onSelect as (date: Date | undefined) => void;
    onSelect(dateOnlyToDate("2025-03-20"));
    assert.deepEqual(changes, ["2025-03-20"]);
    assert.deepEqual(openStates, [false]);
    onSelect(undefined);
    assert.deepEqual(changes, ["2025-03-20"]);
    assert.deepEqual(openStates, [false, false]);
  }
});
