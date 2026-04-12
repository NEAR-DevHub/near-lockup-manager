const NEAR_DECIMALS = 24;
const DISPLAY_DECIMALS = 5;
const LOCKUP_FACTORY = "lockup.near";

export function formatNearAmount(yoctoNear: string): string {
  if (!yoctoNear || yoctoNear === "0") return "0";

  const padded = yoctoNear.padStart(NEAR_DECIMALS + 1, "0");
  const intPart = padded.slice(0, padded.length - NEAR_DECIMALS) || "0";
  const fracDigits = padded.slice(padded.length - NEAR_DECIMALS);

  const kept = fracDigits.slice(0, DISPLAY_DECIMALS);
  const nextDigit = parseInt(fracDigits[DISPLAY_DECIMALS] ?? "0", 10);

  let fracPart = kept;
  if (nextDigit >= 5) {
    const rounded = (parseInt(kept, 10) + 1)
      .toString()
      .padStart(DISPLAY_DECIMALS, "0");
    if (rounded.length > DISPLAY_DECIMALS) {
      return addThousandSeparators((BigInt(intPart) + BigInt(1)).toString());
    }
    fracPart = rounded;
  }

  const trimmedFrac = fracPart.replace(/0+$/, "");
  const whole = trimmedFrac ? `${intPart}.${trimmedFrac}` : intPart;
  const [w, f] = whole.split(".");
  const formatted = addThousandSeparators(w);
  return f ? `${formatted}.${f}` : formatted;
}

function addThousandSeparators(s: string): string {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function parseNearToYocto(near: string): string {
  if (!near || near === "0") return "0";
  const [intPart, fracPart = ""] = near.split(".");
  const paddedFrac = fracPart.padEnd(NEAR_DECIMALS, "0").slice(0, NEAR_DECIMALS);
  const full = intPart + paddedFrac;
  return full.replace(/^0+/, "") || "0";
}

export async function deriveLockupAccountId(
  ownerAccountId: string
): Promise<string> {
  const data = new TextEncoder().encode(ownerAccountId);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  const first20 = hashArray.slice(0, 20);
  const hex = Array.from(first20)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex}.${LOCKUP_FACTORY}`;
}
