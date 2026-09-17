const EUROPE = "AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA GE AM AZ TR".split(" ");
const ASIA = "AF BH BD BT BN KH CN IN ID IR IQ IL JP JO KZ KW KG LA LB MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TM AE UZ VN YE HK MO".split(" ");
const OCEANIA = "AU NZ FJ PG SB VU WS TO KI FM MH PW NR TV NC PF GU".split(" ");
const AFRICA = "DZ AO BJ BW BF BI CM CV CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW RE".split(" ");

export const REGIONS = [
  { id: "US", label: "USA" },
  { id: "AMERICA", label: "America" },
  { id: "EUROPE", label: "Europe" },
  { id: "OCEANIA", label: "AU,Oceania" },
  { id: "ASIA", label: "Asia" },
  { id: "AFRICA", label: "Africa" },
];

export function regionOf(cc) {
  if (!cc) return "AMERICA";
  if (cc === "US") return "US";
  if (EUROPE.includes(cc)) return "EUROPE";
  if (ASIA.includes(cc)) return "ASIA";
  if (OCEANIA.includes(cc)) return "OCEANIA";
  if (AFRICA.includes(cc)) return "AFRICA";
  return "AMERICA";
}

export function addedLabel(iso) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days`;
}
