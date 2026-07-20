/**
 * Canonical institution extraction for the dashboard's Major Players field.
 *
 * The source Organization column often stores a display label containing several
 * parties. This helper deliberately splits only the spaced separators used by
 * that column; ampersands and commas remain part of legal/institutional names.
 */

const STATE_GOVERNMENTS = {
  "Andhra Pradesh": "Government of Andhra Pradesh",
  Delhi: "Government of NCT of Delhi",
  Gujarat: "Government of Gujarat",
  Haryana: "Government of Haryana",
  Karnataka: "Government of Karnataka",
  Kerala: "Government of Kerala",
  Maharashtra: "Government of Maharashtra",
  "Tamil Nadu": "Government of Tamil Nadu",
  Telangana: "Government of Telangana",
  "Uttar Pradesh": "Government of Uttar Pradesh",
};

const GOVERNMENT_ALIASES = new Map([
  ["delhi government", "Government of NCT of Delhi"],
  ["government of nct of delhi", "Government of NCT of Delhi"],
  ["government of india", "Government of India"],
  ["government of gujarat", "Government of Gujarat"],
  ["government of haryana", "Government of Haryana"],
  ["haryana government", "Government of Haryana"],
  ["government of karnataka", "Government of Karnataka"],
  ["karnataka government", "Government of Karnataka"],
  ["karnataka cabinet", "Government of Karnataka"],
  ["government of kerala", "Government of Kerala"],
  ["government of maharashtra", "Government of Maharashtra"],
  ["maharashtra government", "Government of Maharashtra"],
  ["maharashtra cabinet", "Government of Maharashtra"],
  ["government of tamil nadu", "Government of Tamil Nadu"],
  ["government of telangana", "Government of Telangana"],
  ["telangana government", "Government of Telangana"],
  ["government of andhra pradesh", "Government of Andhra Pradesh"],
  ["government of uttar pradesh", "Government of Uttar Pradesh"],
]);

const EXACT_ALIASES = new Map([
  ["meity", "Ministry of Electronics and Information Technology, Government of India"],
  ["union education ministry", "Ministry of Education, Government of India"],
  ["ministry of education", "Ministry of Education, Government of India"],
  ["ministry of home affairs", "Ministry of Home Affairs, Government of India"],
  ["ministry of health and family welfare", "Ministry of Health and Family Welfare, Government of India"],
  ["national informatics centre", "National Informatics Centre (NIC)"],
  ["in-space", "Indian National Space Promotion and Authorization Centre (IN-SPACe)"],
  ["nsut", "Netaji Subhas University of Technology (NSUT)"],
  ["ggsipu", "Guru Gobind Singh Indraprastha University (GGSIPU)"],
  ["aiims delhi", "All India Institute of Medical Sciences, New Delhi"],
  ["aiims new delhi", "All India Institute of Medical Sciences, New Delhi"],
  ["iisc bengaluru", "Indian Institute of Science (IISc)"],
  ["iit-bhu", "Indian Institute of Technology (BHU) Varanasi"],
  ["nasscom", "NASSCOM"],
  ["kaynes", "Kaynes Technology"],
  ["bellatrix", "Bellatrix Aerospace"],
  ["ifc", "International Finance Corporation (IFC)"],
  ["niif", "National Investment and Infrastructure Fund (NIIF)"],
  ["bpcl", "Bharat Petroleum Corporation Limited (BPCL)"],
  ["hartron", "Haryana State Electronics Development Corporation (HARTRON)"],
  ["mmrda", "Mumbai Metropolitan Region Development Authority (MMRDA)"],
  ["midc", "Maharashtra Industrial Development Corporation (MIDC)"],
  ["gmda", "Gurugram Metropolitan Development Authority (GMDA)"],
  ["k-disc", "Kerala Development and Innovation Strategic Council (K-DISC)"],
  ["kscste", "Kerala State Council for Science, Technology and Environment (KSCSTE)"],
  ["apsche", "Andhra Pradesh State Council of Higher Education (APSCHE)"],
  ["mcrhrdi", "Dr. MCR Human Resource Development Institute of Telangana (MCRHRDI)"],
  ["tnifmc", "Tamil Nadu Infrastructure Fund Management Corporation (TNIFMC)"],
  ["u.p. electronics corporation limited", "U.P. Electronics Corporation Limited (UPLC)"],
  ["kerala infrastructure and technology for education", "Kerala Infrastructure and Technology for Education (KITE)"],
  ["tamil nadu e-governance agency", "Tamil Nadu e-Governance Agency (TNeGA)"],
  ["karnataka digital economy mission", "Karnataka Digital Economy Mission (KDEM)"],
  ["andhra pradesh non-resident telugu society", "Andhra Pradesh Non-Resident Telugu Society (APNRTS)"],
  ["andhra pradesh innovation society", "Andhra Pradesh Innovation Society (APIS)"],
  ["real time governance society, government of andhra pradesh", "Real Time Governance Society (RTGS)"],
  ["tata semiconductor manufacturing private limited", "Tata Semiconductor Manufacturing Private Limited (TSMPL)"],
  ["princeton digital group (pdg)", "Princeton Digital Group (PDG)"],
  ["t-hub", "T-Hub"],
  ["gift city", "Gujarat International Finance Tec-City Company Limited (GIFT City)"],
  ["startuptn", "Tamil Nadu Startup and Innovation Mission (StartupTN)"],
]);

