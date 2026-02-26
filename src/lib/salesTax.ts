// State sales tax rates (as of 2024)
// Source: Tax Foundation / state revenue departments
const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.04, AK: 0, AZ: 0.056, AR: 0.065, CA: 0.0725,
  CO: 0.029, CT: 0.0635, DE: 0, FL: 0.06, GA: 0.04,
  HI: 0.04, ID: 0.06, IL: 0.0625, IN: 0.07, IA: 0.06,
  KS: 0.065, KY: 0.06, LA: 0.0445, ME: 0.055, MD: 0.06,
  MA: 0.0625, MI: 0.06, MN: 0.06875, MS: 0.07, MO: 0.04225,
  MT: 0, NE: 0.055, NV: 0.0685, NH: 0, NJ: 0.06625,
  NM: 0.05125, NY: 0.04, NC: 0.0475, ND: 0.05, OH: 0.0575,
  OK: 0.045, OR: 0, PA: 0.06, RI: 0.07, SC: 0.06,
  SD: 0.042, TN: 0.07, TX: 0.0625, UT: 0.061, VT: 0.06,
  VA: 0.053, WA: 0.065, WV: 0.06, WI: 0.05, WY: 0.04,
  DC: 0.06,
};

// Zip code prefix → state mapping (first 3 digits)
const ZIP_TO_STATE: Record<string, string> = {
  // CT
  "060": "CT", "061": "CT", "062": "CT", "063": "CT", "064": "CT", "065": "CT", "066": "CT", "067": "CT", "068": "CT", "069": "CT",
  // NY
  "100": "NY", "101": "NY", "102": "NY", "103": "NY", "104": "NY", "105": "NY", "106": "NY", "107": "NY", "108": "NY", "109": "NY",
  "110": "NY", "111": "NY", "112": "NY", "113": "NY", "114": "NY", "115": "NY", "116": "NY", "117": "NY", "118": "NY", "119": "NY",
  "120": "NY", "121": "NY", "122": "NY", "123": "NY", "124": "NY", "125": "NY", "126": "NY", "127": "NY", "128": "NY", "129": "NY",
  "130": "NY", "131": "NY", "132": "NY", "133": "NY", "134": "NY", "135": "NY", "136": "NY", "137": "NY", "138": "NY", "139": "NY",
  "140": "NY", "141": "NY", "142": "NY", "143": "NY", "144": "NY", "145": "NY", "146": "NY", "147": "NY", "148": "NY", "149": "NY",
  // NJ
  "070": "NJ", "071": "NJ", "072": "NJ", "073": "NJ", "074": "NJ", "075": "NJ", "076": "NJ", "077": "NJ", "078": "NJ", "079": "NJ",
  "080": "NJ", "081": "NJ", "082": "NJ", "083": "NJ", "084": "NJ", "085": "NJ", "086": "NJ", "087": "NJ", "088": "NJ", "089": "NJ",
  // MA
  "010": "MA", "011": "MA", "012": "MA", "013": "MA", "014": "MA", "015": "MA", "016": "MA", "017": "MA", "018": "MA", "019": "MA",
  "020": "MA", "021": "MA", "022": "MA", "023": "MA", "024": "MA", "025": "MA", "026": "MA", "027": "MA",
  // PA
  "150": "PA", "151": "PA", "152": "PA", "153": "PA", "154": "PA", "155": "PA", "156": "PA", "157": "PA", "158": "PA", "159": "PA",
  "160": "PA", "161": "PA", "162": "PA", "163": "PA", "164": "PA", "165": "PA", "166": "PA", "167": "PA", "168": "PA", "169": "PA",
  "170": "PA", "171": "PA", "172": "PA", "173": "PA", "174": "PA", "175": "PA", "176": "PA", "177": "PA", "178": "PA", "179": "PA",
  "180": "PA", "181": "PA", "182": "PA", "183": "PA", "184": "PA", "185": "PA", "186": "PA", "187": "PA", "188": "PA", "189": "PA",
  "190": "PA", "191": "PA", "192": "PA", "193": "PA", "194": "PA", "195": "PA", "196": "PA",
  // RI
  "028": "RI", "029": "RI",
  // ME
  "039": "ME", "040": "ME", "041": "ME", "042": "ME", "043": "ME", "044": "ME", "045": "ME", "046": "ME", "047": "ME", "048": "ME", "049": "ME",
  // NH
  "030": "NH", "031": "NH", "032": "NH", "033": "NH", "034": "NH", "035": "NH", "036": "NH", "037": "NH", "038": "NH",
  // VT
  "050": "VT", "051": "VT", "052": "VT", "053": "VT", "054": "VT", "056": "VT", "057": "VT", "058": "VT", "059": "VT",
  // MD
  "206": "MD", "207": "MD", "208": "MD", "209": "MD", "210": "MD", "211": "MD", "212": "MD", "214": "MD", "215": "MD", "216": "MD", "217": "MD", "218": "MD", "219": "MD",
  // DE
  "197": "DE", "198": "DE", "199": "DE",
  // VA
  "220": "VA", "221": "VA", "222": "VA", "223": "VA", "224": "VA", "225": "VA", "226": "VA", "227": "VA", "228": "VA", "229": "VA",
  "230": "VA", "231": "VA", "232": "VA", "233": "VA", "234": "VA", "235": "VA", "236": "VA", "237": "VA", "238": "VA", "239": "VA",
  "240": "VA", "241": "VA", "242": "VA", "243": "VA", "244": "VA", "245": "VA", "246": "VA",
  // DC
  "200": "DC", "202": "DC", "203": "DC", "204": "DC", "205": "DC",
  // FL
  "320": "FL", "321": "FL", "322": "FL", "323": "FL", "324": "FL", "325": "FL", "326": "FL", "327": "FL", "328": "FL", "329": "FL",
  "330": "FL", "331": "FL", "332": "FL", "333": "FL", "334": "FL", "335": "FL", "336": "FL", "337": "FL", "338": "FL", "339": "FL",
  "340": "FL", "341": "FL", "342": "FL", "344": "FL", "346": "FL", "347": "FL", "349": "FL",
  // GA
  "300": "GA", "301": "GA", "302": "GA", "303": "GA", "304": "GA", "305": "GA", "306": "GA", "307": "GA", "308": "GA", "309": "GA",
  "310": "GA", "311": "GA", "312": "GA", "313": "GA", "314": "GA", "315": "GA", "316": "GA", "317": "GA", "318": "GA", "319": "GA",
  // TX
  "750": "TX", "751": "TX", "752": "TX", "753": "TX", "754": "TX", "755": "TX", "756": "TX", "757": "TX", "758": "TX", "759": "TX",
  "760": "TX", "761": "TX", "762": "TX", "763": "TX", "764": "TX", "765": "TX", "766": "TX", "767": "TX", "768": "TX", "769": "TX",
  "770": "TX", "771": "TX", "772": "TX", "773": "TX", "774": "TX", "775": "TX", "776": "TX", "777": "TX", "778": "TX", "779": "TX",
  "780": "TX", "781": "TX", "782": "TX", "783": "TX", "784": "TX", "785": "TX", "786": "TX", "787": "TX", "788": "TX", "789": "TX",
  "790": "TX", "791": "TX", "792": "TX", "793": "TX", "794": "TX", "795": "TX", "796": "TX", "797": "TX", "798": "TX", "799": "TX",
  // CA
  "900": "CA", "901": "CA", "902": "CA", "903": "CA", "904": "CA", "905": "CA", "906": "CA", "907": "CA", "908": "CA", "909": "CA",
  "910": "CA", "911": "CA", "912": "CA", "913": "CA", "914": "CA", "915": "CA", "916": "CA", "917": "CA", "918": "CA", "919": "CA",
  "920": "CA", "921": "CA", "922": "CA", "923": "CA", "924": "CA", "925": "CA", "926": "CA", "927": "CA", "928": "CA",
  "930": "CA", "931": "CA", "932": "CA", "933": "CA", "934": "CA", "935": "CA", "936": "CA", "937": "CA", "938": "CA", "939": "CA",
  "940": "CA", "941": "CA", "942": "CA", "943": "CA", "944": "CA", "945": "CA", "946": "CA", "947": "CA", "948": "CA", "949": "CA",
  "950": "CA", "951": "CA", "952": "CA", "953": "CA", "954": "CA", "955": "CA", "956": "CA", "957": "CA", "958": "CA", "959": "CA",
  "960": "CA", "961": "CA",
  // IL
  "600": "IL", "601": "IL", "602": "IL", "603": "IL", "604": "IL", "605": "IL", "606": "IL", "607": "IL", "608": "IL", "609": "IL",
  "610": "IL", "611": "IL", "612": "IL", "613": "IL", "614": "IL", "615": "IL", "616": "IL", "617": "IL", "618": "IL", "619": "IL",
  "620": "IL", "621": "IL", "622": "IL", "623": "IL", "624": "IL", "625": "IL", "626": "IL", "627": "IL", "628": "IL", "629": "IL",
  // OH
  "430": "OH", "431": "OH", "432": "OH", "433": "OH", "434": "OH", "435": "OH", "436": "OH", "437": "OH", "438": "OH", "439": "OH",
  "440": "OH", "441": "OH", "442": "OH", "443": "OH", "444": "OH", "445": "OH", "446": "OH", "447": "OH", "448": "OH", "449": "OH",
  "450": "OH", "451": "OH", "452": "OH", "453": "OH", "454": "OH", "455": "OH", "456": "OH", "457": "OH", "458": "OH", "459": "OH",
  // MI
  "480": "MI", "481": "MI", "482": "MI", "483": "MI", "484": "MI", "485": "MI", "486": "MI", "487": "MI", "488": "MI", "489": "MI",
  "490": "MI", "491": "MI", "492": "MI", "493": "MI", "494": "MI", "495": "MI", "496": "MI", "497": "MI", "498": "MI", "499": "MI",
};

export function getStateFromZip(zip: string): string | null {
  if (!zip || zip.length < 3) return null;
  const prefix = zip.substring(0, 3);
  return ZIP_TO_STATE[prefix] || null;
}

export function getStateTaxRate(stateCode: string): number {
  return STATE_TAX_RATES[stateCode] ?? 0;
}

export function getTaxRateFromZip(zip: string): { state: string | null; rate: number } {
  const state = getStateFromZip(zip);
  if (!state) return { state: null, rate: 0 };
  return { state, rate: getStateTaxRate(state) };
}

export function calcTradeInValue(cashOffer: number, taxRate: number): number {
  return cashOffer * (1 + taxRate);
}

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};
