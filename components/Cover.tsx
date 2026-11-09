"use client";
// Artwork for a restaurant card: a gradient chosen from the restaurant id and an
// emoji that matches its main cuisine (no external images needed).

const EMOJI: [RegExp, string][] = [
  [/biryani|hyderabadi|mughlai/i, "🍛"], [/pizza|italian/i, "🍕"], [/burger|american/i, "🍔"],
  [/sushi|japanese/i, "🍣"], [/chinese|asian|momo|wok/i, "🍜"], [/sea ?food|coastal|fish|konkan|malvani/i, "🦐"],
  [/kebab|grill|barbecue|bbq|tandoor/i, "🍢"], [/dessert|ice cream|sweet|bakery/i, "🍨"], [/chaat|street/i, "🥙"],
  [/cafe|beverage|tea|chai|coffee/i, "☕"], [/healthy|salad|continental/i, "🥗"], [/south indian|udupi|tiffin|dosa/i, "🥞"],
  [/punjabi|north indian|thali|gujarati|rajasthani/i, "🍲"], [/pav|maharashtrian/i, "🥪"],
];
const GRADIENTS = [
  "from-orange-400 via-rose-400 to-pink-500", "from-amber-300 via-orange-400 to-red-500", "from-emerald-400 via-teal-400 to-cyan-500",
  "from-sky-400 via-indigo-400 to-violet-500", "from-rose-400 via-fuchsia-400 to-purple-500", "from-lime-300 via-emerald-400 to-teal-500",
  "from-yellow-300 via-amber-400 to-orange-500", "from-pink-400 via-red-400 to-orange-400",
];

export function cuisineEmoji(cuisines: string | null | undefined, name = "") {
  const text = `${cuisines || ""} ${name}`;
  for (const [re, e] of EMOJI) if (re.test(text)) return e;
  return "🍽️";
}

export default function Cover({ id, name, cuisines, className = "h-40", children }: { id: number; name: string; cuisines?: string | null; className?: string; children?: any }) {
  const g = GRADIENTS[Number(id) % GRADIENTS.length];
  const e = cuisineEmoji(cuisines, name);
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${g} ${className}`}>
      <div className="absolute -right-6 -top-8 text-[120px] opacity-25 rotate-12 select-none">{e}</div>
      <div className="absolute bottom-3 left-4 text-5xl drop-shadow select-none">{e}</div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
      {children}
    </div>
  );
}
