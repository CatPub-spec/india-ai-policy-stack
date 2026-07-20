export type InstitutionType = "government" | "private" | "academic" | "ecosystem" | "multilateral";

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  government: "Government & public",
  private: "Private companies",
  academic: "Academic & research",
  ecosystem: "Ecosystem & nonprofit",
  multilateral: "Multilateral development",
};

const GOVERNMENT_AND_PUBLIC = new Set([
  "Agriculture and Allied Departments, Government of Andhra Pradesh",
  "Ahmedabad Municipal School Board",
  "Andhra Pradesh Innovation Society (APIS)",
  "Andhra Pradesh Industrial Infrastructure Corporation (APIIC)",
  "Andhra Pradesh Non-Resident Telugu Society (APNRTS)",
  "Andhra Pradesh State Council of Higher Education (APSCHE)",
  "Bharat Petroleum Corporation Limited (BPCL)",
  "Delhi Metro Rail Corporation",
  "Delhi Police",
  "Department of Agriculture, Government of Maharashtra",
  "Department of Electronics and Information Technology, Government of Kerala",
  "Department of Electronics, Information Technology and Artificial Intelligence, Government of Maharashtra",
  "Department of Electronics, Information Technology, Biotechnology and Science & Technology, Government of Karnataka",
  "Department of Industries and Commerce, Government of Andhra Pradesh",
  "Department of Industries and Commerce, Government of Haryana",
  "Department of Industries, Government of Maharashtra",
  "Department of Information Technology and Electronics, Government of Uttar Pradesh",
  "Department of School Education, Government of Haryana",
  "Department of School Education, Government of Uttar Pradesh",
  "Department of Science and Technology, Government of Gujarat",
  "Department of Skill Development, Entrepreneurship and Livelihood, Government of Karnataka",
  "Department of Technical Education, Government of Karnataka",
  "Digital India BHASHINI Division",
  "Directorate of Forensic Science Laboratories, Government of Maharashtra",
  "Directorate of Training and Technical Education, Government of NCT of Delhi",
  "Dr. MCR Human Resource Development Institute of Telangana (MCRHRDI)",
  "Education Department, Government of NCT of Delhi",
  "Finance Department, Government of NCT of Delhi",
  "Government of Andhra Pradesh",
  "Government of Gujarat",
  "Government of Haryana",
  "Government of India",
  "Government of Karnataka",
  "Government of Kerala",
  "Government of Maharashtra",
  "Government of NCT of Delhi",
  "Government of Tamil Nadu",
  "Government of Telangana",
  "Government of Uttar Pradesh",
  "Gujarat Informatics Limited",
  "Gujarat International Finance Tec-City Company Limited (GIFT City)",
  "Gurugram Metropolitan Development Authority (GMDA)",
  "Gurugram Traffic Police",
  "HARTRON Advanced Skill Centre",
  "Haryana State Electronics Development Corporation (HARTRON)",
  "High Court of Kerala",
  "Indian National Space Promotion and Authorization Centre (IN-SPACe)",
  "Information Technology and Industries Department, Government of Telangana",
  "Information Technology, Electronics and Communications Department, Government of Andhra Pradesh",
  "Information Technology, Electronics and Communications Department, Government of Telangana",
  "Invest UP",
  "Karnataka State Electronics Development Corporation (KEONICS)",
  "Kerala Development and Innovation Strategic Council (K-DISC)",
  "Kerala Infrastructure and Technology for Education (KITE)",
  "Kerala Motor Vehicles Department",
  "Kerala State Goods and Services Tax Department",
  "Kerala Startup Mission",
  "Kerala State Council for Science, Technology and Environment (KSCSTE)",
  "Kerala State IT Mission",
  "Maharashtra Industrial Development Corporation (MIDC)",
  "Maharashtra Police",
  "Maharashtra State Road Transport Corporation",
  "Ministry of Education, Government of India",
  "Ministry of Electronics and Information Technology, Government of India",
  "Ministry of Health and Family Welfare, Government of India",
  "Ministry of Home Affairs, Government of India",
  "Ministry of Road Transport and Highways, Government of India",
  "Mumbai Metropolitan Region Development Authority (MMRDA)",
  "Municipal Corporation of Gurugram",
  "Municipal Corporation of Manesar",
  "National Informatics Centre (NIC)",
  "National Investment and Infrastructure Fund (NIIF)",
  "National Quantum Mission",
  "Planning Department, Government of NCT of Delhi",
  "Public Works Department, Government of Maharashtra",
  "Public Works Department, Government of NCT of Delhi",
  "Real Time Governance Society (RTGS)",
  "School Education Department, Government of Tamil Nadu",
  "StartinUP",
  "State Council of Educational Research and Training, Haryana (SCERT)",
  "State Industries Promotion Corporation of Tamil Nadu Limited (SIPCOT)",
  "Tamil Nadu Infrastructure Fund Management Corporation (TNIFMC)",
  "Tamil Nadu Startup and Innovation Mission (StartupTN)",
  "Tamil Nadu e-Governance Agency (TNeGA)",
  "Telangana Information Bureau",
  "U.P. Electronics Corporation Limited (UPLC)",
]);

const ACADEMIC_AND_RESEARCH = new Set([
  "Agriculture Intelligence and Analytics Innovation Centre",
  "All India Institute of Medical Sciences, New Delhi",
  "Centre for Research in Applied Artificial Intelligence",
  "Delhi Technological University",
  "Digital Science Park",
  "Guru Gobind Singh Indraprastha University (GGSIPU)",
  "IIM Ahmedabad",
  "IIT Delhi",
  "IIT Kanpur",
  "IIT Madras",
  "Indian AI Research Organisation (IAIRO)",
  "Indian Institute of Information Technology and Management-Kerala (IIITM-K)",
  "Indian Institute of Science (IISc)",
  "Indian Institute of Information Technology Dharwad (IIIT Dharwad)",
  "Indian Institute of Technology (BHU) Varanasi",
  "Institute of Bioinformatics and Applied Biotechnology",
  "KLE Technological University",
  "Kerala Genome Data Centre",
  "Netaji Subhas University of Technology (NSUT)",
  "Sri Venkateswara University",
  "SV Medical College",
  "The Alan Turing Institute",
  "Vasantdada Sugar Institute",
]);

const ECOSYSTEM_AND_NONPROFIT = new Set([
  "Karnataka Digital Economy Mission (KDEM)",
  "Maker Village",
  "NASSCOM",
  "T-Hub",
  "TANUH Foundation",
  "Wadhwani Impact Trust",
  "iTNT Hub",
]);

const MULTILATERAL_DEVELOPMENT = new Set([
  "International Finance Corporation (IFC)",
  "World Bank",
]);

export function institutionTypeFor(label: string): InstitutionType {
  if (MULTILATERAL_DEVELOPMENT.has(label)) return "multilateral";
  if (ECOSYSTEM_AND_NONPROFIT.has(label)) return "ecosystem";
  if (ACADEMIC_AND_RESEARCH.has(label)) return "academic";
  if (GOVERNMENT_AND_PUBLIC.has(label)) return "government";

  const normalized = label.toLowerCase();
  if (/\b(world bank|international finance corporation|development bank)\b/.test(normalized)) return "multilateral";
  if (/\b(foundation|trust|industry association|chamber of commerce)\b/.test(normalized)) return "ecosystem";
  if (/\b(university|college|institute of|research organisation|research organization|research centre|research center)\b/.test(normalized)) return "academic";
  if (/\b(government|department|ministry|municipal|police|authority|directorate|public works|state council|e-governance agency)\b/.test(normalized)) return "government";
  return "private";
}
