import { useEffect, useMemo, useRef, useState } from "react";
import {
  AsYouType,
  CountryCode,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumber,
} from "libphonenumber-js";
import { AlertCircle, ChevronDown } from "lucide-react";

function countryToFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join("");
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

interface Country {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
}

const ALL_COUNTRIES: Country[] = getCountries()
  .map((code) => ({
    code,
    name: regionNames.of(code) ?? code,
    dialCode: "+" + getCountryCallingCode(code),
    flag: countryToFlag(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export interface PhoneInputProps {
  value: string;
  onChange: (e164: string, isValid: boolean) => void;
  defaultCountry?: CountryCode;
  disabled?: boolean;
  error?: string;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry = "BT",
  disabled,
  error,
  onFocus,
}: PhoneInputProps) {
  const [country, setCountry] = useState<CountryCode>(() => {
    if (value) {
      try {
        return parsePhoneNumber(value).country ?? defaultCountry;
      } catch {
        /**/
      }
    }
    return defaultCountry;
  });

  const [inputValue, setInputValue] = useState(() => {
    if (value) {
      try {
        return parsePhoneNumber(value).formatNational();
      } catch {
        /**/
      }
    }
    return "";
  });

  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCountry = useMemo(
    () =>
      ALL_COUNTRIES.find((c) => c.code === country) ??
      ALL_COUNTRIES.find((c) => c.code === "BT")!,
    [country],
  );

  const filteredCountries = useMemo(() => {
    if (!search) return ALL_COUNTRIES;
    const q = search.toLowerCase();
    return ALL_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q),
    );
  }, [search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (showDropdown) setTimeout(() => searchRef.current?.focus(), 50);
  }, [showDropdown]);

  const handleInput = (raw: string) => {
    // Limit digits based on country (Bhutan = 8 digits, most others = 10-12)
    const maxDigits = country === "BT" ? 8 : 15;
    const digits = raw.replace(/\D/g, "").slice(0, maxDigits);
    const formatter = new AsYouType(country);
    const formatted = formatter.input(digits);
    setInputValue(formatted);
    const phoneNumber = formatter.getNumber();
    if (phoneNumber) {
      const e164 = phoneNumber.number as string;
      onChange(e164, isValidPhoneNumber(e164));
    } else {
      onChange("", false);
    }
  };

  const handleCountrySelect = (code: CountryCode) => {
    setCountry(code);
    setInputValue("");
    setShowDropdown(false);
    setSearch("");
    onChange("", false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    handleInput(e.clipboardData.getData("text").replace(/\D/g, ""));
  };

  const borderColor = error
    ? "#ef4444"
    : "var(--glass-border, rgba(255,255,255,0.08))";

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Input row */}
      <div
        style={{
          display: "flex",
          borderRadius: 14,
          border: `1px solid ${borderColor}`,
          background: "var(--bg-card, #1a1f2e)",
          overflow: "visible",
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? "none" : "auto",
        }}
      >
        {/* Country selector button */}
        <button
          type="button"
          onClick={() => setShowDropdown((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "14px 10px 14px 14px",
            background: "transparent",
            border: "none",
            borderRight: `1px solid ${borderColor}`,
            cursor: "pointer",
            flexShrink: 0,
            borderRadius: "14px 0 0 14px",
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>
            {selectedCountry.flag}
          </span>
          <span
            style={{
              fontSize: 14,
              color: "var(--text-muted, #94a3b8)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {selectedCountry.dialCode}
          </span>
          <ChevronDown
            size={14}
            color="var(--text-subtle, #64748b)"
            style={{
              transition: "transform 0.2s",
              transform: showDropdown ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>

        {/* Number input */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          value={inputValue}
          onChange={(e) => handleInput(e.target.value)}
          onPaste={handlePaste}
          onFocus={onFocus}
          placeholder="17 000 000"
          style={{
            flex: 1,
            padding: "14px 14px 14px 12px",
            background: "transparent",
            border: "none",
            color: "var(--text-main, #f8fafc)",
            fontSize: 16,
            outline: "none",
            minWidth: 0,
          }}
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 100,
            borderRadius: 14,
            background: "var(--bg-card, #1a1f2e)",
            border: "1px solid var(--glass-border, rgba(255,255,255,0.08))",
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}
        >
          {/* Search */}
          <div
            style={{
              padding: 8,
              borderBottom:
                "1px solid var(--glass-border, rgba(255,255,255,0.08))",
            }}
          >
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowDropdown(false);
                  setSearch("");
                }
                if (e.key === "Enter" && filteredCountries.length > 0)
                  handleCountrySelect(filteredCountries[0].code);
              }}
              placeholder="Search country..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--bg-main, #0f1117)",
                border: "1px solid var(--glass-border, rgba(255,255,255,0.08))",
                color: "var(--text-main, #f8fafc)",
                fontSize: 16,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          {/* List */}
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {filteredCountries.length === 0 ? (
              <p
                style={{
                  padding: "12px 16px",
                  fontSize: 13,
                  color: "var(--text-muted, #94a3b8)",
                  textAlign: "center",
                  margin: 0,
                }}
              >
                No results
              </p>
            ) : (
              filteredCountries.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleCountrySelect(c.code)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 16px",
                    background:
                      c.code === country
                        ? "rgba(39,117,208,0.12)"
                        : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{c.flag}</span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color:
                        c.code === country
                          ? "#2775d0"
                          : "var(--text-main, #f8fafc)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted, #94a3b8)",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {c.dialCode}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 6,
            fontSize: 12,
            color: "#ef4444",
          }}
        >
          <AlertCircle size={13} />
          {error}
        </div>
      )}
    </div>
  );
}
