"use client";
import { useMemo, useState } from "react";
import { Combobox, Transition } from "@headlessui/react";
import { countries, Country, findByCode } from "../lib/countries";
import { Controller, Control } from "react-hook-form";

type Props = {
  name: string;                 // RHF field name, e.g. "country"
  control: Control<any>;
  label?: string;
  placeholder?: string;         // defaults to "Select a country…"
  error?: string | undefined;   // pass RHF error message (optional)
};

export function CountryCombobox({
  name,
  control,
  label = "Country *",
  placeholder = "Select a country…",
  error,
}: Props) {
  return (
    <Controller
      control={control}
      name={name}
      defaultValue=""           // empty by default ⇒ shows placeholder
      render={({ field }) => <CountryComboboxInner
        value={field.value as string}
        onChange={(code) => field.onChange(code)}
        label={label}
        placeholder={placeholder}
        error={error}
      />}
    />
  );
}

export function CountryComboboxInner({
  value,
  onChange,
  label,
  placeholder,
  error,
}: {
  value: string;
  onChange: (code: string) => void;
  label: string;
  placeholder: string;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const selected = useMemo<Country | null>(() => findByCode(value), [value]);

  const filtered =
    query.trim() === ""
      ? countries
      : countries.filter((c) =>
          c.label.toLowerCase().includes(query.trim().toLowerCase())
        );

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      <Combobox value={selected} onChange={(c: Country | null) => onChange(c?.code ?? "")}>
        <div
          className={[
            "mt-1 relative",
            error
              ? "ring-1 ring-red-500/40"
              : "",
          ].join(" ")}
        >
          {/* Input that also acts as trigger; shows placeholder when empty */}
          <div className={`flex items-center h-11 rounded-lg border px-3
                           ${error ? "border-red-500" : "border-gray-300 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20"}`}>
            <Combobox.Input
              displayValue={(c: Country | null) => c?.label ?? ""}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent outline-none border-none placeholder:text-gray-400"
              autoComplete="off"
            />
            <Combobox.Button className="ml-2 text-gray-500">▾</Combobox.Button>
          </div>

          <Transition
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            afterLeave={() => setQuery("")}
          >
            <Combobox.Options
              className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-xl bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none"
            >
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">No results</div>
              )}
              {filtered.map((c) => (
                <Combobox.Option
                  key={c.code}
                  value={c}
                  className={({ active }) =>
                    `cursor-pointer select-none px-3 py-2 text-sm ${
                      active ? "bg-gray-100" : ""
                    }`
                  }
                >
                  {c.label}
                </Combobox.Option>
              ))}
            </Combobox.Options>
          </Transition>
        </div>
      </Combobox>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
