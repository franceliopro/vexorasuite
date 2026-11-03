export function tagForeground(color: string): string {
  const value = color.trim();
  let r = 238;
  let g = 236;
  let b = 255;
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const hexValue = hex[1] || "000000";
    const normalized = hexValue.length === 3
      ? hexValue.split("").map((part) => part + part).join("")
      : hexValue;
    r = parseInt(normalized.slice(0, 2), 16);
    g = parseInt(normalized.slice(2, 4), 16);
    b = parseInt(normalized.slice(4, 6), 16);
  } else {
    const rgb = value.match(/^rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/i);
    if (rgb) {
      r = Number(rgb[1]);
      g = Number(rgb[2]);
      b = Number(rgb[3]);
    }
  }

  const linear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) > 0.179
    ? "#171923"
    : "#ffffff";
}