const NON_INSTITUTIONS = new Set([
  "ai and deep tech mission",
  "aikam partners",
  "chandrika and ranjan tandon",
  "delhi next",
  "gcc investors",
  "gift city ecosystem",
  "global bidadi it and ai township",
  "gujarat semiconnect 2026 partners",
  "jal sanrakshit haryana",
  "madurai government schools",
  "marvel",
  "sunil wadhwani",
  "tgdex ecosystem",
  "up defence industrial corridor",
]);

const OVERRIDES = {
  "ai-008": { add: ["World Bank"] },
  "ai-009": { replace: ["Government of Haryana", "World Bank"] },
  "ai-010": { replace: ["Government of Karnataka"] },
  "ai-011": {
    add: ["Karnataka State Electronics Development Corporation (KEONICS)"],
  },
  "ai-035": { add: ["Ministry of Education, Government of India"] },
  "ai-038": { add: ["Haryana State Electronics Development Corporation (HARTRON)"] },
  "ai-042": { replace: ["Government of Karnataka"] },
  "ai-046": { add: ["TANUH Foundation"] },
  "ai-062": { replace: ["Maharashtra Police", "Government of Maharashtra"] },
  "ai-075": { replace: ["IIT Madras", "Wadhwani Impact Trust"] },
  "ai-076": { replace: ["Government of Gujarat"] },
  "ai-078": {
    replace: [
      "Government of Gujarat",
      "Gujarat International Finance Tec-City Company Limited (GIFT City)",
      "Indian AI Research Organisation (IAIRO)",
    ],
  },
  "ai-081": { replace: ["Government of Gujarat"] },
  "ai-084": { replace: ["Government of Telangana", "Aikam"] },
  "ai-089": { replace: ["Government of Telangana"] },
  "ai-094": {
    replace: ["School Education Department, Government of Tamil Nadu", "Government of Tamil Nadu"],
  },
  "ai-095": { replace: ["Government of NCT of Delhi"] },
  "ai-099": { add: ["Government of Haryana"] },
  "ai-103": { replace: ["IIM Ahmedabad"] },
  "ai-104": { add: ["Baring Private Equity Asia", "Z3Partners"] },
  "ai-109": { add: ["T-Hub"] },
  "ai-118": {
    replace: ["Sri Venkateswara University", "Andhra Pradesh State Council of Higher Education (APSCHE)"],
  },
  "ai-134": {
    replace: ["Invest UP", "IIT Kanpur", "Indian Institute of Technology (BHU) Varanasi"],
  },
  "ai-145": {
    replace: [
      "Government of Kerala",
      "Maker Village",
      "Ministry of Electronics and Information Technology, Government of India",
      "Indian Institute of Information Technology and Management-Kerala (IIITM-K)",
      "Kerala Startup Mission",
    ],
  },
  "ai-153": { add: ["Agriculture Intelligence and Analytics Innovation Centre"] },
  "ai-155": {
    replace: ["Government of Telangana", "Centre for Research in Applied Artificial Intelligence"],
  },
  "ai-173": { replace: ["Delhi Technological University"] },
};

export function deriveMajorPlayers(record) {
  const state = String(record.state || "").trim();
  const rawOrganization = String(record.organization || "").trim();
  const segments = rawOrganization.split(/\s+(?:\+|\/)\s+/).map((value) => value.trim()).filter(Boolean);
  let players = segments
    .filter((segment) => !NON_INSTITUTIONS.has(normalizeKey(segment)))
    .map((segment) => canonicalInstitution(segment, state))
    .filter(Boolean);

  const override = OVERRIDES[record.id];
  if (override?.replace) players = [...override.replace];
  if (override?.add) players.push(...override.add);

  if (explicitlyNamesStateGovernment(rawOrganization, state)) {
    const stateGovernment = STATE_GOVERNMENTS[state];
    if (stateGovernment) players.push(stateGovernment);
  }
  if (/\bgovernment of india\b/i.test(rawOrganization)) players.push("Government of India");

  players = dedupeInstitutions(players);
  if (!players.length && rawOrganization) players = [canonicalInstitution(rawOrganization, state) || rawOrganization];
  return players;
}

