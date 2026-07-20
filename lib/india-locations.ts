// India states/UTs → notable cities, each with a representative (GPO/head-office)
// pincode. Pincodes are a sensible DEFAULT only — a city spans many pincodes, so
// the branch form keeps the field editable after auto-fill.
//
// Used by the branch create/edit forms for cascading State → City dropdowns and
// pincode auto-detect. Offline data — no external API call.

export type CityEntry = { name: string; pincode: string };
export type StateEntry = { state: string; cities: CityEntry[] };

export const INDIA_LOCATIONS: StateEntry[] = [
  {
    state: "Andhra Pradesh",
    cities: [
      { name: "Visakhapatnam", pincode: "530001" },
      { name: "Vijayawada", pincode: "520001" },
      { name: "Guntur", pincode: "522001" },
      { name: "Nellore", pincode: "524001" },
      { name: "Tirupati", pincode: "517501" },
      { name: "Kurnool", pincode: "518001" },
      { name: "Rajahmundry", pincode: "533101" },
      { name: "Kakinada", pincode: "533001" },
    ],
  },
  {
    state: "Arunachal Pradesh",
    cities: [
      { name: "Itanagar", pincode: "791111" },
      { name: "Naharlagun", pincode: "791110" },
      { name: "Pasighat", pincode: "791102" },
    ],
  },
  {
    state: "Assam",
    cities: [
      { name: "Guwahati", pincode: "781001" },
      { name: "Silchar", pincode: "788001" },
      { name: "Dibrugarh", pincode: "786001" },
      { name: "Jorhat", pincode: "785001" },
      { name: "Nagaon", pincode: "782001" },
      { name: "Tinsukia", pincode: "786125" },
    ],
  },
  {
    state: "Bihar",
    cities: [
      { name: "Patna", pincode: "800001" },
      { name: "Gaya", pincode: "823001" },
      { name: "Bhagalpur", pincode: "812001" },
      { name: "Muzaffarpur", pincode: "842001" },
      { name: "Darbhanga", pincode: "846004" },
      { name: "Purnia", pincode: "854301" },
    ],
  },
  {
    state: "Chhattisgarh",
    cities: [
      { name: "Raipur", pincode: "492001" },
      { name: "Bhilai", pincode: "490001" },
      { name: "Bilaspur", pincode: "495001" },
      { name: "Korba", pincode: "495677" },
      { name: "Durg", pincode: "491001" },
    ],
  },
  {
    state: "Goa",
    cities: [
      { name: "Panaji", pincode: "403001" },
      { name: "Margao", pincode: "403601" },
      { name: "Vasco da Gama", pincode: "403802" },
      { name: "Mapusa", pincode: "403507" },
    ],
  },
  {
    state: "Gujarat",
    cities: [
      { name: "Ahmedabad", pincode: "380001" },
      { name: "Surat", pincode: "395001" },
      { name: "Vadodara", pincode: "390001" },
      { name: "Rajkot", pincode: "360001" },
      { name: "Bhavnagar", pincode: "364001" },
      { name: "Jamnagar", pincode: "361001" },
      { name: "Gandhinagar", pincode: "382010" },
      { name: "Junagadh", pincode: "362001" },
    ],
  },
  {
    state: "Haryana",
    cities: [
      { name: "Faridabad", pincode: "121001" },
      { name: "Gurugram", pincode: "122001" },
      { name: "Panipat", pincode: "132103" },
      { name: "Ambala", pincode: "134003" },
      { name: "Hisar", pincode: "125001" },
      { name: "Karnal", pincode: "132001" },
      { name: "Rohtak", pincode: "124001" },
    ],
  },
  {
    state: "Himachal Pradesh",
    cities: [
      { name: "Shimla", pincode: "171001" },
      { name: "Mandi", pincode: "175001" },
      { name: "Solan", pincode: "173212" },
      { name: "Dharamshala", pincode: "176215" },
      { name: "Kullu", pincode: "175101" },
    ],
  },
  {
    state: "Jharkhand",
    cities: [
      { name: "Ranchi", pincode: "834001" },
      { name: "Jamshedpur", pincode: "831001" },
      { name: "Dhanbad", pincode: "826001" },
      { name: "Bokaro Steel City", pincode: "827001" },
      { name: "Hazaribagh", pincode: "825301" },
    ],
  },
  {
    state: "Karnataka",
    cities: [
      { name: "Bengaluru", pincode: "560001" },
      { name: "Mysuru", pincode: "570001" },
      { name: "Hubballi", pincode: "580020" },
      { name: "Mangaluru", pincode: "575001" },
      { name: "Belagavi", pincode: "590001" },
      { name: "Kalaburagi", pincode: "585101" },
      { name: "Davanagere", pincode: "577001" },
      { name: "Shivamogga", pincode: "577201" },
    ],
  },
  {
    state: "Kerala",
    cities: [
      { name: "Thiruvananthapuram", pincode: "695001" },
      { name: "Kochi", pincode: "682001" },
      { name: "Kozhikode", pincode: "673001" },
      { name: "Thrissur", pincode: "680001" },
      { name: "Kollam", pincode: "691001" },
      { name: "Kannur", pincode: "670001" },
      { name: "Kottayam", pincode: "686001" },
    ],
  },
  {
    state: "Madhya Pradesh",
    cities: [
      { name: "Bhopal", pincode: "462001" },
      { name: "Indore", pincode: "452001" },
      { name: "Jabalpur", pincode: "482001" },
      { name: "Gwalior", pincode: "474001" },
      { name: "Ujjain", pincode: "456001" },
      { name: "Sagar", pincode: "470001" },
      { name: "Ratlam", pincode: "457001" },
    ],
  },
  {
    state: "Maharashtra",
    cities: [
      { name: "Mumbai", pincode: "400001" },
      { name: "Pune", pincode: "411001" },
      { name: "Nagpur", pincode: "440001" },
      { name: "Thane", pincode: "400601" },
      { name: "Nashik", pincode: "422001" },
      { name: "Aurangabad", pincode: "431001" },
      { name: "Solapur", pincode: "413001" },
      { name: "Navi Mumbai", pincode: "400703" },
      { name: "Kolhapur", pincode: "416001" },
      { name: "Amravati", pincode: "444601" },
      { name: "Nanded", pincode: "431601" },
    ],
  },
  {
    state: "Manipur",
    cities: [
      { name: "Imphal", pincode: "795001" },
      { name: "Thoubal", pincode: "795138" },
    ],
  },
  {
    state: "Meghalaya",
    cities: [
      { name: "Shillong", pincode: "793001" },
      { name: "Tura", pincode: "794001" },
    ],
  },
  {
    state: "Mizoram",
    cities: [
      { name: "Aizawl", pincode: "796001" },
      { name: "Lunglei", pincode: "796701" },
    ],
  },
  {
    state: "Nagaland",
    cities: [
      { name: "Kohima", pincode: "797001" },
      { name: "Dimapur", pincode: "797112" },
    ],
  },
  {
    state: "Odisha",
    cities: [
      { name: "Bhubaneswar", pincode: "751001" },
      { name: "Cuttack", pincode: "753001" },
      { name: "Rourkela", pincode: "769001" },
      { name: "Berhampur", pincode: "760001" },
      { name: "Sambalpur", pincode: "768001" },
    ],
  },
  {
    state: "Punjab",
    cities: [
      { name: "Ludhiana", pincode: "141001" },
      { name: "Amritsar", pincode: "143001" },
      { name: "Jalandhar", pincode: "144001" },
      { name: "Patiala", pincode: "147001" },
      { name: "Bathinda", pincode: "151001" },
      { name: "Mohali", pincode: "160055" },
    ],
  },
  {
    state: "Rajasthan",
    cities: [
      { name: "Jaipur", pincode: "302001" },
      { name: "Jodhpur", pincode: "342001" },
      { name: "Udaipur", pincode: "313001" },
      { name: "Kota", pincode: "324001" },
      { name: "Bikaner", pincode: "334001" },
      { name: "Ajmer", pincode: "305001" },
      { name: "Alwar", pincode: "301001" },
    ],
  },
  {
    state: "Sikkim",
    cities: [
      { name: "Gangtok", pincode: "737101" },
      { name: "Namchi", pincode: "737126" },
    ],
  },
  {
    state: "Tamil Nadu",
    cities: [
      { name: "Chennai", pincode: "600001" },
      { name: "Coimbatore", pincode: "641001" },
      { name: "Madurai", pincode: "625001" },
      { name: "Tiruchirappalli", pincode: "620001" },
      { name: "Salem", pincode: "636001" },
      { name: "Tirunelveli", pincode: "627001" },
      { name: "Erode", pincode: "638001" },
      { name: "Vellore", pincode: "632001" },
    ],
  },
  {
    state: "Telangana",
    cities: [
      { name: "Hyderabad", pincode: "500001" },
      { name: "Warangal", pincode: "506001" },
      { name: "Nizamabad", pincode: "503001" },
      { name: "Karimnagar", pincode: "505001" },
      { name: "Khammam", pincode: "507001" },
    ],
  },
  {
    state: "Tripura",
    cities: [
      { name: "Agartala", pincode: "799001" },
      { name: "Udaipur", pincode: "799120" },
    ],
  },
  {
    state: "Uttar Pradesh",
    cities: [
      { name: "Lucknow", pincode: "226001" },
      { name: "Kanpur", pincode: "208001" },
      { name: "Ghaziabad", pincode: "201001" },
      { name: "Agra", pincode: "282001" },
      { name: "Varanasi", pincode: "221001" },
      { name: "Meerut", pincode: "250001" },
      { name: "Prayagraj", pincode: "211001" },
      { name: "Noida", pincode: "201301" },
      { name: "Bareilly", pincode: "243001" },
      { name: "Gorakhpur", pincode: "273001" },
    ],
  },
  {
    state: "Uttarakhand",
    cities: [
      { name: "Dehradun", pincode: "248001" },
      { name: "Haridwar", pincode: "249401" },
      { name: "Roorkee", pincode: "247667" },
      { name: "Haldwani", pincode: "263139" },
      { name: "Rishikesh", pincode: "249201" },
    ],
  },
  {
    state: "West Bengal",
    cities: [
      { name: "Kolkata", pincode: "700001" },
      { name: "Howrah", pincode: "711101" },
      { name: "Durgapur", pincode: "713201" },
      { name: "Asansol", pincode: "713301" },
      { name: "Siliguri", pincode: "734001" },
      { name: "Darjeeling", pincode: "734101" },
    ],
  },
  // ── Union Territories ──────────────────────────────────────────────────────
  {
    state: "Andaman & Nicobar Islands",
    cities: [{ name: "Port Blair", pincode: "744101" }],
  },
  {
    state: "Chandigarh",
    cities: [{ name: "Chandigarh", pincode: "160017" }],
  },
  {
    state: "Dadra & Nagar Haveli and Daman & Diu",
    cities: [
      { name: "Daman", pincode: "396210" },
      { name: "Silvassa", pincode: "396230" },
    ],
  },
  {
    state: "Delhi",
    cities: [
      { name: "New Delhi", pincode: "110001" },
      { name: "Delhi", pincode: "110006" },
      { name: "Dwarka", pincode: "110075" },
      { name: "Rohini", pincode: "110085" },
    ],
  },
  {
    state: "Jammu & Kashmir",
    cities: [
      { name: "Srinagar", pincode: "190001" },
      { name: "Jammu", pincode: "180001" },
      { name: "Anantnag", pincode: "192101" },
    ],
  },
  {
    state: "Ladakh",
    cities: [
      { name: "Leh", pincode: "194101" },
      { name: "Kargil", pincode: "194103" },
    ],
  },
  {
    state: "Lakshadweep",
    cities: [{ name: "Kavaratti", pincode: "682555" }],
  },
  {
    state: "Puducherry",
    cities: [
      { name: "Puducherry", pincode: "605001" },
      { name: "Karaikal", pincode: "609602" },
    ],
  },
];

/** All state/UT names, alphabetical — for the state dropdown. */
export const INDIA_STATES: string[] = INDIA_LOCATIONS.map((s) => s.state);

/** Cities for a given state, or [] if the state is unknown. */
export function citiesForState(state: string): CityEntry[] {
  return INDIA_LOCATIONS.find((s) => s.state === state)?.cities ?? [];
}

/** Representative pincode for a city within a state, or "" if not found. */
export function pincodeForCity(state: string, city: string): string {
  return citiesForState(state).find((c) => c.name === city)?.pincode ?? "";
}