export function validateMajorPlayers(records) {
  const errors = [];
  const registry = new Map();
  records.forEach((record) => {
    const players = deriveMajorPlayers(record);
    if (!players.length) errors.push(`${record.id}: no institutions`);
    if (players.some((player) => /\s{2,}|^[\s;|]|[\s;|]$/.test(player))) {
      errors.push(`${record.id}: malformed institution label`);
    }
    if (new Set(players.map(normalizeKey)).size !== players.length) errors.push(`${record.id}: duplicate institutions`);
    players.forEach((player) => registry.set(player, (registry.get(player) || 0) + 1));
  });
  return { errors, registry };
}

function canonicalInstitution(value, state) {
  const clean = String(value || "").replace(/^[\s\u2022\-]+/, "").trim();
  const key = normalizeKey(clean);
  if (!clean || NON_INSTITUTIONS.has(key)) return "";
  if (GOVERNMENT_ALIASES.has(key)) return GOVERNMENT_ALIASES.get(key);
  if (EXACT_ALIASES.has(key)) return EXACT_ALIASES.get(key);

  const stateGovernment = STATE_GOVERNMENTS[state] || `Government of ${state}`;
  const contextAliases = {
    "education department": `Education Department, ${stateGovernment}`,
    pwd: `Public Works Department, ${stateGovernment}`,
    "public works department": `Public Works Department, ${stateGovernment}`,
    "industries & commerce department": `Department of Industries and Commerce, ${stateGovernment}`,
    "department of industries and commerce": `Department of Industries and Commerce, ${stateGovernment}`,
    "it-bt department": "Department of Electronics, Information Technology, Biotechnology and Science & Technology, Government of Karnataka",
    "department of it-bt": "Department of Electronics, Information Technology, Biotechnology and Science & Technology, Government of Karnataka",
    "department of skill development, entrepreneurship & livelihood": "Department of Skill Development, Entrepreneurship and Livelihood, Government of Karnataka",
    "department of technical education": `Department of Technical Education, ${stateGovernment}`,
    "department of electronics, it & ai": "Department of Electronics, Information Technology and Artificial Intelligence, Government of Maharashtra",
    "electronics, it and ai department, government of maharashtra": "Department of Electronics, Information Technology and Artificial Intelligence, Government of Maharashtra",
    "agriculture department": `Department of Agriculture, ${stateGovernment}`,
    "industries department": `Department of Industries, ${stateGovernment}`,
    "directorate of forensic science laboratories": `Directorate of Forensic Science Laboratories, ${stateGovernment}`,
    "school education": `Department of School Education, ${stateGovernment}`,
    "haryana education department": "Department of School Education, Government of Haryana",
    scert: "State Council of Educational Research and Training, Haryana (SCERT)",
    "agriculture & allied departments": "Agriculture and Allied Departments, Government of Andhra Pradesh",
    "ite&c department, government of andhra pradesh": "Information Technology, Electronics and Communications Department, Government of Andhra Pradesh",
    "ite&c department": `Information Technology, Electronics and Communications Department, ${stateGovernment}`,
    "department of it & electronics": "Department of Information Technology and Electronics, Government of Uttar Pradesh",
    "electronics & it department": "Department of Electronics and Information Technology, Government of Kerala",
    "tamil nadu school education department": "School Education Department, Government of Tamil Nadu",
    "directorate of training and technical education": "Directorate of Training and Technical Education, Government of NCT of Delhi",
    "finance department, government of nct of delhi": "Finance Department, Government of NCT of Delhi",
    "planning department, government of nct of delhi": "Planning Department, Government of NCT of Delhi",
    "department of science & technology": "Department of Science and Technology, Government of Gujarat",
    "department of science and technology": "Department of Science and Technology, Government of Gujarat",
    "department of science and technology, government of gujarat": "Department of Science and Technology, Government of Gujarat",
    "it & industries department": "Information Technology and Industries Department, Government of Telangana",
    "ite&c department, government of telangana": "Information Technology, Electronics and Communications Department, Government of Telangana",
  };
  return contextAliases[key] || clean;
}

function explicitlyNamesStateGovernment(value, state) {
  const normalized = normalizeKey(value);
  if (normalized.includes("cabinet")) return true;
  if (state === "Delhi") return normalized.includes("delhi government") || normalized.includes("government of nct of delhi");
  return normalized.includes(`government of ${normalizeKey(state)}`) || normalized.includes(`${normalizeKey(state)} government`);
}

function dedupeInstitutions(values) {
  const seen = new Set();
  return values.filter((value) => {
    const clean = String(value || "").trim();
    const key = normalizeKey(clean);
    if (!clean || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeKey(value) {
  return String(value || "")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
