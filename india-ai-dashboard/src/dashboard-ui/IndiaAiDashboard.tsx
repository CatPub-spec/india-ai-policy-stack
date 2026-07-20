"use client";

import { useChat } from "@ai-sdk/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowDownUp,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  FilterX,
  Layers3,
  Menu,
  MapPinned,
  Network as NetworkIcon,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Square,
} from "lucide-react";
import { DefaultChatTransport } from "ai";
import Image from "next/image";
import Link from "next/link";
import {
  Children,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import type { AnalystMessage } from "@/types/analyst";
import { slugify } from "../lib/slugs";
import {
  type ChartDatum,
  type CurrencyCode,
  type DashboardDataset,
  type InvestmentRecord,
  type MetricMode,
  convertedValueForMetric,
  formatCompact,
  formatMetricValue,
  metricLabel,
  uniqueSorted,
} from "../dashboard-data/investmentDataset";
import {
  INSTITUTION_TYPE_LABELS,
  institutionTypeFor,
  type InstitutionType,
} from "../dashboard-data/institutionTypes";

type FilterState = {
  states: string[];
  years: string[];
  industries: string[];
  capabilities: string[];
  disclosure: "chartable" | "narrative" | null;
  search: string;
};

type SortKey = "year" | "state" | "organization" | "industry" | "capability" | "amount";
type SortDirection = "asc" | "desc";
type StateComparisonScope = "filtered" | "all";
type IndustryComparisonScope = "filtered" | "all";
type TrendDimension = "state" | "industry" | "capability";
type ChartViewId = "state-comparison" | "industry-ranking" | "concentration-trend" | "investment-scatter" | "ecosystem-network";

type ConcentrationGroup = {
  name: string;
  share: number;
};

type ConcentrationPoint = {
  year: number;
  topOneShare: number;
  topThreeShare: number;
  leader: string;
  topGroups: ConcentrationGroup[];
  recordCount: number;
  includedRecordCount: number;
  categoryCount: number;
  effectiveCategories: number;
};

type ChartFocusSnapshot = {
  chartId: string;
  selectionKey: string;
  filters: FilterState;
  selectedState: string | null;
  stateComparisonScope: StateComparisonScope;
  industryComparisonScope: IndustryComparisonScope;
};

type HeatmapCell = {
  state: string;
  capability: string;
  value: number;
  records: InvestmentRecord[];
  intensity: number;
};

type StateSummary = {
  name: string;
  count: number;
  inr: number;
  usd: number;
  capabilities: string[];
  color: string;
  intensity: number;
  records: InvestmentRecord[];
};

type InsightAction =
  | { kind: "state"; value: string }
  | { kind: "capability"; value: string }
  | { kind: "industry"; value: string }
  | { kind: "year"; value: string }
  | { kind: "search"; value: string }
  | { kind: "chart"; value: string; scope?: "all" }
  | { kind: "ledger"; value?: string; scope?: "all" };

type EditorialInsight = {
  eyebrow: string;
  title: string;
  body: string;
  stat: string;
  statLabel: string;
  actionLabel: string;
  href: string;
  bars: ChartDatum[];
};

type AnalystResponse = {
  answer: string;
  evidence: string[];
  followUp?: string;
};

type ExplorerCard = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  detail: string;
  actionLabel: string;
  action: InsightAction;
  preview: "bars" | "network" | "timeline" | "records";
  previewData: ChartDatum[];
};

type AtlasTopicKind = "state" | "industry" | "capability" | "institution" | "year";

type HeroStateNode = {
  state: string;
  label: string;
  x: string;
  y: string;
  color: string;
  delay: string;
};

type NetworkNode = {
  id: string;
  label: string;
  clusterId: string;
  clusterLabel: string;
  institutionType: InstitutionType;
  x: number;
  y: number;
  radius: number;
  recordCount: number;
  recordIds: string[];
  states: string[];
};

type NetworkEdge = {
  id: string;
  source: NetworkNode;
  target: NetworkNode;
  weight: number;
  path: string;
  recordIds: string[];
  evidence: Array<{
    recordId: string;
    relationship: string;
    detail: string;
    sourceUrl: string;
  }>;
};

type NetworkCluster = {
  id: string;
  label: string;
  legendLabel: string;
  path: string;
  fill: string;
  stroke: string;
  recordCount: number;
  nodeCount: number;
};

type NetworkGraphModel = {
  clusters: NetworkCluster[];
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  recordCount: number;
  recordsById: Map<string, InvestmentRecord>;
};

const EMPTY_FILTERS: FilterState = {
  states: [],
  years: [],
  industries: [],
  capabilities: [],
  disclosure: null,
  search: "",
};

const CHART_VIEW_IDS: ChartViewId[] = ["state-comparison", "industry-ranking", "concentration-trend", "investment-scatter", "ecosystem-network"];

const CHART_VIEW_LABELS: Record<ChartViewId, string> = {
  "state-comparison": "State Comparison",
  "industry-ranking": "Industry Ranking",
  "concentration-trend": "Concentration Trajectory",
  "investment-scatter": "Investment Scale Scatter",
  "ecosystem-network": "Institution Network",
};

const CURRENCY_OPTIONS: Array<{ value: MetricMode; label: string }> = [
  { value: "inr", label: "INR" },
  { value: "usd", label: "USD" },
];

const DOMAIN_COLORS = ["#2f80ed", "#f2b84b", "#26a69a", "#ff7f6e"];
const SCATTER_POINT_COLOR = "#4f8cc9";
const CHART_GRID_COLOR = "rgba(0,0,0,0.1)";
const CHART_TEXT_COLOR = "rgba(0,0,0,0.55)";
const CHART_AXIS_COLOR = "rgba(0,0,0,0.86)";
const HERO_BASE_IMAGE =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260609_195923_b0ba8ace-1d1d-4f2c-9a28-1ab84b330680.png&w=1280&q=85";
const HERO_REVEAL_IMAGE =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260609_201152_bba90a12-bf12-459f-91f0-51f237dbaf3b.png&w=1280&q=85";
const KINETIC_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260306_074215_04640ca7-042c-45d6-bb56-58b1e8a42489.mp4";
const DASHBOARD_BACKGROUND_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260503_101827_abebfeec-f243-466b-b494-7f6814c0fbbf.mp4";
const SPOTLIGHT_R = 260;
const MOTION_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const NETWORK_WIDTH = 860;
const NETWORK_HEIGHT = 500;
const NETWORK_INSTITUTION_TYPES: Array<{
  id: InstitutionType;
  label: string;
  legendLabel: string;
  fill: string;
  stroke: string;
}> = [
  { id: "government", label: INSTITUTION_TYPE_LABELS.government, legendLabel: "Public", fill: "rgba(37, 99, 235, 0.20)", stroke: "rgba(29, 78, 216, 0.46)" },
  { id: "private", label: INSTITUTION_TYPE_LABELS.private, legendLabel: "Private", fill: "rgba(249, 115, 22, 0.20)", stroke: "rgba(194, 65, 12, 0.46)" },
  { id: "academic", label: INSTITUTION_TYPE_LABELS.academic, legendLabel: "Research", fill: "rgba(139, 92, 246, 0.19)", stroke: "rgba(109, 40, 217, 0.45)" },
  { id: "ecosystem", label: INSTITUTION_TYPE_LABELS.ecosystem, legendLabel: "Ecosystem", fill: "rgba(34, 197, 94, 0.20)", stroke: "rgba(21, 128, 61, 0.46)" },
  { id: "multilateral", label: INSTITUTION_TYPE_LABELS.multilateral, legendLabel: "Multilateral", fill: "rgba(6, 182, 212, 0.20)", stroke: "rgba(8, 145, 178, 0.46)" },
];

const HERO_NODE_POSITIONS = [
  { x: "48%", y: "30%" },
  { x: "28%", y: "55%" },
  { x: "45%", y: "31%" },
  { x: "42%", y: "78%" },
  { x: "41%", y: "66%" },
  { x: "52%", y: "91%" },
  { x: "53%", y: "68%" },
  { x: "60%", y: "58%" },
  { x: "66%", y: "44%" },
  { x: "38%", y: "48%" },
  { x: "58%", y: "36%" },
  { x: "47%", y: "84%" },
];

const HERO_NODES = [
  { x: 0.12, y: 0.28, label: "Public services", color: "#f59e0b" },
  { x: 0.3, y: 0.18, label: "Education", color: "#16a34a" },
  { x: 0.48, y: 0.42, label: "Healthcare", color: "#0ea5e9" },
  { x: 0.66, y: 0.23, label: "Startups", color: "#a855f7" },
  { x: 0.82, y: 0.38, label: "Infrastructure", color: "#22c55e" },
  { x: 0.72, y: 0.68, label: "Governance", color: "#f97316" },
  { x: 0.39, y: 0.72, label: "AI capacity", color: "#38bdf8" },
  { x: 0.18, y: 0.62, label: "Verified data", color: "#facc15" },
];

export function IndiaAiDashboard({ initialDataset }: { initialDataset: DashboardDataset }) {
  const [dataset, setDataset] = useState<DashboardDataset | null>(initialDataset);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [ledgerInstitution, setLedgerInstitution] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricMode>("inr");
  const [selectedState, setSelectedState] = useState<string | null>("Maharashtra");
  const [stateComparisonScope, setStateComparisonScope] = useState<StateComparisonScope>("filtered");
  const [industryComparisonScope, setIndustryComparisonScope] = useState<IndustryComparisonScope>("filtered");
  const [trendDimension, setTrendDimension] = useState<TrendDimension>("industry");
  const [activeChart, setActiveChart] = useState<ChartViewId>("state-comparison");
  const [expandedChart, setExpandedChart] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("year");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [hasMounted, setHasMounted] = useState(false);
  const chartFocusRef = useRef<ChartFocusSnapshot | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = hasMounted && Boolean(prefersReducedMotion);

  useRevealAnimations(Boolean(reduceMotion));

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    let isActive = true;
    fetch("/api/dashboard")
      .then((response) => {
        if (!response.ok) throw new Error(`Data request failed with ${response.status}`);
        return response.json() as Promise<DashboardDataset>;
      })
      .then((nextDataset) => {
        if (isActive) setDataset(nextDataset);
      })
      .catch(() => {
        if (isActive && !dataset) setDataset(null);
      });
    return () => {
      isActive = false;
    };
  }, []);

  const records = dataset?.records || [];
  const states = useMemo(() => uniqueSorted(records.map((record) => record.state)), [records]);
  const heroStateNodes = useMemo(() => buildHeroStateNodes(states), [states]);
  const years = useMemo(() => [...new Set(records.map((record) => String(record.year)))].sort(), [records]);
  const availableIndustries = useMemo(
    () => uniqueSorted(applyFilters(records, { ...filters, industries: [] }).map((record) => record.industry)),
    [filters, records],
  );
  const availableCapabilities = useMemo(
    () => uniqueSorted(applyFilters(records, { ...filters, capabilities: [] }).map((record) => record.capability)),
    [filters, records],
  );
  const filteredRecords = useMemo(() => applyFilters(records, filters), [records, filters]);
  const concentrationTrendRecords = useMemo(() => {
    const comparableFilters: FilterState = { ...filters, years: [] };
    if (trendDimension === "state") comparableFilters.states = [];
    if (trendDimension === "industry") comparableFilters.industries = [];
    if (trendDimension === "capability") comparableFilters.capabilities = [];
    return applyFilters(records, comparableFilters);
  }, [filters, records, trendDimension]);
  const hasStateFilter = filters.states.length > 0;
  const hasIndustryFilter = filters.industries.length > 0;
  const stateComparisonRecords = useMemo(
    () => applyFilters(records, stateComparisonScope === "all" ? { ...filters, states: [] } : filters),
    [filters, records, stateComparisonScope],
  );
  const industryComparisonRecords = useMemo(
    () => applyFilters(records, industryComparisonScope === "all" ? { ...filters, industries: [] } : filters),
    [filters, industryComparisonScope, records],
  );
  const summaries = useMemo(() => buildStateSummaries(filteredRecords), [filteredRecords]);
  const charts = useMemo(() => buildCharts(filteredRecords, metric), [filteredRecords, metric]);
  const stateComparison = useMemo(() => buildStateComparison(stateComparisonRecords, metric), [stateComparisonRecords, metric]);
  const industryComparison = useMemo(() => buildIndustryComparison(industryComparisonRecords, metric), [industryComparisonRecords, metric]);
  const concentrationTrend = useMemo(
    () => buildConcentrationTrend(concentrationTrendRecords, metric, trendDimension),
    [concentrationTrendRecords, metric, trendDimension],
  );
  const ecosystemNetwork = useMemo(() => buildEcosystemNetwork(filteredRecords), [filteredRecords]);
  const kpis = useMemo(() => buildKpis(filteredRecords, metric), [filteredRecords, metric]);
  const highlights = useMemo(() => buildHighlights(filteredRecords, metric), [filteredRecords, metric]);
  const editorialInsights = useMemo(() => buildEditorialInsights(records, metric), [records, metric]);
  const topicIndex = useMemo(() => buildTopicIndex(records), [records]);
  const explorerCards = useMemo(() => buildExplorerCards(records, topicIndex), [records, topicIndex]);
  const selectedRecords = useMemo(
    () => (selectedState ? filteredRecords.filter((record) => record.state === selectedState) : filteredRecords),
    [filteredRecords, selectedState],
  );
  const selectedSummary = useMemo(
    () => buildStateSummary(selectedState || "All States", selectedRecords),
    [selectedRecords, selectedState],
  );
  const ledgerRecords = useMemo(
    () => ledgerInstitution
      ? filteredRecords.filter((record) => record.majorPlayers.some((player) => normalizeText(player) === normalizeText(ledgerInstitution)))
      : filteredRecords,
    [filteredRecords, ledgerInstitution],
  );
  const sortedLedger = useMemo(
    () => sortRecords(ledgerRecords, sortKey, sortDirection),
    [ledgerRecords, sortDirection, sortKey],
  );
  const stateComparisonSubtitle = hasStateFilter
    ? `${metricLabel(metric)} commitments for applied state filters. Toggle the view to compare against all states.`
    : `${metricLabel(metric)} commitments across all active filters. Click a state to focus it.`;
  const industryComparisonSubtitle = hasIndustryFilter
    ? `${metricLabel(metric)} commitments for applied industry filters. Toggle the view to compare against all industries.`
    : `${metricLabel(metric)} commitments across all active filters. Click an industry to focus it.`;
  const stateChartKey = `state-${metric}-${selectedState || "all"}-${chartSignature(stateComparison.bars)}`;
  const industryChartKey = `industry-${metric}-${industryComparisonScope}-${filters.industries.join(",") || "all"}-${chartSignature(industryComparison.bars)}`;
  const isChartExpanded = (chartId: string) => expandedChart === chartId;

  useEffect(() => {
    if (!states.length) return;
    if (selectedState && !states.includes(selectedState)) setSelectedState(states[0]);
  }, [selectedState, states]);

  useEffect(() => {
    setFilters((current) => {
      const industriesInScope = current.industries.filter((industry) => availableIndustries.includes(industry));
      const capabilitiesInScope = current.capabilities.filter((capability) => availableCapabilities.includes(capability));
      if (industriesInScope.length === current.industries.length && capabilitiesInScope.length === current.capabilities.length) return current;
      return { ...current, industries: industriesInScope, capabilities: capabilitiesInScope };
    });
  }, [availableIndustries, availableCapabilities]);

  const clearChartFocus = () => {
    chartFocusRef.current = null;
  };

  const restoreChartFocus = (snapshot: ChartFocusSnapshot) => {
    chartFocusRef.current = null;
    setFilters(cloneFilters(snapshot.filters));
    setSelectedState(snapshot.selectedState);
    setStateComparisonScope(snapshot.stateComparisonScope);
    setIndustryComparisonScope(snapshot.industryComparisonScope);
  };

  const toggleChartFocus = (chartId: string, selectionKey: string, applyFocus: () => void) => {
    const activeFocus = chartFocusRef.current;
    if (activeFocus?.chartId === chartId && activeFocus.selectionKey === selectionKey) {
      restoreChartFocus(activeFocus);
      return;
    }

    chartFocusRef.current = activeFocus
      ? { ...activeFocus, chartId, selectionKey }
      : {
          chartId,
          selectionKey,
          filters: cloneFilters(filters),
          selectedState,
          stateComparisonScope,
          industryComparisonScope,
        };
    applyFocus();
  };

  const toggleFilter = (key: keyof Pick<FilterState, "states" | "years" | "industries" | "capabilities">, value: string) => {
    clearChartFocus();
    if (key === "states") setStateComparisonScope("filtered");
    if (key === "industries") setIndustryComparisonScope("filtered");
    setFilters((current) => {
      const selected = current[key];
      return {
        ...current,
        [key]: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
      };
    });
  };

  const clearFilter = (key: keyof Pick<FilterState, "states" | "years" | "industries" | "capabilities">) => {
    clearChartFocus();
    if (key === "states") setStateComparisonScope("filtered");
    if (key === "industries") setIndustryComparisonScope("filtered");
    setFilters((current) => ({ ...current, [key]: [] }));
  };

  const focusState = (state: string) => {
    toggleChartFocus("state-comparison", state, () => {
      setStateComparisonScope("filtered");
      setSelectedState(state);
      setFilters((current) => ({ ...current, states: [state] }));
    });
  };

  const togglePortfolioState = (state: string) => {
    clearChartFocus();
    if (selectedState === state && filters.states.length === 1 && filters.states[0] === state) {
      setSelectedState(null);
      setFilters((current) => ({ ...current, states: [] }));
      return;
    }
    setStateComparisonScope("filtered");
    setSelectedState(state);
    setFilters((current) => ({ ...current, states: [state] }));
  };

  const focusCapability = (capability: string) => {
    toggleChartFocus("capability-ranking", capability, () => {
      setFilters((current) => ({ ...current, capabilities: [capability] }));
    });
  };

  const focusIndustryFilter = (industry: string) => {
    toggleChartFocus("industry-ranking", industry, () => {
      setIndustryComparisonScope("filtered");
      setFilters((current) => ({ ...current, industries: [industry] }));
    });
  };

  const focusYearFilter = (year: string) => {
    clearChartFocus();
    setFilters((current) => ({ ...current, years: [year] }));
  };

  const toggleConcentrationYear = (year: number) => {
    clearChartFocus();
    setFilters((current) => ({
      ...current,
      years: current.years.length === 1 && current.years[0] === String(year) ? [] : [String(year)],
    }));
  };

  const focusConcentrationLeader = (name: string) => {
    if (trendDimension === "state") focusState(name);
    if (trendDimension === "industry") focusIndustryFilter(name);
    if (trendDimension === "capability") focusCapability(name);
  };

  const focusSearchFilter = (search: string) => {
    clearChartFocus();
    setFilters((current) => ({ ...current, search }));
  };

  const openChart = (chartId: string) => {
    const nextChart = CHART_VIEW_IDS.includes(chartId as ChartViewId) ? (chartId as ChartViewId) : "state-comparison";
    clearChartFocus();
    focusElementAfterUpdate(() => {
      setActiveChart(nextChart);
      setExpandedChart(nextChart);
    }, "#charts");
  };

  const openInstitutionLedger = (institution: string) => {
    clearChartFocus();
    focusElementAfterUpdate(() => setLedgerInstitution(institution), "#evidence");
  };

  const resetDashboardScope = () => {
    clearChartFocus();
    setFilters(EMPTY_FILTERS);
    setSelectedState(null);
    setStateComparisonScope("all");
    setIndustryComparisonScope("all");
    setLedgerInstitution(null);
  };

  const applyInsightAction = (action: InsightAction) => {
    if (action.kind === "state") focusState(action.value);
    if (action.kind === "capability") focusCapability(action.value);
    if (action.kind === "industry") focusIndustryFilter(action.value);
    if (action.kind === "year") focusYearFilter(action.value);
    if (action.kind === "search") focusSearchFilter(action.value);
    if (action.kind === "chart") {
      if (action.scope === "all") resetDashboardScope();
      openChart(action.value);
    }
    if (action.kind === "ledger") {
      if (action.scope === "all") resetDashboardScope();
      if (action.value) openInstitutionLedger(action.value);
      else focusElementAfterUpdate(() => setLedgerInstitution(null), "#evidence");
    }
  };

  const focusScatterRecord = (datum: ScatterDatum) => {
    preserveScrollPosition(() => {
      toggleChartFocus("investment-scatter", datum.id, () => {
        setStateComparisonScope("filtered");
        setSelectedState(datum.state);
        setFilters((current) => ({ ...current, search: datum.organization, states: [datum.state], capabilities: [datum.capability] }));
      });
    }, ".investment-scatter-frame");
  };

  const focusHeatmapCell = (state: string, capability: string) => {
    focusElementAfterUpdate(() => {
      toggleChartFocus("heatmap", `${state}::${capability}`, () => {
        setStateComparisonScope("filtered");
        setSelectedState(state);
        setFilters((current) => ({ ...current, states: [state], capabilities: [capability] }));
      });
    }, ".heatmap-scroll");
  };

  const changeSort = (nextKey: SortKey) => {
    setSortKey((currentKey) => {
      if (currentKey === nextKey) {
        setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
        return currentKey;
      }
      setSortDirection(nextKey === "year" || nextKey === "amount" ? "desc" : "asc");
      return nextKey;
    });
  };

  if (!dataset) {
    return (
      <main className="loading-screen">
        <Sparkles aria-hidden="true" />
        <h1>Preparing intelligence dashboard</h1>
      </main>
    );
  }

  return (
    <main className="dashboard-page neural-page">
      <motion.nav
        className="neural-nav"
        aria-label="Primary navigation"
        initial={reduceMotion ? false : { opacity: 0, y: -16 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: MOTION_EASE }}
      >
        <div className="neural-nav-left">
          <a className="neural-logo" href="#hero-title" aria-label="TSR Lab home">
            <Image src="/tsr-logo.png" alt="TSR Lab" width={184} height={60} priority />
          </a>
          <a className="neural-menu-pill" href="#filters" aria-label="Jump to dashboard filters">
            <span>
              <Menu size={14} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <b>Filters</b>
          </a>
          <div className="neural-tags-pill" aria-label="Dashboard focus areas">
            <a href="#charts">AI Stack</a>
            <a href="#states">State Portfolio</a>
          </div>
        </div>
        <a className="neural-system-pill" href="#charts" aria-label="Jump to comparison charts">
          <span aria-hidden="true" className="neural-grid-icon">
            <svg viewBox="0 0 16 16" focusable="false">
              <circle cx="5" cy="5" r="1.6" />
              <circle cx="11" cy="5" r="1.6" />
              <circle cx="5" cy="11" r="1.6" />
              <circle cx="11" cy="11" r="1.6" />
            </svg>
          </span>
          <b>Compare Views</b>
        </a>
      </motion.nav>

      <section className="hero-section" aria-labelledby="hero-title">
        <motion.div
          className="hero-footer"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1, ease: MOTION_EASE }}
        >
          <motion.div
            className="kinetic-video-stage"
            initial={reduceMotion ? false : { opacity: 0, scale: 1.05 }}
            animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
            transition={{ duration: 1.8, ease: MOTION_EASE }}
            aria-hidden="true"
          >
            <video
              ref={videoRef}
              src={KINETIC_VIDEO_URL}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
          </motion.div>
          <div className="hero-footer-left">
            <motion.p
              className="hero-subtitle"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8, ease: MOTION_EASE }}
            >
              <span aria-hidden="true" />
              Track India&apos;s AI policy momentum
            </motion.p>
            <motion.h1
              id="hero-title"
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8, ease: MOTION_EASE }}
            >
              India AI Policy
              <br />
              Stack
            </motion.h1>
            <motion.div
              className="hero-action-row"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.8, ease: MOTION_EASE }}
            >
              <a className="hero-primary-button" href="#charts">
                Explore Charts
              </a>
              <a className="hero-secondary-button" href="#evidence">
                View Sources
              </a>
            </motion.div>
          </div>
          <div className="hero-footer-tags" aria-label="Dashboard tags">
            <span>10-state coverage</span>
            <span>State comparison</span>
            <span>Institution network</span>
          </div>
        </motion.div>
      </section>

      <section className="dashboard-lower-stage">
        <div id="explore" className="dashboard-body">
          <div className="dashboard-main">
            <DataInsights insights={editorialInsights} />

            <AskTheAnalyst allRecords={records} metric={metric} onAction={applyInsightAction} />

            <aside id="filters" className="filter-shell" aria-label="Dashboard filters">
              <label className="search-field">
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  value={filters.search}
                  placeholder="Search organization, initiative, industry, capability, location"
                  onChange={(event) => {
                    const search = event.target.value;
                    clearChartFocus();
                    setFilters({ ...EMPTY_FILTERS, search });
                    setSelectedState(null);
                    setStateComparisonScope("filtered");
                    setIndustryComparisonScope("filtered");
                  }}
                />
              </label>
              <div className="metric-tabs" aria-label="Currency display">
                {CURRENCY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={metric === option.value ? "active" : ""}
                    onClick={() => {
                      clearChartFocus();
                      setMetric(option.value);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <MultiFilter title="State" values={states} selected={filters.states} onToggle={(value) => toggleFilter("states", value)} onClear={() => clearFilter("states")} />
              <MultiFilter title="Year" values={years} selected={filters.years} onToggle={(value) => toggleFilter("years", value)} onClear={() => clearFilter("years")} compact />
              <MultiFilter
                title="Industry"
                values={availableIndustries}
                selected={filters.industries}
                onToggle={(value) => toggleFilter("industries", value)}
                onClear={() => {
                  clearChartFocus();
                  setIndustryComparisonScope("filtered");
                  setFilters((current) => ({ ...current, industries: [] }));
                }}
              />
              <MultiFilter
                title="Capability"
                values={availableCapabilities}
                selected={filters.capabilities}
                onToggle={(value) => toggleFilter("capabilities", value)}
                onClear={() => {
                  clearChartFocus();
                  setFilters((current) => ({ ...current, capabilities: [] }));
                }}
              />
              <button
                type="button"
                className="reset-button"
                onClick={() => {
                  clearChartFocus();
                  setFilters(EMPTY_FILTERS);
                  setLedgerInstitution(null);
                  setSelectedState(null);
                  setStateComparisonScope("filtered");
                  setIndustryComparisonScope("filtered");
                }}
              >
                <FilterX size={16} aria-hidden="true" />
                Reset
              </button>
            </aside>

            <section className="kpi-grid" aria-label="KPI summaries">
              <KpiCard icon={CircleDollarSign} label="Total Commitments" value={highlights.totalCommitments.value} detail={highlights.totalCommitments.detail} revealIndex={0} />
              <KpiCard icon={ArrowDownUp} label="Trend Movement" value={highlights.trendMovement.value} detail={highlights.trendMovement.detail} revealIndex={1} />
              <KpiCard icon={BarChart3} label="Records Tracked" value={highlights.recordsTracked.value} detail={highlights.recordsTracked.detail} revealIndex={2} />
              <KpiCard icon={MapPinned} label="State Coverage" value={highlights.stateCoverage.value} detail={highlights.stateCoverage.detail} revealIndex={3} />
              <KpiCard icon={ExternalLink} label="Source Base" value={highlights.sourceBase.value} detail={highlights.sourceBase.detail} revealIndex={4} />
            </section>

            <div className="dashboard-grid">
              <section id="charts" className="chart-zone" aria-label="Interactive charts" tabIndex={-1}>
                <div className="chart-zone-heading">
                  <span>Chart Lab</span>
                  <h2>Browse the chart views</h2>
                  <p>State, industry, concentration, investment-scale, and institution-network views in a publication-width frame.</p>
                </div>
                <ChartDeck
                  activeChart={activeChart}
                  onActiveChartChange={(chartId) => {
                    setActiveChart(chartId);
                    setExpandedChart(chartId);
                  }}
                >
                  <Panel
                    title="State Comparison"
                    subtitle={stateComparisonSubtitle}
                    wide
                    chartId="state-comparison"
                    expanded={isChartExpanded("state-comparison")}
                    onExpansionChange={setExpandedChart}
                    action={
                      hasStateFilter ? (
                        <div className="comparison-toggle" aria-label="State comparison view">
                          <button
                            type="button"
                            className={stateComparisonScope === "filtered" ? "active" : ""}
                            aria-pressed={stateComparisonScope === "filtered"}
                            onClick={() => {
                              setStateComparisonScope("filtered");
                            }}
                          >
                            Filtered states
                          </button>
                          <button
                            type="button"
                            className={stateComparisonScope === "all" ? "active" : ""}
                            aria-pressed={stateComparisonScope === "all"}
                            onClick={() => {
                              setStateComparisonScope("all");
                            }}
                          >
                            All states
                          </button>
                        </div>
                      ) : undefined
                    }
                  >
                    <ChartFrame
                      className="chart-frame state-comparison-frame"
                      selectionLabel={filters.states.length === 1 ? filters.states[0] : undefined}
                      onSelect={(point) => {
                        const datum = pickVerticalCategory(point, stateComparison.bars, { top: 34, right: 18, bottom: 58, left: 58 });
                        if (datum) focusState(datum.name);
                      }}
                    >
                      <VerticalBarChartGraphic
                        key={stateChartKey}
                        data={stateComparison.bars}
                        maxValue={stateComparison.maxValue}
                        metric={metric}
                        selectedName={selectedState}
                        labelFormatter={stateAxisLabel}
                        colorForDatum={(datum) => stateFill(datum.name, selectedState, datum.value, stateComparison.maxValue)}
                      />
                    </ChartFrame>
                  </Panel>

                  <Panel
                    title="Industry Ranking"
                    subtitle={industryComparisonSubtitle}
                    chartId="industry-ranking"
                    expanded={isChartExpanded("industry-ranking")}
                    onExpansionChange={setExpandedChart}
                    action={
                      hasIndustryFilter ? (
                        <div className="comparison-toggle" aria-label="Industry comparison view">
                          <button
                            type="button"
                            className={industryComparisonScope === "filtered" ? "active" : ""}
                            aria-pressed={industryComparisonScope === "filtered"}
                            onClick={() => {
                              setIndustryComparisonScope("filtered");
                            }}
                          >
                            Filtered industries
                          </button>
                          <button
                            type="button"
                            className={industryComparisonScope === "all" ? "active" : ""}
                            aria-pressed={industryComparisonScope === "all"}
                            onClick={() => {
                              setIndustryComparisonScope("all");
                            }}
                          >
                            All industries
                          </button>
                        </div>
                      ) : undefined
                    }
                  >
                    <ChartFrame
                      className="chart-frame domain-ranking-frame"
                      selectionLabel={filters.industries.length === 1 ? filters.industries[0] : undefined}
                      onSelect={(point) => {
                        const datum = pickHorizontalCategory(point, industryComparison.bars, { top: 12, right: 18, bottom: 30, left: 190, width: 720, height: 420 });
                        if (datum) focusIndustryFilter(datum.name);
                      }}
                    >
                      <HorizontalBarChartGraphic key={industryChartKey} data={industryComparison.bars} metric={metric} selectedName={filters.industries[0]} />
                    </ChartFrame>
                  </Panel>

                  <Panel
                    title="Concentration Trajectory"
                    subtitle="See which groups lead and how commitment shares change each year."
                    chartId="concentration-trend"
                    expanded={isChartExpanded("concentration-trend")}
                    onExpansionChange={setExpandedChart}
                    action={
                      <div className="comparison-toggle" aria-label="Concentration dimension">
                        <button type="button" className={trendDimension === "state" ? "active" : ""} aria-pressed={trendDimension === "state"} onClick={() => setTrendDimension("state")}>State</button>
                        <button type="button" className={trendDimension === "industry" ? "active" : ""} aria-pressed={trendDimension === "industry"} onClick={() => setTrendDimension("industry")}>Industry</button>
                        <button type="button" className={trendDimension === "capability" ? "active" : ""} aria-pressed={trendDimension === "capability"} onClick={() => setTrendDimension("capability")}>Capability</button>
                      </div>
                    }
                  >
                    <ChartFrame className="chart-frame concentration-trend-frame">
                      <ConcentrationProfileChartGraphic
                        data={concentrationTrend}
                        dimension={trendDimension}
                        appliedYear={filters.years.length === 1 ? Number(filters.years[0]) : null}
                        dataAsOf={dataset.metadata.generatedAt}
                        onApplyYear={toggleConcentrationYear}
                        onApplyLeader={focusConcentrationLeader}
                      />
                    </ChartFrame>
                  </Panel>

                  <Panel
                    title="Investment Scale Scatter"
                    subtitle={`All chartable ${metric === "usd" ? "USD million" : "INR crore"} announcements plotted by year and amount.`}
                    chartId="investment-scatter"
                    expanded={isChartExpanded("investment-scatter")}
                    onExpansionChange={setExpandedChart}
                  >
                    <ChartFrame
                      className="chart-frame investment-scatter-frame"
                      onSelect={(point) => {
                        const datum = pickScatterDatum(point, charts.scatter, charts.scatterDomain, { top: 18, right: 18, bottom: 34, left: 64, width: 720, height: 320 });
                        if (datum) focusScatterRecord(datum);
                      }}
                    >
                      <ScatterChartGraphic data={charts.scatter} domain={charts.scatterDomain} metric={metric} selectedOrganization={filters.search} />
                    </ChartFrame>
                  </Panel>

                  <Panel
                    title="Institution Network"
                    subtitle="Solid lines are source-backed direct connections. Hover or focus a line to inspect the relationship; larger dots appear in more announcements."
                    wide
                    chartId="ecosystem-network"
                    expanded={isChartExpanded("ecosystem-network")}
                    onExpansionChange={setExpandedChart}
                  >
                    <ChartFrame className="chart-frame network-graph-frame">
                      <EcosystemNetworkGraphic graph={ecosystemNetwork} onViewLedger={openInstitutionLedger} />
                    </ChartFrame>
                  </Panel>
                </ChartDeck>
              </section>

              <aside id="states" className="drilldown-panel" aria-label="State activity details">
                <StatePortfolio summaries={summaries} selectedState={selectedState} onSelect={togglePortfolioState} metric={metric} />
                <StateDrilldown summary={selectedSummary} />
              </aside>
            </div>

            <ExploreOurData cards={explorerCards} topicIndex={topicIndex} onAction={applyInsightAction} />

            <section id="evidence" className="table-section" tabIndex={-1}>
              <Panel title="Verified Ledger" subtitle="Compact source-backed initiative details without overwhelming the dashboard." wide>
                <EvidenceExplorer
                  records={sortedLedger}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  institutionFilter={ledgerInstitution}
                  onClearInstitutionFilter={() => setLedgerInstitution(null)}
                  onSort={changeSort}
                />
              </Panel>
            </section>

            <a className="back-to-filters" href="#hero-title">
              Back to top <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function RevealLayer({ image, cursorX, cursorY }: { image: string; cursorX: number; cursorY: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [maskImage, setMaskImage] = useState<string>("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const resizeCanvas = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * ratio));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * ratio));
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const x = cursorX * ratio;
    const y = cursorY * ratio;
    const radius = SPOTLIGHT_R * ratio;

    context.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,255,255,1)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.75)");
    gradient.addColorStop(0.75, "rgba(255,255,255,0.4)");
    gradient.addColorStop(0.88, "rgba(255,255,255,0.12)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    setMaskImage(`url(${canvas.toDataURL()})`);
  }, [cursorX, cursorY]);

  return (
    <>
      <canvas ref={canvasRef} className="hero-mask-canvas" aria-hidden="true" />
      <div
        className="hero-reveal-layer"
        style={
          {
            backgroundImage: `url("${image}")`,
            WebkitMaskImage: maskImage,
            maskImage,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
          } as CSSProperties
        }
        aria-hidden="true"
      />
    </>
  );
}

function MissionCanvas({ reduceMotion }: { reduceMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    let frame = 0;

    const draw = (time = 0) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(rect.width * ratio));
      const height = Math.max(1, Math.floor(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);

      const baseGradient = context.createLinearGradient(0, 0, rect.width, rect.height);
      baseGradient.addColorStop(0, "#06112d");
      baseGradient.addColorStop(0.42, "#0d3b5f");
      baseGradient.addColorStop(0.75, "#0f766e");
      baseGradient.addColorStop(1, "#d97706");
      context.fillStyle = baseGradient;
      context.fillRect(0, 0, rect.width, rect.height);

      context.strokeStyle = "rgba(255, 255, 255, 0.08)";
      context.lineWidth = 1;
      for (let x = -80; x < rect.width + 120; x += 72) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + rect.height * 0.3, rect.height);
        context.stroke();
      }
      for (let y = 40; y < rect.height; y += 92) {
        context.beginPath();
        context.moveTo(0, y);
        context.bezierCurveTo(rect.width * 0.24, y - 32, rect.width * 0.58, y + 46, rect.width, y - 10);
        context.stroke();
      }

      const nodes = HERO_NODES.map((node, index) => ({
        ...node,
        px: node.x * rect.width,
        py: node.y * rect.height + (reduceMotion ? 0 : Math.sin(time / 1100 + index) * 8),
      }));

      nodes.forEach((node, index) => {
        nodes.slice(index + 1).forEach((target) => {
          const distance = Math.hypot(node.px - target.px, node.py - target.py);
          if (distance > rect.width * 0.34) return;
          const alpha = Math.max(0.08, 0.24 - distance / rect.width);
          context.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          context.lineWidth = 1.2;
          context.beginPath();
          context.moveTo(node.px, node.py);
          context.lineTo(target.px, target.py);
          context.stroke();
        });
      });

      nodes.forEach((node, index) => {
        const pulse = reduceMotion ? 0 : Math.sin(time / 520 + index * 0.8) * 3;
        context.beginPath();
        context.fillStyle = "rgba(255, 255, 255, 0.13)";
        context.arc(node.px, node.py, 26 + pulse, 0, Math.PI * 2);
        context.fill();

        context.beginPath();
        context.fillStyle = node.color;
        context.shadowColor = node.color;
        context.shadowBlur = 18;
        context.arc(node.px, node.py, 7.5, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;

        context.font = "700 12px Inter, system-ui, sans-serif";
        context.fillStyle = "rgba(255, 255, 255, 0.8)";
        context.fillText(node.label, node.px + 13, node.py + 4);
      });

      if (!reduceMotion) frame = window.requestAnimationFrame(draw);
    };

    const handleResize = () => draw();

    draw();
    window.addEventListener("resize", handleResize);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, [reduceMotion]);

  return <canvas ref={canvasRef} className="mission-canvas" aria-hidden="true" />;
}

function useRevealAnimations(reduceMotion: boolean) {
  useEffect(() => {
    const revealElements = new Set<HTMLElement>();
    let frame = 0;

    const setFullyVisible = (element: HTMLElement) => {
      element.classList.add("is-visible");
      element.style.setProperty("--reveal-opacity", "1");
      element.style.setProperty("--reveal-y", "0px");
      element.style.setProperty("--reveal-scale", "1");
    };

    if (reduceMotion) {
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach(setFullyVisible);
      return undefined;
    }

    const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

    const updateRevealProgress = () => {
      frame = 0;
      const viewportHeight = window.innerHeight || 1;
      revealElements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const visiblePixels = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
        const revealDistance = Math.max(120, Math.min(rect.height || 1, viewportHeight * 0.42));
        const progress = clamp(visiblePixels / revealDistance);
        const eased = progress * progress * (3 - 2 * progress);
        const direction = rect.top + rect.height / 2 < viewportHeight / 2 ? -1 : 1;
        const offset = Math.round((1 - eased) * 46 * direction);
        const scale = 0.982 + eased * 0.018;

        element.classList.toggle("is-visible", progress > 0.08);
        element.style.setProperty("--reveal-opacity", eased.toFixed(3));
        element.style.setProperty("--reveal-y", `${offset}px`);
        element.style.setProperty("--reveal-scale", scale.toFixed(3));
      });
    };

    const scheduleRevealUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateRevealProgress);
    };

    const observeElement = (element: Element) => {
      if (!(element instanceof HTMLElement) || !element.matches("[data-reveal]")) return;
      revealElements.add(element);
    };

    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach(observeElement);
    scheduleRevealUpdate();

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          observeElement(node);
          node.querySelectorAll?.("[data-reveal]").forEach(observeElement);
        });
      });
      scheduleRevealUpdate();
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", scheduleRevealUpdate, { passive: true });
    window.addEventListener("resize", scheduleRevealUpdate);
    window.addEventListener("orientationchange", scheduleRevealUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      window.removeEventListener("scroll", scheduleRevealUpdate);
      window.removeEventListener("resize", scheduleRevealUpdate);
      window.removeEventListener("orientationchange", scheduleRevealUpdate);
    };
  }, [reduceMotion]);
}

function AnimatedMetric({ value, reduceMotion }: { value: number; reduceMotion: boolean }) {
  const [displayValue, setDisplayValue] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayValue(value);
      return undefined;
    }

    const duration = 1050;
    const start = performance.now();
    let frame = 0;

    const animate = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [reduceMotion, value]);

  return <>{displayValue}</>;
}

function MultiFilter({
  title,
  values,
  selected,
  compact = false,
  onToggle,
  onClear,
}: {
  title: string;
  values: string[];
  selected: string[];
  compact?: boolean;
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className={["filter-group", compact ? "compact" : "", `${slugifyFilterTitle(title)}-filter`].filter(Boolean).join(" ")}>
      <button type="button" className="filter-trigger" aria-haspopup="true">
        <span>{title}</span>
        <strong>{selected.length ? `${selected.length} selected` : "All"}</strong>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div className="filter-options" role="group" aria-label={`${title} filter options`}>
        <button type="button" className={selected.length ? "filter-option all-option" : "filter-option all-option active"} onClick={onClear}>
          <span className="filter-check" aria-hidden="true" />
          <span>{allFilterLabel(title)}</span>
        </button>
        {values.map((value) => (
          <label key={value}>
            <input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} />
            <span>{formatFilterValue(title, value)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function slugifyFilterTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function allFilterLabel(title: string): string {
  return `All ${title}`;
}

function formatFilterValue(title: string, value: string): string {
  return value;
}

function industryLabel(value: string): string {
  return value;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  revealIndex = 0,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  detail: string;
  revealIndex?: number;
}) {
  return (
    <article className="kpi-card" data-reveal style={{ "--reveal-delay": `${revealIndex * 70}ms` } as CSSProperties}>
      <Icon size={19} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Panel({
  title,
  subtitle,
  action,
  wide = false,
  chartId,
  expanded = false,
  onExpansionChange,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  wide?: boolean;
  chartId?: string;
  expanded?: boolean;
  onExpansionChange?: (chartId: string | null) => void;
  children: ReactNode;
}) {
  const expandableChartId = chartId && onExpansionChange ? chartId : null;
  const isExpandable = Boolean(expandableChartId);
  const panelClassName = [
    "panel",
    wide ? "panel-wide" : "",
    isExpandable ? "chart-panel" : "",
    expanded ? "expanded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={panelClassName}
      data-reveal
      onFocusCapture={expandableChartId ? () => onExpansionChange?.(expandableChartId) : undefined}
      onBlurCapture={
        expandableChartId
          ? (event) => {
              const nextTarget = event.relatedTarget;
              if (!nextTarget || !event.currentTarget.contains(nextTarget as Node)) onExpansionChange?.(null);
            }
          : undefined
      }
    >
      <div className={action ? "panel-heading panel-heading-action" : "panel-heading"}>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {action || <BarChart3 size={18} aria-hidden="true" />}
      </div>
      {children}
    </article>
  );
}

function DataInsights({ insights }: { insights: EditorialInsight[] }) {
  if (!insights.length) return null;

  return (
    <section className="owid-insights" aria-labelledby="data-insights-title" data-reveal>
      <div className="owid-section-heading">
        <span>Data Insights</span>
        <h2 id="data-insights-title">What the source-backed ledger is really saying</h2>
      </div>
      <div className="owid-insight-grid">
        {insights.map((insight, index) => (
          <article key={`${insight.eyebrow}-${insight.title}`} className="owid-insight-card" data-reveal style={{ "--reveal-delay": `${index * 80}ms` } as CSSProperties}>
            <span>{insight.eyebrow}</span>
            <h3>{insight.title}</h3>
            <p>{insight.body}</p>
            <div className="owid-insight-stat">
              <strong>{insight.stat}</strong>
              <small>{insight.statLabel}</small>
            </div>
            <Link href={insight.href}>
              {insight.actionLabel} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function AskTheAnalyst({
  allRecords,
  metric,
  onAction,
}: {
  allRecords: InvestmentRecord[];
  metric: MetricMode;
  onAction: (action: InsightAction) => void;
}) {
  const [question, setQuestion] = useState("");
  const transport = useMemo(
    () => new DefaultChatTransport<AnalystMessage>({ api: "/api/analyst" }),
    [],
  );
  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    setMessages,
    clearError,
  } = useChat<AnalystMessage>({ transport, experimental_throttle: 35 });
  const isBusy = status === "submitted" || status === "streaming";
  const visibleMessages = messages.slice(-6);
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const latestAssistantId = latestAssistantMessage?.id;
  const latestUserQuestion = analystTextFor([...messages].reverse().find((message) => message.role === "user"));
  const dashboardAction = useMemo(
    () => buildAnalystDashboardAction(latestUserQuestion, allRecords),
    [allRecords, latestUserQuestion],
  );
  const prompts = [
    "Compare Karnataka and Telangana and explain the gap.",
    "Which private institution is most involved, and which players are emerging?",
    "What changed from 2024 to the latest year?",
  ];

  const ask = async (nextQuestion: string) => {
    const submittedQuestion = nextQuestion.trim();
    if (!submittedQuestion || isBusy) return;
    setQuestion("");
    clearError();
    await sendMessage(
      { text: submittedQuestion },
      { body: { metric } },
    ).catch(() => undefined);
  };

  const resetConversation = () => {
    stop();
    setMessages([]);
    clearError();
    setQuestion("");
  };

  return (
    <section className="ask-analyst" aria-labelledby="ask-analyst-title" data-reveal>
      <div className="ask-analyst-copy">
        <span>Master Ask the Analyst</span>
        <h2 id="ask-analyst-title">Ask anything. Get a clear answer.</h2>
        <p>
          Ask about investments, institutions, relationships, trends, policies, or any wider AI question.
        </p>
      </div>

      <form
        className="analyst-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <Sparkles size={21} aria-hidden="true" />
        <textarea
          value={question}
          rows={2}
          maxLength={1200}
          aria-label="Question for Ask the Analyst"
          placeholder="Ask about any state, institution, investment, relationship, trend, or broader AI question."
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void ask(question);
            }
          }}
        />
        <button
          type={isBusy ? "button" : "submit"}
          className={isBusy ? "is-stop" : ""}
          disabled={!isBusy && !question.trim()}
          onClick={isBusy ? () => stop() : undefined}
        >
          {isBusy ? <Square size={13} fill="currentColor" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
          {isBusy ? "Stop" : "Ask"}
        </button>
      </form>

      {!messages.length && (
        <div className="analyst-prompts" aria-label="Example analyst questions">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => void ask(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      )}

      {(messages.length > 0 || isBusy || error) && (
      <div className={`ask-analyst-console ${messages.length ? "has-conversation" : ""}`} aria-live="polite" aria-busy={isBusy}>
        {messages.length > 0 && (
          <div className="analyst-console-heading analyst-console-heading-compact">
            <button type="button" className="analyst-reset" onClick={resetConversation}>
              <RotateCcw size={13} aria-hidden="true" /> New conversation
            </button>
          </div>
        )}

        <div className="analyst-messages">
          {visibleMessages.map((message) => {
            const isLatestAssistant = message.role === "assistant" && message.id === latestAssistantId;

            return (
              <Message className={`analyst-message analyst-message-${message.role}`} from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, index) => {
                    if (part.type !== "text") return null;
                    if (message.role === "user") {
                      return <p className="analyst-user-question" key={`${message.id}-text-${index}`}>{part.text}</p>;
                    }
                    return (
                      <MessageResponse
                        className="analyst-response-markdown"
                        isAnimating={isLatestAssistant && status === "streaming"}
                        key={`${message.id}-text-${index}`}
                      >
                        {part.text}
                      </MessageResponse>
                    );
                  })}

                  {isLatestAssistant && status === "ready" && dashboardAction && (
                    <div className="analyst-dashboard-action">
                      <button type="button" onClick={() => onAction(dashboardAction.action)}>
                        {dashboardAction.label} <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    </div>
                  )}

                </MessageContent>
              </Message>
            );
          })}

          {status === "submitted" && (
            <div className="analyst-answer-loading">
              <Sparkles size={17} aria-hidden="true" />
              <span>Researching your question…</span>
            </div>
          )}
        </div>

        {error && (
          <div className="analyst-error" role="alert">
            <strong>The analyst could not finish that answer.</strong>
            <span>Try again or make the question a little more specific.</span>
          </div>
        )}
      </div>
      )}
    </section>
  );
}

function analystTextFor(message: AnalystMessage | undefined): string {
  if (!message) return "";
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function buildAnalystDashboardAction(question: string, records: InvestmentRecord[]): { label: string; action: InsightAction } | undefined {
  const query = normalizeText(question);
  if (!query) return undefined;

  const institutions = uniqueSorted(records.flatMap((record) => record.majorPlayers))
    .filter((label) => normalizeText(label).length >= 4)
    .sort((a, b) => normalizeText(b).length - normalizeText(a).length);
  const institution = institutions.find((label) => query.includes(normalizeText(label)));

  if (/\bprivate\b/.test(query) && /institution|company|companies|player|players|firm|firms|emerg|rising|momentum/.test(query)) {
    return { label: "Explore private players in the network", action: { kind: "chart", value: "ecosystem-network", scope: "all" } };
  }
  if (/relationship|related|connected|connection|network|counterpart|partner/.test(query)) {
    return { label: "Open the institution network", action: { kind: "chart", value: "ecosystem-network", scope: "all" } };
  }
  if (/source|evidence|record|announcement|details|article/.test(query)) {
    return {
      label: institution ? `View ${institution} in the ledger` : "Open the detailed ledger",
      action: { kind: "ledger", scope: "all", ...(institution ? { value: institution } : {}) },
    };
  }
  if (institution) {
    return { label: `View ${institution} records`, action: { kind: "ledger", value: institution, scope: "all" } };
  }
  if (/institution|agency|agencies|company|companies|organisation|organization|player|players/.test(query)) {
    return { label: "Explore the institution network", action: { kind: "chart", value: "ecosystem-network", scope: "all" } };
  }

  const states = uniqueSorted(records.map((record) => record.state));
  if (states.some((state) => query.includes(normalizeText(state))) || /compare state|state comparison|which state|states lead/.test(query)) {
    return { label: "Open the state comparison", action: { kind: "chart", value: "state-comparison", scope: "all" } };
  }
  if (/trend|over time|changed|change from|year|latest year|recent years/.test(query)) {
    return { label: "Open the trend chart", action: { kind: "chart", value: "concentration-trend", scope: "all" } };
  }

  const domains = uniqueSorted(records.flatMap((record) => [record.industry, record.capability]));
  if (domains.some((domain) => query.includes(normalizeText(domain))) || /industry|industries|capability|capabilities|sector/.test(query)) {
    return { label: "Open the industry ranking", action: { kind: "chart", value: "industry-ranking", scope: "all" } };
  }
  if (/largest|biggest|highest|investment|commitment|amount|crore|million|billion/.test(query)) {
    return { label: "Open the investment chart", action: { kind: "chart", value: "investment-scatter", scope: "all" } };
  }
  return undefined;
}

function ChartDeck({
  activeChart,
  onActiveChartChange,
  children,
}: {
  activeChart: ChartViewId;
  onActiveChartChange: (chartId: ChartViewId) => void;
  children: ReactNode;
}) {
  const chartChildren = Children.toArray(children);
  const renderedChart = activeChart;
  const activeIndex = Math.max(0, CHART_VIEW_IDS.indexOf(renderedChart));
  const activeChild = chartChildren[activeIndex] || chartChildren[0];
  const canMoveLeft = activeIndex > 0;
  const canMoveRight = activeIndex < CHART_VIEW_IDS.length - 1;

  const move = (direction: "left" | "right") => {
    if ((direction === "left" && !canMoveLeft) || (direction === "right" && !canMoveRight)) return;
    const offset = direction === "right" ? 1 : -1;
    const nextIndex = Math.min(CHART_VIEW_IDS.length - 1, Math.max(0, activeIndex + offset));
    onActiveChartChange(CHART_VIEW_IDS[nextIndex]);
  };

  return (
    <div className="chart-carousel">
      <div className="chart-carousel-controls" aria-label="Browse charts">
        <button type="button" onClick={() => move("left")} className={canMoveLeft ? undefined : "is-inactive"} aria-label="Previous chart">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span aria-live="polite">{CHART_VIEW_LABELS[renderedChart]}</span>
        <button type="button" onClick={() => move("right")} className={canMoveRight ? undefined : "is-inactive"} aria-label="Next chart">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="chart-carousel-track">
        {activeChild}
      </div>
    </div>
  );
}

function MiniBarList({ data }: { data: ChartDatum[] }) {
  const max = Math.max(1, ...data.map((datum) => datum.value));
  return (
    <div className="mini-bar-list" aria-hidden="true">
      {data.slice(0, 5).map((datum, index) => (
        <div key={datum.name} className="mini-bar-row">
          <span>{datum.name}</span>
          <i>
            <b style={{ width: `${Math.max(4, (datum.value / max) * 100)}%`, background: DOMAIN_COLORS[index % DOMAIN_COLORS.length] }} />
          </i>
        </div>
      ))}
    </div>
  );
}

function ExploreOurData({
  cards,
  topicIndex,
  onAction,
}: {
  cards: ExplorerCard[];
  topicIndex: ReturnType<typeof buildTopicIndex>;
  onAction: (action: InsightAction) => void;
}) {
  const [activeTopic, setActiveTopic] = useState<AtlasTopicKind>("state");
  const [topicQuery, setTopicQuery] = useState("");
  const topicGroups: Array<{
    id: AtlasTopicKind;
    label: string;
    description: string;
    items: ChartDatum[];
  }> = [
    { id: "state", label: "States", description: "All covered state and union-territory pages", items: topicIndex.states },
    { id: "industry", label: "Industries", description: "Industry domains used across the dashboard", items: topicIndex.industries },
    { id: "capability", label: "Capabilities", description: "AI capabilities represented in the announcements", items: topicIndex.capabilities },
    { id: "institution", label: "Institutions", description: "Companies, public agencies, research bodies, and ecosystem partners", items: topicIndex.institutions },
    { id: "year", label: "Years", description: "Annual announcement pages in the current coverage window", items: topicIndex.years },
  ];
  const activeGroup = topicGroups.find((group) => group.id === activeTopic) || topicGroups[0];
  const normalizedQuery = normalizeText(topicQuery);
  const matches = activeGroup.items.filter((item) => !normalizedQuery || normalizeText(item.name).includes(normalizedQuery));
  const visibleLimit = activeTopic === "institution" ? (normalizedQuery ? 24 : 12) : activeGroup.items.length;
  const visibleItems = matches.slice(0, visibleLimit);
  const largestTopic = Math.max(1, ...visibleItems.map((item) => item.value));
  const coverageStats = [
    { label: "Announcements", value: formatCompact(topicIndex.coverage.announcements) },
    { label: "States", value: formatCompact(topicIndex.states.length) },
    { label: "Industries", value: formatCompact(topicIndex.industries.length) },
    { label: "Capabilities", value: formatCompact(topicIndex.capabilities.length) },
    { label: "Institutions", value: formatCompact(topicIndex.institutions.length) },
    { label: "Direct links", value: formatCompact(topicIndex.coverage.relationships) },
  ];

  return (
    <section id="atlas" className="data-atlas" aria-labelledby="explore-data-title" tabIndex={-1} data-reveal>
      <div className="data-atlas__heading-row">
        <div className="owid-section-heading data-atlas__heading">
          <span>Data Atlas</span>
          <h2 id="explore-data-title">Choose a way into India&apos;s AI activity</h2>
          <p>Start with a full-dashboard view, then move into a state, industry, capability, institution, or year page.</p>
        </div>
        <div className="data-atlas__window" aria-label={`Coverage window ${topicIndex.coverage.yearRange}`}>
          <span>Coverage window</span>
          <strong>{topicIndex.coverage.yearRange}</strong>
          <small>2024 onward</small>
        </div>
      </div>

      <div className="data-atlas__coverage" aria-label="Data Atlas coverage">
        {coverageStats.map((stat) => (
          <div key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="data-atlas__subheading">
        <div>
          <span>Atlas views</span>
          <h3>Start with the question you want to answer</h3>
        </div>
        <small>Every view opens against the complete Atlas.</small>
      </div>

      <div className="data-atlas__views">
        {cards.map((card) => (
          <article key={card.id} className={`data-atlas__card ${card.id === "ecosystem-network" ? "is-network" : ""}`} data-reveal>
            <div className="data-atlas__card-topline">
              <span>{card.eyebrow}</span>
              <AtlasCardIcon id={card.id} />
            </div>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
            <AtlasCardPreview card={card} />
            <div className="data-atlas__card-footer">
              <small>{card.detail}</small>
              <button type="button" aria-label={`${card.actionLabel} in Chart Lab`} onClick={() => onAction(card.action)}>
                {card.actionLabel} <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="data-atlas__utilities" aria-label="Data Atlas utilities">
        <div>
          <Sparkles size={19} aria-hidden="true" />
          <span><strong>Need a synthesis?</strong><small>Ask a cross-cutting question without leaving the dashboard.</small></span>
          <a href="#ask-analyst-title">Ask the analyst <ArrowRight size={14} aria-hidden="true" /></a>
        </div>
        <div>
          <ExternalLink size={19} aria-hidden="true" />
          <span><strong>Need the underlying record?</strong><small>Inspect and sort every announcement in the detailed ledger.</small></span>
          <button type="button" onClick={() => onAction({ kind: "ledger", scope: "all" })}>
            Open the ledger <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="data-atlas__browser">
        <div className="data-atlas__browser-heading">
          <div>
            <span>Browse the Atlas</span>
            <h3>Move from the overview to a focused page</h3>
          </div>
          <label className="data-atlas__search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={topicQuery}
              aria-label={`Search ${activeGroup.label.toLowerCase()} in the Data Atlas`}
              placeholder={`Search ${activeGroup.label.toLowerCase()}`}
              onChange={(event) => setTopicQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="data-atlas__tabs" role="group" aria-label="Data Atlas dimensions">
          {topicGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              aria-pressed={activeTopic === group.id}
              className={activeTopic === group.id ? "active" : ""}
              onClick={() => {
                setActiveTopic(group.id);
                setTopicQuery("");
              }}
            >
              <span>{group.label}</span>
              <small>{group.items.length}</small>
            </button>
          ))}
        </div>

        <div className="data-atlas__topic-panel">
          <div className="data-atlas__topic-summary">
            <span>{activeGroup.description}</span>
            <small>
              {normalizedQuery
                ? `${matches.length} match${matches.length === 1 ? "" : "es"}`
                : visibleItems.length < matches.length
                  ? `Showing ${visibleItems.length} of ${matches.length}`
                  : `${matches.length} page${matches.length === 1 ? "" : "s"}`}
            </small>
          </div>
          {visibleItems.length ? (
            <nav className="data-atlas__topic-grid" aria-label={`${activeGroup.label} pages`}>
              {visibleItems.map((item) => (
                <Link
                  key={item.name}
                  href={topicHref(activeTopic, item.name)}
                  aria-label={`${formatTopicLabel(activeTopic, item.name)}, ${item.records.length} records`}
                  style={{ "--atlas-topic-share": `${Math.max(6, (item.value / largestTopic) * 100)}%` } as CSSProperties}
                >
                  <span>
                    <strong>{formatTopicLabel(activeTopic, item.name)}</strong>
                    <small>{item.records.length} record{item.records.length === 1 ? "" : "s"}</small>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                  <i aria-hidden="true"><b /></i>
                </Link>
              ))}
            </nav>
          ) : (
            <div className="data-atlas__empty">No {activeGroup.label.toLowerCase()} match “{topicQuery}”.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function AtlasCardIcon({ id }: { id: string }) {
  if (id === "state-comparison") return <MapPinned size={19} aria-hidden="true" />;
  if (id === "industry-ranking") return <BarChart3 size={19} aria-hidden="true" />;
  if (id === "concentration-trend") return <Layers3 size={19} aria-hidden="true" />;
  if (id === "investment-scatter") return <CircleDollarSign size={19} aria-hidden="true" />;
  return <NetworkIcon size={19} aria-hidden="true" />;
}

function AtlasCardPreview({ card }: { card: ExplorerCard }) {
  if (card.preview === "network") {
    return (
      <div className="data-atlas__cluster-preview" aria-hidden="true">
        {NETWORK_INSTITUTION_TYPES.map((group) => (
          <span key={group.id}>
            <i style={{ background: group.fill, borderColor: group.stroke }} />
            <small>{group.legendLabel}</small>
          </span>
        ))}
      </div>
    );
  }

  if (card.preview === "timeline") {
    const largestYear = Math.max(1, ...card.previewData.map((item) => item.value));
    return (
      <div className="data-atlas__timeline-preview" aria-hidden="true">
        {card.previewData.map((item) => (
          <span key={item.name}>
            <small>{item.name}</small>
            <i><b style={{ height: `${Math.max(18, (item.value / largestYear) * 100)}%` }} /></i>
            <strong>{item.records.length}</strong>
          </span>
        ))}
      </div>
    );
  }

  if (card.preview === "records") {
    return (
      <div className="data-atlas__record-preview" aria-hidden="true">
        {card.previewData.slice(0, 3).map((item) => (
          <span key={`${item.name}-${item.records[0]?.id}`}>
            <strong>{item.name}</strong>
            <small>{item.records[0]?.state} · {item.records[0]?.year}</small>
          </span>
        ))}
      </div>
    );
  }

  return <MiniBarList data={card.previewData} />;
}

function topicHref(kind: AtlasTopicKind, value: string): string {
  if (kind === "state") return `/states/${slugify(value)}`;
  if (kind === "industry") return `/sector-types/${slugify(value)}`;
  if (kind === "capability") return `/sectors/${slugify(value)}`;
  if (kind === "institution") return `/companies/${slugify(value)}`;
  return `/investments/${slugify(value)}`;
}

function formatTopicLabel(kind: AtlasTopicKind, value: string): string {
  return kind === "industry" ? industryLabel(value) : value;
}

type ChartClickPoint = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ChartGrid = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width?: number;
  height?: number;
};

function ChartFrame({
  className,
  children,
  onSelect,
  selectionLabel,
}: {
  className: string;
  children: ReactNode;
  onSelect?: (point: ChartClickPoint) => void;
  selectionLabel?: string;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={frameRef}
      className={className}
      role={onSelect ? "button" : undefined}
      aria-label={onSelect ? "Interact with chart" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onPointerDown={onSelect ? (event) => event.preventDefault() : undefined}
      onPointerUp={
        onSelect
          ? (event) => {
              event.preventDefault();
              const rect = event.currentTarget.querySelector(".chart-graphic")?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect();
              onSelect({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                width: rect.width,
                height: rect.height,
              });
            }
          : undefined
      }
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              const rect = event.currentTarget.querySelector(".chart-graphic")?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect();
              onSelect({
                x: rect.width / 2,
                y: rect.height / 2,
                width: rect.width,
                height: rect.height,
              });
            }
          : undefined
      }
    >
      {selectionLabel && (
        <span className="chart-selection-badge">
          Showing <strong>{selectionLabel}</strong>
        </span>
      )}
      {children}
    </div>
  );
}

type NetworkView = {
  scale: number;
  x: number;
  y: number;
};

type NetworkTooltipState = {
  x: number;
  y: number;
  label: string;
  detail: string;
} | null;

function EcosystemNetworkGraphic({
  graph,
  onViewLedger,
}: {
  graph: NetworkGraphModel;
  onViewLedger: (institution: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; viewX: number; viewY: number } | null>(null);
  const viewRef = useRef<NetworkView>({ scale: 1, x: 0, y: 0 });
  const [view, setView] = useState<NetworkView>({ scale: 1, x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<NetworkTooltipState>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [networkQuery, setNetworkQuery] = useState("");

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handleWheel = (event: WheelEvent) => {
      if ((event.target as Element | null)?.closest(".network-graph-toolbar, .network-evidence-panel")) return;
      const activeView = viewRef.current;
      const isAtMinimum = activeView.scale <= 1.001 && event.deltaY > 0;
      const isAtMaximum = activeView.scale >= 3.999 && event.deltaY < 0;
      if (isAtMinimum || isAtMaximum) return;
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const pointerX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * NETWORK_WIDTH;
      const pointerY = ((event.clientY - rect.top) / Math.max(1, rect.height)) * NETWORK_HEIGHT;
      const zoomFactor = Math.exp(-event.deltaY * 0.0015);
      setView((current) => {
        const scale = Math.max(1, Math.min(4, current.scale * zoomFactor));
        const ratio = scale / current.scale;
        const nextView = clampNetworkView({
          scale,
          x: pointerX - (pointerX - current.x) * ratio,
          y: pointerY - (pointerY - current.y) * ratio,
        });
        viewRef.current = nextView;
        return nextView;
      });
    };

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    const resetView = { scale: 1, x: 0, y: 0 };
    viewRef.current = resetView;
    setView(resetView);
    setTooltip(null);
    setSelectedNodeId(null);
    setHoveredNodeId(null);
  }, [graph]);

  const activeNodeId = selectedNodeId || hoveredNodeId;
  const relatedNodeIds = useMemo(() => {
    if (!activeNodeId) return new Set<string>();
    const related = new Set<string>([activeNodeId]);
    graph.edges.forEach((edge) => {
      if (edge.source.id === activeNodeId) related.add(edge.target.id);
      if (edge.target.id === activeNodeId) related.add(edge.source.id);
    });
    return related;
  }, [activeNodeId, graph.edges]);
  const relatedEdgeIds = useMemo(() => {
    if (!activeNodeId) return new Set<string>();
    return new Set(
      graph.edges
        .filter((edge) => edge.source.id === activeNodeId || edge.target.id === activeNodeId)
        .map((edge) => edge.id),
    );
  }, [activeNodeId, graph.edges]);
  const directEdgeCountByNodeId = useMemo(() => {
    const counts = new Map<string, number>();
    graph.edges.forEach((edge) => {
      counts.set(edge.source.id, (counts.get(edge.source.id) || 0) + 1);
      counts.set(edge.target.id, (counts.get(edge.target.id) || 0) + 1);
    });
    return counts;
  }, [graph.edges]);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedDirectEdges = selectedNode
    ? graph.edges.filter((edge) => edge.source.id === selectedNode.id || edge.target.id === selectedNode.id)
    : [];
  const selectedRecords = selectedNode
    ? selectedNode.recordIds
        .map((recordId) => graph.recordsById.get(recordId))
        .filter((record): record is InvestmentRecord => Boolean(record))
        .sort((a, b) => b.year - a.year || a.initiative.localeCompare(b.initiative))
    : [];

  const showTooltip = (label: string, detail: string, clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      label,
      detail,
      x: Math.max(92, Math.min(rect.width - 92, clientX - rect.left)),
      y: Math.max(64, Math.min(rect.height - 18, clientY - rect.top)),
    });
  };

  const showFocusedTooltip = (label: string, detail: string, target: SVGElement) => {
    const rect = target.getBoundingClientRect();
    showTooltip(label, detail, rect.left + rect.width / 2, rect.top);
  };

  const setClampedView = (nextView: NetworkView) => {
    const clamped = clampNetworkView(nextView);
    viewRef.current = clamped;
    setView(clamped);
  };

  const zoomFromKeyboard = (factor: number) => {
    const current = viewRef.current;
    const scale = Math.max(1, Math.min(4, current.scale * factor));
    const ratio = scale / current.scale;
    setClampedView({
      scale,
      x: NETWORK_WIDTH / 2 - (NETWORK_WIDTH / 2 - current.x) * ratio,
      y: NETWORK_HEIGHT / 2 - (NETWORK_HEIGHT / 2 - current.y) * ratio,
    });
  };

  const resetNetworkView = () => setClampedView({ scale: 1, x: 0, y: 0 });

  const focusNode = (node: NetworkNode) => {
    const scale = Math.max(2, viewRef.current.scale);
    setClampedView({
      scale,
      x: NETWORK_WIDTH / 2 - node.x * scale,
      y: NETWORK_HEIGHT / 2 - node.y * scale,
    });
    setSelectedNodeId(node.id);
  };

  const selectFromSearch = () => {
    const normalizedQuery = normalizeText(networkQuery);
    if (!normalizedQuery) return;
    const match = graph.nodes.find((node) => normalizeText(node.label) === normalizedQuery)
      || graph.nodes.find((node) => normalizeText(node.label).startsWith(normalizedQuery))
      || graph.nodes.find((node) => normalizeText(node.label).includes(normalizedQuery));
    if (!match) return;
    setNetworkQuery(match.label);
    focusNode(match);
  };

  if (!graph.nodes.length) {
    return <div className="network-graph-empty">No institutions match the active filters.</div>;
  }

  return (
    <div className="network-graph-shell">
      <div
        ref={stageRef}
        className={isDragging ? "network-graph-stage is-dragging" : "network-graph-stage"}
        role="region"
        aria-roledescription="interactive network diagram"
        aria-label={`${graph.nodes.length} institutions with ${graph.edges.length} source-backed direct links. Select an institution to inspect its cited announcements and direct neighbors.`}
        aria-describedby="ecosystem-network-help"
        tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          zoomFromKeyboard(1.22);
        } else if (event.key === "-") {
          event.preventDefault();
          zoomFromKeyboard(1 / 1.22);
        } else if (event.key === "0") {
          event.preventDefault();
          resetNetworkView();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setSelectedNodeId(null);
          setHoveredNodeId(null);
          setTooltip(null);
        } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          const offset = 28;
          const current = viewRef.current;
          setClampedView({
            ...current,
            x: current.x + (event.key === "ArrowLeft" ? offset : event.key === "ArrowRight" ? -offset : 0),
            y: current.y + (event.key === "ArrowUp" ? offset : event.key === "ArrowDown" ? -offset : 0),
          });
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if ((event.target as Element | null)?.closest(".network-node, .network-edge-group, .network-graph-toolbar, .network-evidence-panel")) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          viewX: viewRef.current.x,
          viewY: viewRef.current.y,
        };
        setTooltip(null);
        setIsDragging(true);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const deltaX = ((event.clientX - drag.clientX) / Math.max(1, rect.width)) * NETWORK_WIDTH;
        const deltaY = ((event.clientY - drag.clientY) / Math.max(1, rect.height)) * NETWORK_HEIGHT;
        setClampedView({ ...viewRef.current, x: drag.viewX + deltaX, y: drag.viewY + deltaY });
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        setIsDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        setIsDragging(false);
      }}
      onDoubleClick={(event) => {
        if ((event.target as Element | null)?.closest(".network-graph-toolbar, .network-evidence-panel")) return;
        resetNetworkView();
      }}
    >
      <p id="ecosystem-network-help" className="sr-only">
        Use the mouse wheel to zoom, drag to pan, and hover or focus a dot to reveal its institution. Hover or focus a solid line to inspect the direct relationship and its source. Select a dot to pin its direct network and inspect source evidence. Keyboard users can zoom with plus and minus, pan with arrow keys, clear with Escape, and reset with zero.
      </p>
      <form
        className="network-graph-toolbar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          selectFromSearch();
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <label htmlFor="institution-network-search">Find institution</label>
        <div>
          <input
            id="institution-network-search"
            type="search"
            list="institution-network-options"
            value={networkQuery}
            placeholder="Search institutions"
            autoComplete="off"
            onChange={(event) => setNetworkQuery(event.target.value)}
          />
          <button type="submit">Find</button>
        </div>
        <datalist id="institution-network-options">
          {graph.nodes.map((node) => <option key={node.id} value={node.label} />)}
        </datalist>
      </form>
      <svg
        className="chart-graphic network-graph-graphic"
        viewBox={`0 0 ${NETWORK_WIDTH} ${NETWORK_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-labelledby="ecosystem-network-title ecosystem-network-description"
      >
        <title id="ecosystem-network-title">Institution co-involvement network</title>
        <desc id="ecosystem-network-description">Institution dots are grouped by agency type. Every line is a source-backed direct relationship, and its wider invisible interaction area makes the relationship evidence easier to inspect. Dot size reflects cited announcement involvement.</desc>
        <rect
          className="network-graph-hit-area"
          width={NETWORK_WIDTH}
          height={NETWORK_HEIGHT}
          onClick={() => {
            setSelectedNodeId(null);
            setHoveredNodeId(null);
            setTooltip(null);
          }}
        />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {graph.clusters.map((cluster) => (
            <path
              key={cluster.id}
              className="network-cluster-shade"
              d={cluster.path}
              fill={cluster.fill}
              stroke={cluster.stroke}
              vectorEffect="non-scaling-stroke"
              aria-hidden="true"
            />
          ))}
          <g className="network-edges">
            {graph.edges.map((edge) => {
              const isRelated = relatedEdgeIds.has(edge.id);
              const isInteractive = !selectedNodeId || isRelated;
              const evidence = edge.evidence[0];
              const record = graph.recordsById.get(evidence.recordId);
              const relationshipSummary = evidence.relationship === "Documented co-participation"
                ? `Co-participation — ${networkInitiativeExcerpt(record)}`
                : `${evidence.relationship} — ${conciseNetworkRelationship(evidence.detail)}`;
              const detail = `${relationshipSummary} · ${sourcePublisher(evidence.sourceUrl)}${edge.evidence.length > 1 ? ` · +${edge.evidence.length - 1} record${edge.evidence.length === 2 ? "" : "s"}` : ""}`;
              return (
                <g
                  key={edge.id}
                  className={`network-edge-group${activeNodeId && !isRelated ? " is-dimmed" : ""}${isRelated ? " is-related" : ""}${!isInteractive ? " is-disabled" : ""}`}
                  tabIndex={isInteractive ? 0 : -1}
                  role={isInteractive ? "img" : undefined}
                  aria-hidden={isInteractive ? undefined : true}
                  aria-label={isInteractive ? `${edge.source.label} to ${edge.target.label}: ${detail}` : undefined}
                  onPointerDown={(event) => {
                    if (isInteractive) event.stopPropagation();
                  }}
                  onPointerEnter={(event) => {
                    if (isInteractive) showTooltip(`${edge.source.label} ↔ ${edge.target.label}`, detail, event.clientX, event.clientY);
                  }}
                  onPointerMove={(event) => {
                    if (isInteractive) showTooltip(`${edge.source.label} ↔ ${edge.target.label}`, detail, event.clientX, event.clientY);
                  }}
                  onPointerLeave={() => {
                    if (isInteractive) setTooltip(null);
                  }}
                  onFocus={(event) => {
                    if (isInteractive) showFocusedTooltip(`${edge.source.label} ↔ ${edge.target.label}`, detail, event.currentTarget);
                  }}
                  onBlur={() => setTooltip(null)}
                >
                  <path
                    d={edge.path}
                    className="network-edge network-edge-direct"
                    strokeWidth={1.15}
                    vectorEffect="non-scaling-stroke"
                    aria-hidden="true"
                  />
                  <path
                    d={edge.path}
                    className="network-edge-hit"
                    strokeWidth={18}
                    vectorEffect="non-scaling-stroke"
                    aria-hidden="true"
                  />
                </g>
              );
            })}
          </g>
          <g className="network-nodes">
            {graph.nodes.map((node) => {
              const directEdgeCount = directEdgeCountByNodeId.get(node.id) || 0;
              const detail = `${node.clusterLabel} · ${node.recordCount} announcement${node.recordCount === 1 ? "" : "s"} · ${directEdgeCount} verified link${directEdgeCount === 1 ? "" : "s"}`;
              const isSelected = selectedNodeId === node.id;
              const isRelated = relatedNodeIds.has(node.id);
              return (
                <circle
                  key={node.id}
                  className={`network-node${isSelected ? " is-selected" : ""}${activeNodeId && !isRelated ? " is-dimmed" : ""}${isRelated && !isSelected ? " is-related" : ""}`}
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                  tabIndex={0}
                  role="button"
                  aria-label={`${node.label}, ${detail}`}
                  aria-pressed={isSelected}
                  vectorEffect="non-scaling-stroke"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerEnter={(event) => {
                    setHoveredNodeId(node.id);
                    showTooltip(node.label, detail, event.clientX, event.clientY);
                  }}
                  onPointerMove={(event) => showTooltip(node.label, detail, event.clientX, event.clientY)}
                  onPointerLeave={() => {
                    setHoveredNodeId(null);
                    setTooltip(null);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedNodeId((current) => current === node.id ? null : node.id);
                  }}
                  onFocus={(event) => {
                    setHoveredNodeId(node.id);
                    showFocusedTooltip(node.label, detail, event.currentTarget);
                  }}
                  onBlur={() => {
                    setHoveredNodeId(null);
                    setTooltip(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedNodeId((current) => current === node.id ? null : node.id);
                  }}
                />
              );
            })}
          </g>
        </g>
      </svg>
      {tooltip && (
        <div className="network-graph-tooltip" style={{ left: tooltip.x, top: tooltip.y }} aria-hidden="true">
          <strong>{tooltip.label}</strong>
          <span>{tooltip.detail}</span>
        </div>
      )}
      <div className="network-graph-legend" aria-label="Network legend">
        <span><i className="legend-line legend-direct" /> Direct</span>
        {graph.clusters.map((cluster) => (
          <span key={cluster.id}>
            <i className="legend-shade" style={{ background: cluster.fill, borderColor: cluster.stroke }} />
            {cluster.legendLabel}
          </span>
        ))}
      </div>
      </div>
      {selectedNode && (
        <aside
          className="network-evidence-panel"
          aria-label={`Evidence for ${selectedNode.label}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header>
            <div>
              <span>Selected institution</span>
              <strong>{selectedNode.label}</strong>
            </div>
            <div className="network-evidence-actions">
              <button className="network-ledger-button" type="button" onClick={() => onViewLedger(selectedNode.label)}>
                View in verified ledger
              </button>
              <button className="network-clear-button" type="button" onClick={() => setSelectedNodeId(null)}>Clear</button>
            </div>
          </header>
          <p>
            {selectedRecords.length} announcement{selectedRecords.length === 1 ? "" : "s"} · {selectedDirectEdges.length} verified link{selectedDirectEdges.length === 1 ? "" : "s"}
          </p>
          {selectedDirectEdges.length > 0 ? (
            <ul>
              {selectedDirectEdges.slice(0, 1).map((edge) => {
                const counterpart = edge.source.id === selectedNode.id ? edge.target : edge.source;
                const evidence = edge.evidence[0];
                return (
                  <li key={edge.id}>
                    <a href={evidence.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open relationship evidence for ${counterpart.label}`}>
                      {counterpart.label}
                    </a>
                    <span>{evidence.relationship}{edge.evidence.length > 1 ? ` · ${edge.evidence.length} sources` : ""}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <small>No verified relationship in the active data.</small>
          )}
          {selectedDirectEdges.length > 1 && <small>+{selectedDirectEdges.length - 1} more links in the ledger</small>}
        </aside>
      )}
    </div>
  );
}

function clampNetworkView(view: NetworkView): NetworkView {
  const marginX = NETWORK_WIDTH * 0.16;
  const marginY = NETWORK_HEIGHT * 0.18;
  const minX = NETWORK_WIDTH - NETWORK_WIDTH * view.scale - marginX;
  const minY = NETWORK_HEIGHT - NETWORK_HEIGHT * view.scale - marginY;
  return {
    scale: view.scale,
    x: Math.max(minX, Math.min(marginX, view.x)),
    y: Math.max(minY, Math.min(marginY, view.y)),
  };
}

function pickVerticalCategory<T>(point: ChartClickPoint, items: T[], grid: ChartGrid): T | undefined {
  const scaled = scaleChartGrid(point, grid);
  const plotLeft = scaled.left;
  const plotRight = point.width - scaled.right;
  const plotTop = scaled.top;
  const plotBottom = point.height - scaled.bottom;
  if (!items.length || point.x < plotLeft || point.x > plotRight || point.y < plotTop || point.y > plotBottom) return undefined;
  const index = Math.min(items.length - 1, Math.max(0, Math.floor(((point.x - plotLeft) / Math.max(1, plotRight - plotLeft)) * items.length)));
  return items[index];
}

function pickHorizontalCategory<T>(point: ChartClickPoint, items: T[], grid: ChartGrid): T | undefined {
  const scaled = scaleChartGrid(point, grid);
  const plotLeft = scaled.left;
  const plotRight = point.width - scaled.right;
  const plotTop = scaled.top;
  const plotBottom = point.height - scaled.bottom;
  if (!items.length || point.x < plotLeft || point.x > plotRight || point.y < plotTop || point.y > plotBottom) return undefined;
  const index = Math.min(items.length - 1, Math.max(0, Math.floor(((point.y - plotTop) / Math.max(1, plotBottom - plotTop)) * items.length)));
  return items[index];
}

function scaleChartGrid(point: ChartClickPoint, grid: ChartGrid): ChartGrid {
  const sourceWidth = grid.width || 720;
  const sourceHeight = grid.height || point.height;
  const scaleX = point.width / sourceWidth;
  const scaleY = point.height / sourceHeight;
  return {
    top: grid.top * scaleY,
    right: grid.right * scaleX,
    bottom: grid.bottom * scaleY,
    left: grid.left * scaleX,
  };
}

function pickScatterDatum(
  point: ChartClickPoint,
  items: ScatterDatum[],
  domain: { x: [number, number]; y: [number, number]; sizeRange: [number, number] },
  grid: ChartGrid,
): ScatterDatum | undefined {
  const scaled = scaleChartGrid(point, grid);
  const plotLeft = scaled.left;
  const plotRight = point.width - scaled.right;
  const plotTop = scaled.top;
  const plotBottom = point.height - scaled.bottom;
  if (!items.length) return undefined;
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const plotHeight = Math.max(1, plotBottom - plotTop);
  const xRange = Math.max(0.001, domain.x[1] - domain.x[0]);
  const yRange = Math.max(0.001, domain.y[1] - domain.y[0]);
  let nearestItem: ScatterDatum | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  items.forEach((item) => {
    const x = plotLeft + ((item.plotYear - domain.x[0]) / xRange) * plotWidth;
    const y = plotTop + (1 - (item.plotAmount - domain.y[0]) / yRange) * plotHeight;
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < nearestDistance) {
      nearestItem = item;
      nearestDistance = distance;
    }
  });

  return nearestDistance <= 34 ? nearestItem : undefined;
}

function StatePortfolio({
  summaries,
  selectedState,
  metric,
  onSelect,
}: {
  summaries: StateSummary[];
  selectedState: string | null;
  metric: MetricMode;
  onSelect: (state: string) => void;
}) {
  const didMountRef = useRef(false);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (!selectedState) return;
    const stateButton = document.querySelector<HTMLButtonElement>(`[data-state-button="${slugify(selectedState)}"]`);
    stateButton?.focus({ preventScroll: true });
  }, [selectedState]);

  return (
    <section className="state-portfolio" aria-label="State portfolio" data-reveal>
      <div className="panel-heading compact">
        <div>
          <h2>State Portfolio</h2>
          <p>Portfolio and activity detail.</p>
        </div>
        <MapPinned size={18} aria-hidden="true" />
      </div>
      <div className="state-buttons">
        {summaries.map((summary) => (
          <button
            key={summary.name}
            type="button"
            className={selectedState === summary.name ? "active" : ""}
            aria-pressed={selectedState === summary.name}
            data-state-button={slugify(summary.name)}
            style={{ "--state": summary.color, "--shade": `${summary.intensity}%` } as CSSProperties}
            onClick={() => onSelect(summary.name)}
          >
            <span>{summary.name}</span>
            <strong>{formatMetricValue(metric === "usd" ? summary.usd : summary.inr, metric)}</strong>
            <small>{summary.capabilities.slice(0, 2).join(", ")}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function StateDrilldown({ summary }: { summary: StateSummary }) {
  const topRecords = summary.records
    .slice()
    .sort((a, b) => nativeAmountValue(b) - nativeAmountValue(a))
    .slice(0, 5);

  return (
    <section className="state-detail" data-reveal>
      <div className="state-detail-head" style={{ "--state": summary.color } as CSSProperties}>
        <span>{summary.name === "All States" ? "Current Scope" : "Selected State"}</span>
        <h2>{summary.name}</h2>
        <p>{summary.count} verified announcements across {summary.capabilities.length} sectors</p>
      </div>
      <div className="activity-list">
        <h3>What they have done</h3>
        <AnimatePresence initial={false}>
          {topRecords.map((record, index) => (
            <motion.a
              key={record.id}
              href={record.sourceUrl}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              data-reveal
              style={{ "--reveal-delay": `${index * 58}ms` } as CSSProperties}
            >
              <span>{record.year} · {industryLabel(record.industry)} / {record.capability}</span>
              <strong>{record.organization}</strong>
              <p>{record.initiative}</p>
              <em>{record.investmentBrought || record.amount.parseNote}</em>
            </motion.a>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function Heatmap({
  cells,
  states,
  capabilities,
  metric,
  onFocus,
}: {
  cells: HeatmapCell[];
  states: string[];
  capabilities: string[];
  metric: MetricMode;
  onFocus: (state: string, capability: string) => void;
}) {
  const cellFor = (state: string, capability: string) => cells.find((cell) => cell.state === state && cell.capability === capability);
  return (
    <div className="heatmap-scroll">
      <div
        className="heatmap-grid"
        style={
          {
            "--domain-count": capabilities.length,
          } as CSSProperties
        }
      >
        <span className="heatmap-corner" />
        {capabilities.map((capability) => (
          <span key={capability} className="heatmap-domain">
            {capability}
          </span>
        ))}
        {states.map((state, stateIndex) => (
          <FragmentRow key={state}>
            <span className="heatmap-state">{state}</span>
            {capabilities.map((capability, capabilityIndex) => {
              const cell = cellFor(state, capability);
              return (
                <button
                  key={`${state}-${capability}`}
                  type="button"
                  className="heatmap-cell"
                  style={
                    {
                      "--heat": `${cell?.intensity || 0}%`,
                      "--state": stateColor(state),
                      "--chart-index": stateIndex * capabilities.length + capabilityIndex,
                      "--chart-delay": `${80 + Math.min(stateIndex * capabilities.length + capabilityIndex, 28) * 24}ms`,
                    } as CSSProperties
                  }
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => onFocus(state, capability)}
                >
                  <strong>{formatHeatmapValue(cell, metric)}</strong>
                </button>
              );
            })}
          </FragmentRow>
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function formatHeatmapValue(cell: HeatmapCell | undefined, metric: MetricMode): string {
  if (!cell?.records.length) return "-";
  if (cell.value > 0) return formatMetricValue(cell.value, metric);
  return "Financial amount not disclosed";
}

function cloneFilters(filters: FilterState): FilterState {
  return {
    states: [...filters.states],
    years: [...filters.years],
    industries: [...filters.industries],
    capabilities: [...filters.capabilities],
    disclosure: filters.disclosure,
    search: filters.search,
  };
}

function EvidenceExplorer({
  records,
  sortKey,
  sortDirection,
  institutionFilter,
  onClearInstitutionFilter,
  onSort,
}: {
  records: InvestmentRecord[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  institutionFilter: string | null;
  onClearInstitutionFilter: () => void;
  onSort: (key: SortKey) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleRecords = expanded ? records : records.slice(0, 12);
  const sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: "year", label: "Year" },
    { key: "state", label: "State" },
    { key: "organization", label: "Organization" },
    { key: "industry", label: "Industry" },
    { key: "capability", label: "Capability" },
    { key: "amount", label: "Investment" },
  ];

  if (!records.length) {
    return (
      <div className="evidence-explorer">
        <div className="evidence-toolbar">
          <span className="evidence-total">
            <strong>0</strong> matching announcements
          </span>
          {institutionFilter && (
            <button
              type="button"
              className="evidence-institution-filter"
              aria-label={`Clear institution filter ${institutionFilter}`}
              onClick={onClearInstitutionFilter}
            >
              Institution: <strong>{institutionFilter}</strong> <span>Clear</span>
            </button>
          )}
        </div>
        <p className="evidence-empty">No initiatives match the active filters.</p>
      </div>
    );
  }

  return (
    <div className="evidence-explorer">
      <div className="evidence-toolbar">
        <span className="evidence-total" data-total={records.length}>
          <strong>{records.length}</strong> matching announcements
        </span>
        {institutionFilter && (
          <button
            type="button"
            className="evidence-institution-filter"
            aria-label={`Clear institution filter ${institutionFilter}`}
            onClick={onClearInstitutionFilter}
          >
            Institution: <strong>{institutionFilter}</strong> <span>Clear</span>
          </button>
        )}
        <div className="evidence-sort" role="group" aria-label="Sort evidence records">
          {sortOptions.map((option) => (
            <button key={option.key} type="button" className={sortKey === option.key ? "active" : ""} aria-pressed={sortKey === option.key} onClick={() => onSort(option.key)}>
              {option.label}
              <ArrowDownUp size={13} aria-hidden="true" />
              {sortKey === option.key && <span>{sortDirection}</span>}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveAnnouncementTable records={visibleRecords} />
      <AnnouncementCardGrid records={visibleRecords} />

      {records.length > 12 && (
        <button type="button" className="evidence-toggle" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Show compact view" : `Show all ${records.length} source announcements`}
        </button>
      )}
    </div>
  );
}

function ResponsiveAnnouncementTable({ records }: { records: InvestmentRecord[] }) {
  return (
    <div className="evidence-table-wrap">
      <table className="evidence-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>State</th>
            <th>Organization</th>
            <th>Capability</th>
            <th>Industry</th>
            <th>Investment</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <AnnouncementTableRow key={record.id} record={record} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnnouncementTableRow({ record }: { record: InvestmentRecord }) {
  const publisher = sourcePublisher(record.sourceUrl);

  return (
    <tr>
      <td>{record.year}</td>
      <td>{record.state}</td>
      <td>
        <strong>{record.organization}</strong>
        <span>{record.initiative}</span>
      </td>
      <td>{record.capability}</td>
      <td>{industryLabel(record.industry)}</td>
      <td>{record.investmentBrought || record.amount.parseNote}</td>
      <td>
        <a href={record.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open source from ${publisher}`}>
          {publisher} <ExternalLink size={13} aria-hidden="true" />
        </a>
      </td>
    </tr>
  );
}

function AnnouncementCardGrid({ records }: { records: InvestmentRecord[] }) {
  return (
    <div className="evidence-list">
      {records.map((record, index) => (
        <AnnouncementCard key={record.id} record={record} revealIndex={index} />
      ))}
    </div>
  );
}

function AnnouncementCard({ record, revealIndex }: { record: InvestmentRecord; revealIndex: number }) {
  return (
    <motion.a
      className="evidence-card"
      href={record.sourceUrl}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      data-reveal
      style={{ "--state": stateColor(record.state), "--reveal-delay": `${Math.min(revealIndex, 11) * 35}ms` } as CSSProperties}
    >
      <span className="evidence-meta">
        <i aria-hidden="true" />
        {record.year} · {record.location}
      </span>
      <strong>{record.organization}</strong>
      <p>{record.initiative}</p>
      <span className="evidence-tags">
        <small>Capability: {record.capability}</small>
        <small>Industry: {industryLabel(record.industry)}</small>
        <small>{record.investmentBrought || record.amount.parseNote}</small>
      </span>
      <em>
        {sourcePublisher(record.sourceUrl)} <ExternalLink size={13} aria-hidden="true" />
      </em>
    </motion.a>
  );
}

function sourcePublisher(sourceUrl: string): string {
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\.|^m\./, "");
    const publishers: Record<string, string> = {
      "timesofindia.indiatimes.com": "The Times of India",
      "economictimes.com": "The Economic Times",
      "economictimes.indiatimes.com": "The Economic Times",
      "hindustantimes.com": "Hindustan Times",
      "pib.gov.in": "Press Information Bureau",
      "test.uniindia.com": "United News of India",
      "uniindia.com": "United News of India",
      "haryanacmoffice.gov.in": "Haryana CMO",
      "home.iitd.ac.in": "IIT Delhi",
      "ddnews.gov.in": "DD News",
      "thehindu.com": "The Hindu",
      "tomshardware.com": "Tom's Hardware",
    };
    return publishers[host] || host;
  } catch {
    return "Source";
  }
}

type ScatterDatum = {
  id: string;
  year: number;
  plotYear: number;
  amount: number;
  plotAmount: number;
  size: number;
  state: string;
  organization: string;
  industry: string;
  capability: string;
  currency: CurrencyCode;
};

function VerticalBarChartGraphic({
  data,
  maxValue,
  metric,
  selectedName,
  labelFormatter,
  colorForDatum,
}: {
  data: ChartDatum[];
  maxValue: number;
  metric: MetricMode;
  selectedName: string | null;
  labelFormatter: (value: string) => string;
  colorForDatum: (datum: ChartDatum, index: number) => string;
}) {
  const width = 720;
  const height = 330;
  const grid = { top: 34, right: 18, bottom: 58, left: 58 };
  const plotWidth = width - grid.left - grid.right;
  const plotHeight = height - grid.top - grid.bottom;
  const max = Math.max(1, maxValue);
  const ticks = buildTicks(max);

  return (
    <svg className="chart-graphic" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="State comparison chart" preserveAspectRatio="xMidYMid meet">
      {ticks.map((tick, tickIndex) => {
        const y = grid.top + (1 - tick / max) * plotHeight;
        return (
          <g key={`${tick}-${tickIndex}`}>
            <line x1={grid.left} x2={width - grid.right} y1={y} y2={y} stroke={CHART_GRID_COLOR} strokeDasharray="4 6" />
            <text x={grid.left - 10} y={y + 4} textAnchor="end" fill={CHART_TEXT_COLOR} fontSize="12" fontWeight="700">
              {formatCompact(tick)}
            </text>
          </g>
        );
      })}
      {data.map((datum, index) => {
        const slot = plotWidth / Math.max(1, data.length);
        const barWidth = Math.min(50, slot * 0.58);
        const x = grid.left + index * slot + (slot - barWidth) / 2;
        const barHeight = Math.max(4, (datum.value / max) * plotHeight);
        const y = grid.top + plotHeight - barHeight;
        const labels = labelFormatter(datum.name).split("\n");
        const isSelected = selectedName === datum.name;
        return (
          <g key={datum.name} opacity={selectedName && !isSelected ? 0.58 : 1} style={{ "--chart-index": index, "--chart-delay": `${90 + Math.min(index, 18) * 48}ms` } as CSSProperties}>
            <rect className="chart-bar-mark" x={x} y={y} width={barWidth} height={barHeight} rx="8" fill={colorForDatum(datum, index)}>
              <animate attributeName="y" from={grid.top + plotHeight} to={y} dur="1250ms" begin={`${index * 58}ms`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.16 1 0.3 1" />
              <animate attributeName="height" from="0" to={barHeight} dur="1250ms" begin={`${index * 58}ms`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.16 1 0.3 1" />
            </rect>
            <text
              x={x + barWidth / 2}
              y={Math.max(14, y - 8)}
              textAnchor="middle"
              fill={CHART_AXIS_COLOR}
              fontSize="11"
              fontWeight="800"
              className="chart-value-label"
            >
              {formatCompact(datum.value)}
            </text>
            <text x={x + barWidth / 2} y={height - grid.bottom + 24} textAnchor="middle" fill={CHART_AXIS_COLOR} fontSize="11" fontWeight="800">
              {labels.map((label, labelIndex) => (
                <tspan key={label} x={x + barWidth / 2} dy={labelIndex === 0 ? 0 : 14}>
                  {label}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function HorizontalBarChartGraphic({ data, metric, selectedName }: { data: ChartDatum[]; metric: MetricMode; selectedName?: string }) {
  const width = 720;
  const height = 420;
  const grid = { top: 12, right: 18, bottom: 30, left: 190 };
  const plotWidth = width - grid.left - grid.right;
  const plotHeight = height - grid.top - grid.bottom;
  const max = Math.max(1, ...data.map((datum) => datum.value));
  const ticks = buildTicks(max);

  return (
    <svg className="chart-graphic" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sector ranking chart" preserveAspectRatio="xMidYMid meet">
      {ticks.map((tick, tickIndex) => {
        const x = grid.left + (tick / max) * plotWidth;
        return (
          <g key={`${tick}-${tickIndex}`}>
            <line x1={x} x2={x} y1={grid.top} y2={height - grid.bottom} stroke={CHART_GRID_COLOR} strokeDasharray="4 6" />
            <text x={x} y={height - 2} textAnchor="middle" fill={CHART_TEXT_COLOR} fontSize="11" fontWeight="700">
              {formatCompact(tick)}
            </text>
          </g>
        );
      })}
      {data.map((datum, index) => {
        const rowHeight = plotHeight / Math.max(1, data.length);
        const barHeight = Math.min(24, rowHeight * 0.48);
        const y = grid.top + index * rowHeight + (rowHeight - barHeight) / 2;
        const barWidth = Math.max(4, (datum.value / max) * plotWidth);
        const isSelected = selectedName === datum.name;
        const valueInside = barWidth > plotWidth * 0.82;
        return (
          <g key={datum.name} opacity={selectedName && !isSelected ? 0.55 : 1} style={{ "--chart-index": index, "--chart-delay": `${90 + Math.min(index, 18) * 48}ms` } as CSSProperties}>
            <text x={grid.left - 12} y={y + barHeight / 2 - 3} textAnchor="end" fill={CHART_TEXT_COLOR} fontSize="10.5" fontWeight="800">
              {wrapSvgLabel(datum.name, 23).map((line, lineIndex) => (
                <tspan key={`${datum.name}-${lineIndex}`} x={grid.left - 12} dy={lineIndex === 0 ? 0 : 12}>
                  {line}
                </tspan>
              ))}
            </text>
            <rect className="chart-bar-mark" x={grid.left} y={y} width={barWidth} height={barHeight} rx="8" fill={DOMAIN_COLORS[index % DOMAIN_COLORS.length]}>
              <animate attributeName="width" from="0" to={barWidth} dur="1250ms" begin={`${index * 58}ms`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.16 1 0.3 1" />
            </rect>
            <text
              x={valueInside ? grid.left + barWidth - 10 : Math.min(width - grid.right - 4, grid.left + barWidth + 8)}
              y={y + barHeight / 2 + 4}
              textAnchor={valueInside ? "end" : "start"}
              fill={valueInside ? "#ffffff" : CHART_AXIS_COLOR}
              fontSize="11"
              fontWeight="800"
            >
              {formatCompact(datum.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ConcentrationProfileChartGraphic({
  data,
  dimension,
  appliedYear,
  dataAsOf,
  onApplyYear,
  onApplyLeader,
}: {
  data: ConcentrationPoint[];
  dimension: TrendDimension;
  appliedYear: number | null;
  dataAsOf: string;
  onApplyYear: (year: number) => void;
  onApplyLeader: (name: string) => void;
}) {
  const latestYear = data[data.length - 1]?.year ?? null;
  const initialYear = appliedYear && data.some((point) => point.year === appliedYear) ? appliedYear : latestYear;
  const [selectedYear, setSelectedYear] = useState<number | null>(initialYear);
  const [previewYear, setPreviewYear] = useState<number | null>(null);

  useEffect(() => {
    setSelectedYear((current) => {
      if (appliedYear && data.some((point) => point.year === appliedYear)) return appliedYear;
      if (current && data.some((point) => point.year === current)) return current;
      return latestYear;
    });
    setPreviewYear(null);
  }, [appliedYear, data, latestYear]);

  const activeYear = previewYear ?? selectedYear ?? latestYear;
  const activeIndex = data.findIndex((point) => point.year === activeYear);
  const activePoint = activeIndex >= 0 ? data[activeIndex] : undefined;
  const previousPoint = activeIndex > 0 ? data[activeIndex - 1] : undefined;
  const leaderGroup = activePoint?.topGroups[0];
  const leaderDelta = activePoint && previousPoint ? activePoint.topOneShare - previousPoint.topOneShare : null;
  const leaderChanged = Boolean(activePoint && previousPoint && activePoint.leader !== previousPoint.leader);
  const dimensionLabel = trendDimensionLabel(dimension);
  const dimensionPluralLabel = trendDimensionPlural(dimension);
  const snapshotDate = formatConcentrationSnapshotDate(dataAsOf);

  return (
    <div className="concentration-profile">
      <div className="concentration-legend" aria-label="Concentration chart legend">
        <span><i className="is-leader" />Leader</span>
        <span><i className="is-next" />Next two</span>
        <span><i className="is-remaining" />Others</span>
      </div>

      {data.length ? (
        <div
          className="concentration-snapshot-chart"
          role="group"
          aria-label={`${dimensionLabel} concentration by disclosed commitment value for ${data.map((point) => point.year).join(", ")}`}
        >
          <div className="concentration-axis" aria-hidden="true">
            <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
          </div>
          {data.map((point) => {
            const nextTwoShare = Math.max(0, point.topThreeShare - point.topOneShare);
            const remainingShare = Math.max(0, 100 - point.topThreeShare);
            const isSelected = point.year === activeYear;
            const coverageLabel = `${point.includedRecordCount} of ${point.recordCount} records have values`;
            const topNames = point.topGroups.map((group) => `${group.name} ${group.share.toFixed(1)}%`).join(", ");

            return (
              <button
                type="button"
                key={point.year}
                className={`concentration-year-row ${isSelected ? "is-selected" : ""}`}
                aria-pressed={selectedYear === point.year}
                aria-label={`${point.year}. ${point.leader} leads with ${point.topOneShare.toFixed(1)} percent; top three share ${point.topThreeShare.toFixed(1)} percent. ${coverageLabel}. Effective spread ${point.effectiveCategories.toFixed(1)} of ${point.categoryCount} ${dimensionPluralLabel}. Top groups: ${topNames}.`}
                onMouseEnter={() => setPreviewYear(point.year)}
                onMouseLeave={() => setPreviewYear(null)}
                onFocus={() => setPreviewYear(point.year)}
                onBlur={() => setPreviewYear(null)}
                onClick={() => setSelectedYear(point.year)}
              >
                <span className="concentration-year-label">
                  <strong>{point.year}</strong>
                  {point.year === latestYear && <small>Latest</small>}
                </span>
                <span className="concentration-share-bar" aria-hidden="true">
                  <span className="concentration-segment is-leader" style={{ width: `${point.topOneShare}%` }}>
                    {point.topOneShare >= 24 && <b>{truncateConcentrationLabel(point.leader)} {point.topOneShare.toFixed(0)}%</b>}
                  </span>
                  <span className="concentration-segment is-next" style={{ width: `${nextTwoShare}%` }}>
                    {nextTwoShare >= 23 && <b>Next two</b>}
                  </span>
                  <span className="concentration-segment is-remaining" style={{ width: `${remainingShare}%` }}>
                    {remainingShare >= 23 && <b>Others</b>}
                  </span>
                </span>
                <span className="concentration-year-meta" aria-hidden="true">
                  <span>{coverageLabel}</span>
                  <span>Spread {point.effectiveCategories.toFixed(1)} of {point.categoryCount}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="concentration-empty" role="status">No records are available in this scope.</div>
      )}

      {activePoint && leaderGroup && (
        <section className="concentration-detail" aria-live="polite" aria-label={`Selected ${activePoint.year} concentration details`}>
          <div className="concentration-detail-heading">
            <div>
              <span>{activePoint.year} {dimensionLabel}</span>
              <h3>{activePoint.leader} leads</h3>
            </div>
          </div>

          <div className="concentration-detail-metrics">
            <div><span>Leader</span><strong>{activePoint.topOneShare.toFixed(1)}%</strong></div>
            <div><span>Top three</span><strong>{activePoint.topThreeShare.toFixed(1)}%</strong></div>
            <div><span>Spread</span><strong>{activePoint.effectiveCategories.toFixed(1)} <small>of {activePoint.categoryCount}</small></strong></div>
          </div>

          <div className="concentration-ranked-groups" aria-label={`Top ${dimensionPluralLabel} in ${activePoint.year}`}>
            {activePoint.topGroups.map((group, index) => (
              <span key={`${activePoint.year}-${group.name}`}>
                <b>{index + 1}</b> {group.name} <strong>{group.share.toFixed(1)}%</strong>
              </span>
            ))}
          </div>

          <div className="concentration-detail-footer">
            <p>
              {activePoint.includedRecordCount} of {activePoint.recordCount} records include a disclosed value.
              {leaderDelta !== null && ` The leading share ${leaderDelta >= 0 ? "increased" : "decreased"} by ${Math.abs(leaderDelta).toFixed(1)} percentage points from ${previousPoint?.year}.`}
              {leaderChanged && previousPoint && ` ${activePoint.leader} replaced ${previousPoint.leader} as the leader.`}
              {activePoint.year === latestYear && snapshotDate && ` The latest snapshot was updated on ${snapshotDate}.`}
            </p>
            <div className="concentration-actions">
              <button type="button" onClick={() => onApplyYear(activePoint.year)}>
                {appliedYear === activePoint.year ? "Clear year" : `Filter ${activePoint.year}`}
              </button>
              <button type="button" onClick={() => onApplyLeader(activePoint.leader)}>
                Focus leader
              </button>
            </div>
          </div>
        </section>
      )}

      <p className="concentration-method-note">
        This chart shows disclosed commitments in tracked records, not market share. A higher spread means commitments are distributed more evenly.
      </p>
    </div>
  );
}

function trendDimensionLabel(dimension: TrendDimension): string {
  if (dimension === "state") return "State";
  if (dimension === "industry") return "Industry";
  return "Capability";
}

function trendDimensionPlural(dimension: TrendDimension): string {
  if (dimension === "state") return "states";
  if (dimension === "industry") return "industries";
  return "capabilities";
}

function truncateConcentrationLabel(value: string, maxLength = 20): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function formatConcentrationSnapshotDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function buildTicks(max: number): number[] {
  const safeMax = Math.max(1, max);
  const precision = safeMax < 10 ? 1 : 0;
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => Number((safeMax * ratio).toFixed(precision)));
}

function preserveScrollPosition(update: () => void, anchorSelector?: string): void {
  if (typeof window === "undefined") {
    update();
    return;
  }

  const x = window.scrollX;
  const y = window.scrollY;
  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  const anchor = anchorSelector ? document.querySelector<HTMLElement>(anchorSelector) : null;
  const anchorTop = anchor?.getBoundingClientRect().top;
  let cancelled = false;
  let cleanupManualScrollListeners = () => {};

  root.style.scrollBehavior = "auto";
  update();

  const restore = () => {
    if (cancelled) return;
    const nextAnchor = anchorSelector ? document.querySelector<HTMLElement>(anchorSelector) : null;
    if (nextAnchor && typeof anchorTop === "number") {
      const delta = nextAnchor.getBoundingClientRect().top - anchorTop;
      window.scrollTo(x, window.scrollY + delta);
      return;
    }
    window.scrollTo(x, y);
  };

  const checkpoints = [0, 40, 100, 180, 320, 520, 760];
  const stopRestoring = () => {
    cancelled = true;
    cleanupManualScrollListeners();
    root.style.scrollBehavior = previousScrollBehavior;
  };

  window.setTimeout(() => {
    const listenerOptions: AddEventListenerOptions = { passive: true };
    window.addEventListener("wheel", stopRestoring, listenerOptions);
    window.addEventListener("touchmove", stopRestoring, listenerOptions);
    window.addEventListener("keydown", stopRestoring, listenerOptions);
    cleanupManualScrollListeners = () => {
      window.removeEventListener("wheel", stopRestoring);
      window.removeEventListener("touchmove", stopRestoring);
      window.removeEventListener("keydown", stopRestoring);
    };
  }, 0);

  checkpoints.forEach((delay, index) => {
    window.setTimeout(() => {
      restore();
      if (index === checkpoints.length - 1) {
        cleanupManualScrollListeners();
        root.style.scrollBehavior = previousScrollBehavior;
      }
    }, delay);
  });

  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(() => {
      restore();
      if (!checkpoints.length) {
        root.style.scrollBehavior = previousScrollBehavior;
      }
    });
  });
}

function focusElementAfterUpdate(update: () => void, selector: string): void {
  if (typeof window === "undefined") {
    update();
    return;
  }

  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  let cancelled = false;
  let cleanupManualScrollListeners = () => {};

  update();

  const stopFocusing = () => {
    cancelled = true;
    cleanupManualScrollListeners();
    root.style.scrollBehavior = previousScrollBehavior;
  };

  window.setTimeout(() => {
    const listenerOptions: AddEventListenerOptions = { passive: true };
    window.addEventListener("wheel", stopFocusing, listenerOptions);
    window.addEventListener("touchmove", stopFocusing, listenerOptions);
    window.addEventListener("keydown", stopFocusing, listenerOptions);
    cleanupManualScrollListeners = () => {
      window.removeEventListener("wheel", stopFocusing);
      window.removeEventListener("touchmove", stopFocusing);
      window.removeEventListener("keydown", stopFocusing);
    };
  }, 0);

  const focusElement = () => {
    if (cancelled) return;
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const visibleTop = 96;
    const targetTop = window.scrollY + rect.top - Math.max(visibleTop, (viewportHeight - Math.min(rect.height, viewportHeight * 0.72)) / 2);
    if (element.hasAttribute("tabindex")) element.focus({ preventScroll: true });
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  };

  [40, 180, 360].forEach((delay, index, delays) => {
    window.setTimeout(() => {
      focusElement();
      if (index === delays.length - 1) {
        cleanupManualScrollListeners();
        root.style.scrollBehavior = previousScrollBehavior;
      }
    }, delay);
  });
}

function chartSignature(data: Array<{ name: string; value: number }>): string {
  return data.map((datum) => `${datum.name}:${Math.round(datum.value * 10)}`).join("|");
}

function wrapSvgLabel(value: string, maxLineLength: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  if (!words.length) return [value];
  const lines: string[] = [];
  words.forEach((word) => {
    const current = lines[lines.length - 1];
    if (!current || current.length + word.length + 1 > maxLineLength) {
      lines.push(word);
      return;
    }
    lines[lines.length - 1] = `${current} ${word}`;
  });
  return lines;
}

function buildLinearLinePath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function measurePathLength(points: Array<{ x: number; y: number }>): number {
  return points.reduce((total, point, index) => {
    if (index === 0) return 0;
    const previous = points[index - 1];
    return total + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

function ScatterChartGraphic({
  data,
  domain,
  metric,
  selectedOrganization,
}: {
  data: ScatterDatum[];
  domain: { x: [number, number]; y: [number, number]; sizeRange: [number, number] };
  metric: MetricMode;
  selectedOrganization?: string;
}) {
  const width = 720;
  const height = 320;
  const grid = { top: 18, right: 18, bottom: 34, left: 64 };
  const plotWidth = width - grid.left - grid.right;
  const plotHeight = height - grid.top - grid.bottom;
  const xRange = Math.max(0.001, domain.x[1] - domain.x[0]);
  const yRange = Math.max(0.001, domain.y[1] - domain.y[0]);
  const minAmount = Math.min(...data.map((datum) => datum.size), 0);
  const maxAmount = Math.max(...data.map((datum) => datum.size), 1);
  const amountRange = Math.max(1, maxAmount - minAmount);
  const yTicks = buildTicks(domain.y[1]);
  const xTicks = Array.from(new Set(data.map((datum) => datum.year))).sort((a, b) => a - b);

  return (
    <svg className="chart-graphic" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Investment scatter chart" preserveAspectRatio="xMidYMid meet">
      {yTicks.map((tick, tickIndex) => {
        const y = grid.top + (1 - (tick - domain.y[0]) / yRange) * plotHeight;
        return (
          <g key={`${tick}-${tickIndex}`}>
            <line x1={grid.left} x2={width - grid.right} y1={y} y2={y} stroke={CHART_GRID_COLOR} strokeDasharray="4 6" />
            <text x={grid.left - 10} y={y + 4} textAnchor="end" fill={CHART_TEXT_COLOR} fontSize="12" fontWeight="700">
              {formatCompact(tick)}
            </text>
          </g>
        );
      })}
      {xTicks.map((year) => {
        const x = grid.left + ((year - domain.x[0]) / xRange) * plotWidth;
        return (
          <text key={year} x={x} y={height - 8} textAnchor="middle" fill={CHART_TEXT_COLOR} fontSize="12" fontWeight="800">
            {year}
          </text>
        );
      })}
      {data.map((datum, index) => {
        const x = grid.left + ((datum.plotYear - domain.x[0]) / xRange) * plotWidth;
        const y = grid.top + (1 - (datum.plotAmount - domain.y[0]) / yRange) * plotHeight;
        const [minSize, maxSize] = domain.sizeRange;
        const radius = Math.max(4.5, Math.min(12, minSize / 2 + ((datum.size - minAmount) / amountRange) * ((maxSize - minSize) / 2)));
        const isSelected = selectedOrganization === datum.organization;
        const labelX = Math.min(width - 18, Math.max(grid.left + 12, x + 12));
        const labelY = Math.min(height - grid.bottom - 8, Math.max(grid.top + 12, y - 12));
        return (
          <g key={datum.id} opacity={selectedOrganization && !isSelected ? 0.42 : 1} style={{ "--chart-index": index, "--chart-delay": `${90 + Math.min(index, 18) * 48}ms` } as CSSProperties}>
            <circle
              className={isSelected ? "chart-dot-mark selected" : "chart-dot-mark"}
              cx={x}
              cy={y}
              r={isSelected ? radius + 3 : radius}
              fill={SCATTER_POINT_COLOR}
              fillOpacity="0.82"
              stroke={isSelected ? "#0f172a" : "#ffffff"}
              strokeWidth={isSelected ? 3 : 2}
            >
            </circle>
            {isSelected && (
              <text x={labelX} y={labelY} textAnchor={labelX > width - 150 ? "end" : "start"} fill={CHART_AXIS_COLOR} fontSize="11" fontWeight="900">
                {wrapSvgLabel(datum.organization, 22).map((line, lineIndex) => (
                  <tspan key={`${datum.id}-${lineIndex}`} x={labelX} dy={lineIndex === 0 ? 0 : 12}>
                    {line}
                  </tspan>
                ))}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function buildHeroStateNodes(states: string[]): HeroStateNode[] {
  return states.map((state, index) => {
    const position = HERO_NODE_POSITIONS[index % HERO_NODE_POSITIONS.length];
    return {
      state,
      label: stateCode(state),
      x: position.x,
      y: position.y,
      color: stateColor(state, index),
      delay: `${(index % HERO_NODE_POSITIONS.length) * 0.18}s`,
    };
  });
}

function stateCode(state: string): string {
  const words = state.split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  return state.slice(0, 3).toUpperCase();
}

function stateAxisLabel(value: string): string {
  if (value.length <= 9) return value;
  const words = value.split(/\s+/);
  if (words.length > 1) return words.join("\n");
  return `${value.slice(0, 8)}\n${value.slice(8)}`;
}

function groupByConvertedMetric(records: InvestmentRecord[], metric: MetricMode, getKey: (record: InvestmentRecord) => string): ChartDatum[] {
  const groups = new Map<string, InvestmentRecord[]>();
  records.forEach((record) => {
    const key = getKey(record);
    groups.set(key, [...(groups.get(key) || []), record]);
  });

  return [...groups.entries()]
    .map(([name, groupRecords]) => ({
      name,
      records: groupRecords,
      value: groupRecords.reduce((sum, record) => sum + convertedValueForMetric(record, metric), 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

function applyFilters(records: InvestmentRecord[], filters: FilterState): InvestmentRecord[] {
  return records.filter((record) => {
    if (filters.states.length && !filters.states.includes(record.state)) return false;
    if (filters.years.length && !filters.years.includes(String(record.year))) return false;

    const matchesIndustry = filters.industries.length === 0 || filters.industries.includes(record.industry);
    const matchesCapability = filters.capabilities.length === 0 || filters.capabilities.includes(record.capability);

    if (filters.industries.length && filters.capabilities.length) {
      if (!matchesIndustry && !matchesCapability) return false;
    } else if (filters.industries.length && !matchesIndustry) {
      return false;
    } else if (filters.capabilities.length && !matchesCapability) {
      return false;
    }

    if (filters.disclosure === "chartable" && !record.amount.chartable) return false;
    if (filters.disclosure === "narrative" && record.amount.chartable) return false;
    return matchesSearch(record, filters.search);
  });
}

function buildKpis(records: InvestmentRecord[], metric: MetricMode) {
  return {
    totalCommitments: records.reduce((sum, record) => sum + convertedValueForMetric(record, metric), 0),
  };
}

function buildStateComparison(records: InvestmentRecord[], metric: MetricMode) {
  const bars = groupByConvertedMetric(records, metric, (record) => record.state);
  return {
    bars,
    maxValue: Math.max(1, ...bars.map((state) => state.value)),
  };
}

function buildIndustryComparison(records: InvestmentRecord[], metric: MetricMode) {
  return {
    bars: groupByConvertedMetric(records, metric, (record) => record.industry),
  };
}

function buildConcentrationTrend(
  records: InvestmentRecord[],
  metric: MetricMode,
  dimension: TrendDimension,
): ConcentrationPoint[] {
  const years = [...new Set(records.map((record) => record.year))].sort((a, b) => a - b);

  return years.map((year) => {
    const yearRecords = records.filter((record) => record.year === year);
    const includedRecords = yearRecords.filter((record) => convertedValueForMetric(record, metric) > 0);
    const groups = groupByConvertedMetric(includedRecords, metric, (record) => record[dimension]);
    const total = groups.reduce((sum, group) => sum + group.value, 0);
    const share = (value: number) => total > 0 ? (value / total) * 100 : 0;
    const rankedGroups: ConcentrationGroup[] = groups.map((group) => ({
      name: group.name,
      share: share(group.value),
    }));
    const hhi = rankedGroups.reduce((sum, group) => sum + (group.share / 100) ** 2, 0);
    const topGroups = rankedGroups.slice(0, 3);

    return {
      year,
      topOneShare: topGroups[0]?.share || 0,
      topThreeShare: topGroups.reduce((sum, group) => sum + group.share, 0),
      leader: topGroups[0]?.name || "No leader",
      topGroups,
      recordCount: yearRecords.length,
      includedRecordCount: includedRecords.length,
      categoryCount: rankedGroups.length,
      effectiveCategories: hhi > 0 ? 1 / hhi : 0,
    };
  });
}

type NetworkNodeSeed = {
  label: string;
  institutionType: InstitutionType;
  recordIds: Set<string>;
  states: Set<string>;
};

type NetworkEdgeSeed = {
  sourceLabel: string;
  targetLabel: string;
  recordIds: Set<string>;
  evidence: Array<{
    recordId: string;
    relationship: string;
    detail: string;
    sourceUrl: string;
  }>;
};

function buildEcosystemNetwork(records: InvestmentRecord[]): NetworkGraphModel {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const nodeSeeds = new Map<string, NetworkNodeSeed>();
  const evidenceEdges = new Map<string, NetworkEdgeSeed>();

  records.forEach((record) => {
    const explicitRelationships = (record.institutionRelationships || [])
      .map((relationship) => ({
        source: relationship.source.trim(),
        target: relationship.target.trim(),
        relationship: relationship.relationship.trim() || "Direct relationship",
        detail: relationship.detail.trim() || "Named together as direct counterparties in the cited source.",
        sourceUrl: relationship.sourceUrl?.trim() || record.sourceUrl,
      }))
      .filter((relationship) => relationship.source && relationship.target && relationship.source !== relationship.target);
    const majorPlayers = [...new Set(
      [
        ...(((record as InvestmentRecord & { majorPlayers?: string[] }).majorPlayers || []).map((player) => player.trim())),
        ...explicitRelationships.flatMap((relationship) => [relationship.source, relationship.target]),
      ].filter(Boolean),
    )].sort((a, b) => a.localeCompare(b));

    majorPlayers.forEach((label) => {
      const node = nodeSeeds.get(label) || {
        label,
        institutionType: institutionTypeFor(label),
        recordIds: new Set<string>(),
        states: new Set<string>(),
      };
      node.recordIds.add(record.id);
      if (record.state) node.states.add(record.state);
      nodeSeeds.set(label, node);
    });

    const addEvidenceEdge = (
      firstLabel: string,
      secondLabel: string,
      relationship: string,
      detail: string,
      sourceUrl: string,
    ) => {
      const [sourceLabel, targetLabel] = [firstLabel, secondLabel].sort((a, b) => a.localeCompare(b));
      if (!sourceLabel || !targetLabel || sourceLabel === targetLabel) return;
      const key = `${sourceLabel}\u0000${targetLabel}`;
      const edge = evidenceEdges.get(key) || {
        sourceLabel,
        targetLabel,
        recordIds: new Set<string>(),
        evidence: [],
      };
      edge.recordIds.add(record.id);
      if (!edge.evidence.some((item) => item.recordId === record.id && item.relationship === relationship && item.detail === detail)) {
        edge.evidence.push({ recordId: record.id, relationship, detail, sourceUrl });
      }
      evidenceEdges.set(key, edge);
    };

    explicitRelationships.forEach((relationship) => {
      addEvidenceEdge(
        relationship.source,
        relationship.target,
        relationship.relationship,
        relationship.detail,
        relationship.sourceUrl,
      );
    });

    if (!explicitRelationships.length && majorPlayers.length === 2) {
      addEvidenceEdge(
        majorPlayers[0],
        majorPlayers[1],
        "Documented co-participation",
        `The cited announcement names both institutions in “${record.initiative}”.`,
        record.sourceUrl,
      );
    }
  });

  const labels = [...nodeSeeds.keys()].sort((a, b) => a.localeCompare(b));
  if (!labels.length) {
    return { clusters: [], nodes: [], edges: [], recordCount: records.length, recordsById };
  }

  const evidenceEdgeList = [...evidenceEdges.values()];
  const institutionTypeByLabel = new Map(labels.map((label) => [label, nodeSeeds.get(label)!.institutionType]));
  const positions = layoutInstitutionNetwork(labels, evidenceEdgeList, institutionTypeByLabel, nodeSeeds);
  const maximumRecordCount = Math.max(...labels.map((label) => nodeSeeds.get(label)!.recordIds.size));

  const nodes = labels.map<NetworkNode>((label) => {
    const seed = nodeSeeds.get(label)!;
    const position = positions.get(label)!;
    const institutionType = seed.institutionType;
    return {
      id: `institution:${label}`,
      label,
      clusterId: institutionType,
      clusterLabel: INSTITUTION_TYPE_LABELS[institutionType],
      institutionType,
      x: position.x,
      y: position.y,
      radius: networkNodeRadius(seed.recordIds.size, maximumRecordCount),
      recordCount: seed.recordIds.size,
      recordIds: [...seed.recordIds].sort(),
      states: [...seed.states].sort((a, b) => a.localeCompare(b)),
    };
  });
  const nodeByLabel = new Map(nodes.map((node) => [node.label, node]));

  const edges = evidenceEdgeList.flatMap<NetworkEdge>((edge, index) => {
    const source = nodeByLabel.get(edge.sourceLabel);
    const target = nodeByLabel.get(edge.targetLabel);
    if (!source || !target) return [];
    return [{
      id: `direct:${index}:${edge.sourceLabel}:${edge.targetLabel}`,
      source,
      target,
      weight: Math.max(1, edge.recordIds.size),
      recordIds: [...edge.recordIds].sort(),
      evidence: [...edge.evidence].sort((a, b) => a.recordId.localeCompare(b.recordId) || a.relationship.localeCompare(b.relationship)),
      path: buildNetworkEdgePath(source, target),
    }];
  });

  const typeGroups = new Map<InstitutionType, NetworkNode[]>();
  nodes.forEach((node) => typeGroups.set(node.institutionType, [...(typeGroups.get(node.institutionType) || []), node]));
  const clusters = NETWORK_INSTITUTION_TYPES.flatMap<NetworkCluster>((type) => {
    const members = typeGroups.get(type.id) || [];
    if (!members.length) return [];
      const recordIds = new Set(members.flatMap((node) => node.recordIds));
      return [{
        id: type.id,
        label: type.label,
        legendLabel: type.legendLabel,
        path: buildNetworkCommunityPath(members, type.id),
        fill: type.fill,
        stroke: type.stroke,
        recordCount: recordIds.size,
        nodeCount: members.length,
      }];
  });

  return { clusters, nodes, edges, recordCount: records.length, recordsById };
}

function layoutInstitutionNetwork(
  labels: string[],
  edges: NetworkEdgeSeed[],
  institutionTypeByLabel: Map<string, InstitutionType>,
  nodeSeeds: Map<string, NetworkNodeSeed>,
): Map<string, { x: number; y: number }> {
  const anchorShares: Record<InstitutionType, { x: number; y: number }> = {
    government: { x: 0.28, y: 0.57 },
    private: { x: 0.66, y: 0.61 },
    academic: { x: 0.38, y: 0.20 },
    ecosystem: { x: 0.70, y: 0.22 },
    multilateral: { x: 0.84, y: 0.38 },
  };
  const typeGroups = new Map<InstitutionType, string[]>();
  labels.forEach((label) => {
    const institutionType = institutionTypeByLabel.get(label) || "private";
    typeGroups.set(institutionType, [...(typeGroups.get(institutionType) || []), label]);
  });
  const maximumRecordCount = Math.max(...labels.map((label) => nodeSeeds.get(label)?.recordIds.size || 1));
  const radiusByLabel = new Map(labels.map((label) => [
    label,
    networkNodeRadius(nodeSeeds.get(label)?.recordIds.size || 1, maximumRecordCount),
  ]));
  const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  NETWORK_INSTITUTION_TYPES.forEach(({ id }) => {
    const members = typeGroups.get(id) || [];
    const anchor = anchorShares[id];
    members.sort((a, b) => (nodeSeeds.get(b)?.recordIds.size || 0) - (nodeSeeds.get(a)?.recordIds.size || 0) || a.localeCompare(b));
    members.forEach((label, index) => {
      const angle = index * 2.399963229728653 + stableNetworkUnit(label, 307) * 0.7;
      const radius = 9 + Math.sqrt(index) * 15;
      positions.set(label, {
        x: anchor.x * NETWORK_WIDTH + Math.cos(angle) * radius * (0.9 + stableNetworkUnit(label, 311) * 0.25),
        y: anchor.y * NETWORK_HEIGHT + Math.sin(angle) * radius * (0.68 + stableNetworkUnit(label, 313) * 0.22),
        vx: 0,
        vy: 0,
      });
    });
  });
  const edgeWeights = edges.map((edge) => ({
    ...edge,
    desired: institutionTypeByLabel.get(edge.sourceLabel) === institutionTypeByLabel.get(edge.targetLabel)
      ? 58
      : 108,
    strength: 0.009,
  }));
  const sortedLabels = [...labels].sort((a, b) => a.localeCompare(b));

  for (let iteration = 0; iteration < 210; iteration += 1) {
    const cooling = 1 - iteration / 250;
    for (let leftIndex = 0; leftIndex < sortedLabels.length; leftIndex += 1) {
      const leftLabel = sortedLabels[leftIndex];
      const left = positions.get(leftLabel)!;
      for (let rightIndex = leftIndex + 1; rightIndex < sortedLabels.length; rightIndex += 1) {
        const rightLabel = sortedLabels[rightIndex];
        const right = positions.get(rightLabel)!;
        let dx = right.x - left.x;
        let dy = right.y - left.y;
        if (Math.abs(dx) + Math.abs(dy) < 0.001) {
          dx = stableNetworkUnit(`${leftLabel}:${rightLabel}`, 331) - 0.5;
          dy = stableNetworkUnit(`${rightLabel}:${leftLabel}`, 337) - 0.5;
        }
        const distanceSquared = Math.max(20, dx * dx + dy * dy);
        const distance = Math.sqrt(distanceSquared);
        const repulsion = (275 / distanceSquared) * cooling;
        const forceX = (dx / distance) * repulsion;
        const forceY = (dy / distance) * repulsion;
        left.vx -= forceX;
        left.vy -= forceY;
        right.vx += forceX;
        right.vy += forceY;
        const collisionDistance = (radiusByLabel.get(leftLabel) || 4) + (radiusByLabel.get(rightLabel) || 4) + 2.5;
        if (distance < collisionDistance) {
          const collision = (collisionDistance - distance) * 0.055;
          left.vx -= (dx / distance) * collision;
          left.vy -= (dy / distance) * collision;
          right.vx += (dx / distance) * collision;
          right.vy += (dy / distance) * collision;
        }
      }
    }

    edgeWeights.forEach((edge) => {
      const source = positions.get(edge.sourceLabel)!;
      const target = positions.get(edge.targetLabel)!;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const spring = (distance - edge.desired) * edge.strength * cooling;
      const forceX = (dx / distance) * spring;
      const forceY = (dy / distance) * spring;
      source.vx += forceX;
      source.vy += forceY;
      target.vx -= forceX;
      target.vy -= forceY;
    });

    sortedLabels.forEach((label) => {
      const point = positions.get(label)!;
      const institutionType = institutionTypeByLabel.get(label) || "private";
      const anchor = anchorShares[institutionType];
      point.vx += (anchor.x * NETWORK_WIDTH - point.x) * 0.0022 * cooling;
      point.vy += (anchor.y * NETWORK_HEIGHT - point.y) * 0.0022 * cooling;
      point.vx += (NETWORK_WIDTH / 2 - point.x) * 0.0001;
      point.vy += (NETWORK_HEIGHT / 2 - point.y) * 0.0001;
      point.vx *= 0.82;
      point.vy *= 0.82;
      const boundary = (radiusByLabel.get(label) || 4) + 22;
      point.x = clampNumber(point.x + point.vx, boundary, NETWORK_WIDTH - boundary);
      point.y = clampNumber(point.y + point.vy, boundary, NETWORK_HEIGHT - boundary);
    });
  }

  return new Map([...positions.entries()].map(([label, point]) => [label, { x: point.x, y: point.y }]));
}

function networkNodeRadius(recordCount: number, maximumRecordCount: number): number {
  if (maximumRecordCount <= 1) return 5;
  return 4 + Math.sqrt((Math.max(1, recordCount) - 1) / (maximumRecordCount - 1)) * 9;
}

function networkInitiativeExcerpt(record: InvestmentRecord | undefined): string {
  const label = record?.initiative.trim() || "Cited announcement";
  return label.length > 58 ? `${label.slice(0, 55).trimEnd()}…` : label;
}

function conciseNetworkRelationship(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
  if (normalized.length <= 78) return normalized;
  const candidate = normalized.slice(0, 75);
  const clauseBoundary = Math.max(candidate.lastIndexOf(";"), candidate.lastIndexOf(","));
  const wordBoundary = candidate.lastIndexOf(" ");
  const boundary = clauseBoundary >= 52 ? clauseBoundary : wordBoundary;
  return `${candidate.slice(0, Math.max(52, boundary)).replace(/[,:;\s]+$/, "")}…`;
}

function buildNetworkCommunityPath(nodes: NetworkNode[], seed: string): string {
  if (nodes.length === 1) return buildNetworkBlobPath(nodes[0].x, nodes[0].y, 33, 28, seed);
  if (nodes.length === 2) {
    const centerX = (nodes[0].x + nodes[1].x) / 2;
    const centerY = (nodes[0].y + nodes[1].y) / 2;
    return buildNetworkBlobPath(centerX, centerY, Math.abs(nodes[0].x - nodes[1].x) / 2 + 32, Math.abs(nodes[0].y - nodes[1].y) / 2 + 30, seed);
  }
  const hull = convexNetworkHull(nodes.map((node) => ({ x: node.x, y: node.y })));
  const center = hull.reduce((sum, point) => ({ x: sum.x + point.x / hull.length, y: sum.y + point.y / hull.length }), { x: 0, y: 0 });
  const expanded = hull.map((point, index) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const padding = 22 + stableNetworkUnit(seed, index + 401) * 9;
    return { x: point.x + (dx / distance) * padding, y: point.y + (dy / distance) * padding };
  });
  const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = midpoint(expanded[expanded.length - 1], expanded[0]);
  const segments = expanded.map((point, index) => {
    const end = midpoint(point, expanded[(index + 1) % expanded.length]);
    return `Q ${point.x.toFixed(1)} ${point.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  });
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} ${segments.join(" ")} Z`;
}

function convexNetworkHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (origin: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const lower: Array<{ x: number; y: number }> = [];
  sorted.forEach((point) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  });
  const upper: Array<{ x: number; y: number }> = [];
  [...sorted].reverse().forEach((point) => {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  });
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function groupRecordsBy(records: InvestmentRecord[], getKey: (record: InvestmentRecord) => string) {
  const groups = new Map<string, InvestmentRecord[]>();
  records.forEach((record) => {
    const key = getKey(record);
    groups.set(key, [...(groups.get(key) || []), record]);
  });
  return [...groups.entries()].map(([name, group]) => ({ name, records: group }));
}

function buildNetworkBlobPath(cx: number, cy: number, rx: number, ry: number, seed: string): string {
  const pointCount = 13;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const angle = -Math.PI / 2 + (index / pointCount) * Math.PI * 2;
    const variance = 0.88 + stableNetworkUnit(seed, index + 31) * 0.24;
    return {
      x: cx + Math.cos(angle) * (rx + 18) * variance,
      y: cy + Math.sin(angle) * (ry + 15) * variance,
    };
  });
  const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const start = midpoint(points[points.length - 1], points[0]);
  const segments = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const end = midpoint(point, next);
    return `Q ${point.x.toFixed(1)} ${point.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  });
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} ${segments.join(" ")} Z`;
}

function buildNetworkEdgePath(source: NetworkNode, target: NetworkNode): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const bendDirection = stableNetworkUnit(`${source.label}:${target.label}`, 71) > 0.5 ? 1 : -1;
  const bend = Math.min(34, distance * (source.clusterId === target.clusterId ? 0.045 : 0.11)) * bendDirection;
  const controlX = (source.x + target.x) / 2 - (dy / distance) * bend;
  const controlY = (source.y + target.y) / 2 + (dx / distance) * bend;
  return `M ${source.x.toFixed(1)} ${source.y.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${target.x.toFixed(1)} ${target.y.toFixed(1)}`;
}

function stableNetworkUnit(value: string, salt: number): number {
  let hash = (2166136261 ^ salt) >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function buildAnalystResponse(query: string, records: InvestmentRecord[], metric: MetricMode): AnalystResponse {
  const scopedRecords = records;
  if (!scopedRecords.length) {
    return {
      answer: "There are no records in the source dataset, so the analyst view cannot compute an answer yet.",
      evidence: ["0 records available", "No chartable commitment value in the source dataset"],
      followUp: "Reload the source dataset, then ask again.",
    };
  }

  const normalizedQuery = normalizeText(query);
  const stateGroups = groupByConvertedMetric(scopedRecords, metric, (record) => record.state);
  const capabilityGroups = groupByConvertedMetric(scopedRecords, metric, (record) => record.capability);
  const industryGroups = groupByConvertedMetric(scopedRecords, metric, (record) => record.industry);
  const yearGroups = groupByConvertedMetric(scopedRecords, metric, (record) => String(record.year)).sort((a, b) => Number(a.name) - Number(b.name));
  const totalValue = scopedRecords.reduce((sum, record) => sum + convertedValueForMetric(record, metric), 0);
  const chartableCount = scopedRecords.filter((record) => convertedValueForMetric(record, metric) > 0).length;
  const largest = scopedRecords
    .filter((record) => convertedValueForMetric(record, metric) > 0)
    .slice()
    .sort((a, b) => convertedValueForMetric(b, metric) - convertedValueForMetric(a, metric))[0];

  const matchedState = findNamedAnalystGroup(normalizedQuery, stateGroups);
  const matchedCapability = findNamedAnalystGroup(normalizedQuery, capabilityGroups);
  const matchedIndustry = findNamedAnalystGroup(normalizedQuery, industryGroups);

  if (matchedState) {
    const topCapability = groupByConvertedMetric(matchedState.records, metric, (record) => record.capability)[0];
    const topOrganization = groupByConvertedMetric(matchedState.records, "records", (record) => record.organization)[0];
    return {
      answer: `${matchedState.name} has ${formatMetricValue(matchedState.value, metric)} in full-dataset commitments across ${matchedState.records.length} source-backed announcements. Its strongest capability signal is ${topCapability?.name || "not available"}.`,
      evidence: [
        `${formatShare(matchedState.value, totalValue)} of full-dataset ${metricLabel(metric)}`,
        topOrganization ? `${topOrganization.name} appears in ${topOrganization.records.length} announcement${topOrganization.records.length === 1 ? "" : "s"}` : "No organization concentration found",
      ],
      followUp: `Try asking "what is driving ${matchedState.name}?" or focus the state from the buttons below.`,
    };
  }

  if (matchedCapability) {
    const leadingState = groupByConvertedMetric(matchedCapability.records, metric, (record) => record.state)[0];
    return {
      answer: `${matchedCapability.name} accounts for ${formatMetricValue(matchedCapability.value, metric)} across ${matchedCapability.records.length} announcements. ${leadingState ? `${leadingState.name} is the leading state within this capability.` : "No single state leads inside this capability."}`,
      evidence: [
        `${formatShare(matchedCapability.value, totalValue)} of full-dataset ${metricLabel(metric)}`,
        `${matchedCapability.records.length} announcements tagged to this capability`,
      ],
      followUp: "Click the matching capability action below to turn this answer into a dashboard focus.",
    };
  }

  if (matchedIndustry) {
    const leadingCapability = groupByConvertedMetric(matchedIndustry.records, metric, (record) => record.capability)[0];
    return {
      answer: `${industryLabel(matchedIndustry.name)} represents ${formatMetricValue(matchedIndustry.value, metric)} in the full dataset. ${leadingCapability ? `${leadingCapability.name} is the strongest capability inside that industry group.` : "The records are spread across multiple capabilities."}`,
      evidence: [
        `${formatShare(matchedIndustry.value, totalValue)} of full-dataset ${metricLabel(metric)}`,
        `${matchedIndustry.records.length} announcements in this industry domain`,
      ],
      followUp: "Use the industry focus action below to inspect the related announcements.",
    };
  }

  if (normalizedQuery.includes("largest") || normalizedQuery.includes("biggest") || normalizedQuery.includes("company") || normalizedQuery.includes("organization")) {
    return {
      answer: largest
        ? `${largest.organization} is the largest single chartable row in the full dataset, with ${formatMetricValue(convertedValueForMetric(largest, metric), metric)} linked to ${largest.initiative}.`
        : "There is no chartable single-row commitment for the active metric in the full dataset.",
      evidence: largest
        ? [`${largest.state}, ${largest.year}`, `${industryLabel(largest.industry)} / ${largest.capability}`]
        : ["No row has a parsed chartable amount", `${scopedRecords.length} source-backed records in the full dataset`],
      followUp: "Ask about a state, industry, or capability to see what is behind the largest-row signal.",
    };
  }

  if (normalizedQuery.includes("year") || normalizedQuery.includes("trend") || normalizedQuery.includes("latest")) {
    const latest = yearGroups[yearGroups.length - 1];
    const previous = yearGroups[yearGroups.length - 2];
    const direction = latest && previous ? latest.value - previous.value : 0;
    return {
      answer: latest
        ? `${latest.name} is the latest year in the full dataset, with ${formatMetricValue(latest.value, metric)} in commitments. ${previous ? `That is ${direction >= 0 ? "higher" : "lower"} than ${previous.name}.` : "There is no prior year in the dataset for comparison."}`
        : "No year-level comparison is available in the full dataset.",
      evidence: latest ? [`${latest.records.length} announcements in ${latest.name}`, previous ? `${formatMetricValue(previous.value, metric)} in ${previous.name}` : "Single-year dataset"] : ["No years in dataset"],
      followUp: "Use the Year filter to isolate a particular policy window.",
    };
  }

  if (normalizedQuery.includes("capability")) {
    return analystRankingResponse("capabilities", capabilityGroups, totalValue, metric);
  }

  if (normalizedQuery.includes("industry")) {
    return analystRankingResponse("industries", industryGroups, totalValue, metric);
  }

  if (normalizedQuery.includes("state")) {
    return analystRankingResponse("states", stateGroups, totalValue, metric);
  }

  const topState = stateGroups[0];
  const topCapability = capabilityGroups[0];
  const topIndustry = industryGroups[0];
  return {
    answer: topState && topCapability
      ? `The main signal is concentration: ${topState.name} leads the state view, while ${topCapability.name} is the strongest capability. The full dataset contains ${formatMetricValue(totalValue, metric)} across ${chartableCount} chartable announcements.`
      : `The full dataset contains ${scopedRecords.length} source-backed announcements. Ask about a state, industry, capability, year, or largest commitment for a sharper answer.`,
    evidence: [
      topState ? `Top state: ${topState.name} at ${formatMetricValue(topState.value, metric)}` : "No state ranking available",
      topIndustry ? `Top industry: ${industryLabel(topIndustry.name)} at ${formatMetricValue(topIndustry.value, metric)}` : "No industry ranking available",
      topCapability ? `Top capability: ${topCapability.name} at ${formatMetricValue(topCapability.value, metric)}` : "No capability ranking available",
    ],
    followUp: "Ask a follow-up about a state, industry, capability, year, or largest commitment.",
  };
}

function analystRankingResponse(label: "states" | "capabilities" | "industries", groups: ChartDatum[], totalValue: number, metric: MetricMode): AnalystResponse {
  const topFive = groups.slice(0, 5);
  const leader = topFive[0];
  const singularLabel = label === "states" ? "state" : label === "capabilities" ? "capability" : "industry";
  return {
    answer: leader
      ? `The leading ${singularLabel} is ${label === "industries" ? industryLabel(leader.name) : leader.name}, with ${formatMetricValue(leader.value, metric)} in full-dataset commitments. The top five ${label} together account for ${formatShare(topFive.reduce((sum, item) => sum + item.value, 0), totalValue)} of the full dataset.`
      : `No ${label} ranking is available in the full dataset.`,
    evidence: topFive.map((item, index) => `${index + 1}. ${label === "industries" ? industryLabel(item.name) : item.name}: ${formatMetricValue(item.value, metric)}`),
    followUp: `Browse the top-five ${label} chart or ask about one by name.`,
  };
}

function findNamedAnalystGroup(query: string, groups: ChartDatum[]): ChartDatum | undefined {
  if (!query) return undefined;
  return groups.find((group) => {
    const normalizedName = normalizeText(group.name);
    return query.includes(normalizedName) || normalizedName.split(/\s+/).filter(Boolean).every((term) => query.includes(term));
  });
}

function buildEditorialInsights(records: InvestmentRecord[], metric: MetricMode): EditorialInsight[] {
  if (!records.length) return [];

  const stateGroups = groupByConvertedMetric(records, metric, (record) => record.state);
  const capabilityGroups = groupByConvertedMetric(records, metric, (record) => record.capability);
  const domainGroups = groupByConvertedMetric(records, metric, (record) => record.industry);
  const sectorTypeGroups = domainGroups.map((group) => ({ ...group, name: industryLabel(group.name) }));
  const totalValue = records.reduce((sum, record) => sum + convertedValueForMetric(record, metric), 0);
  const largest = records
    .filter((record) => convertedValueForMetric(record, metric) > 0)
    .slice()
    .sort((a, b) => convertedValueForMetric(b, metric) - convertedValueForMetric(a, metric))[0];
  const yearGroups = groupByConvertedMetric(records, metric, (record) => String(record.year)).sort(
    (a, b) => Number(a.name) - Number(b.name),
  );
  const latestYear = yearGroups[yearGroups.length - 1];
  const previousYear = yearGroups[yearGroups.length - 2];
  const topState = stateGroups[0];
  const topCapability = capabilityGroups[0];
  const topSectorType = sectorTypeGroups[0];
  const topThreeStates = stateGroups.slice(0, 3);
  const topThreeValue = topThreeStates.reduce((sum, state) => sum + state.value, 0);
  const largestInitiative = largest?.initiative.replace(/\s*[.!?]+$/g, "");

  return [
    {
      eyebrow: "State concentration",
      title: topState ? `${topState.name} is the main state anchor` : "State activity is distributed across India",
      body: topState
        ? `${topState.name} carries ${formatShare(topState.value, totalValue)} of visible commitments; the top three carry ${formatShare(topThreeValue, totalValue)}.`
        : "State-level commitments span policy, infrastructure, and applied AI.",
      stat: topState ? formatMetricValue(topState.value, metric) : formatCompact(records.length),
      statLabel: topState ? `${metricLabel(metric)} in the leading state` : "source-backed announcements",
      actionLabel: topState ? `Read ${topState.name}` : "Explore states",
      href: topState ? `/states/${slugify(topState.name)}` : "/#charts",
      bars: stateGroups.slice(0, 5),
    },
    {
      eyebrow: "Capability focus",
      title: topCapability ? `${topCapability.name} leads capability focus` : "Capability concentration shows policy energy",
      body: topCapability
        ? `${topCapability.records.length} announcements sit in this cluster, turning policy intent into visible capacity.`
        : "The ranking chart compares the most active capability domains.",
      stat: topCapability ? formatMetricValue(topCapability.value, metric) : "-",
      statLabel: topCapability ? `${metricLabel(metric)} tracked in the capability` : "no active capability",
      actionLabel: topCapability ? `Read ${topCapability.name}` : "Open ranking",
      href: topCapability ? `/sectors/${slugify(topCapability.name)}` : "/#charts",
      bars: capabilityGroups.slice(0, 5),
    },
    {
      eyebrow: "Latest-year surge",
      title: latestYear ? `${latestYear.name} dominates the current ledger` : "Recent commitments are accelerating",
      body: latestYear
        ? `${latestYear.name} accounts for ${formatShare(latestYear.value, totalValue)} of visible commitments${previousYear ? `, up from ${formatShare(previousYear.value, totalValue)} in ${previousYear.name}` : ""}.`
        : "The latest source-backed announcements show how investment momentum is changing over time.",
      stat: latestYear ? formatShare(latestYear.value, totalValue) : "-",
      statLabel: latestYear ? `${metricLabel(metric)} recorded in ${latestYear.name}` : "latest-year share",
      actionLabel: latestYear ? `Explore ${latestYear.name}` : "Explore investments",
      href: latestYear ? `/investments/${latestYear.name}` : "/#charts",
      bars: yearGroups,
    },
    {
      eyebrow: "Largest commitment",
      title: largest ? `${largest.organization} sets the upper bound` : "Largest announcement",
      body: largest
        ? `${largestInitiative} anchors the top end of the ledger in ${industryLabel(largest.industry)}.`
        : "No chartable announcement is available for this metric.",
      stat: largest ? formatMetricValue(convertedValueForMetric(largest, metric), metric) : "-",
      statLabel: largest ? `${metricLabel(metric)} from one source-backed row` : "no source-backed value",
      actionLabel: largest ? `Read ${largest.organization}` : "Open sources",
      href: largest ? `/companies/${slugify(largest.organization)}` : "/#evidence",
      bars: topSectorType ? sectorTypeGroups.slice(0, 5) : [],
    },
  ];
}

function buildExplorerCards(records: InvestmentRecord[], topicIndex: ReturnType<typeof buildTopicIndex>): ExplorerCard[] {
  const scalePreview = records
    .filter((record) => record.amount.chartable)
    .map((record) => ({
      name: record.organization,
      value: convertedValueForMetric(record, "inr"),
      records: [record],
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, 5);

  return [
    {
      id: "state-comparison",
      eyebrow: "State Lens",
      title: "State Comparison",
      body: "Compare commitment scale across every covered state and see where activity is concentrated.",
      detail: `${topicIndex.states.length} state pages`,
      actionLabel: "Open state view",
      action: { kind: "chart", value: "state-comparison", scope: "all" },
      preview: "bars",
      previewData: topicIndex.states.slice(0, 5),
    },
    {
      id: "ecosystem-network",
      eyebrow: "Institution Web",
      title: "Institution Network",
      body: "Trace source-backed connections among public agencies, private firms, research bodies, and ecosystem partners.",
      detail: `${topicIndex.institutions.length} institutions · ${topicIndex.coverage.relationships} direct links`,
      actionLabel: "Open the network",
      action: { kind: "chart", value: "ecosystem-network", scope: "all" },
      preview: "network",
      previewData: [],
    },
    {
      id: "industry-ranking",
      eyebrow: "Industry Pulse",
      title: "Industry Ranking",
      body: "Rank the sectors receiving the strongest commitment signals and compare the breadth of activity.",
      detail: `${topicIndex.industries.length} industry pages`,
      actionLabel: "Open industry view",
      action: { kind: "chart", value: "industry-ranking", scope: "all" },
      preview: "bars",
      previewData: topicIndex.industries.slice(0, 5),
    },
    {
      id: "concentration-trend",
      eyebrow: "Portfolio Shape",
      title: "Concentration Trajectory",
      body: "See who leads, what the top three hold, and how evenly activity is shared.",
      detail: `${topicIndex.coverage.yearRange} · disclosed commitments`,
      actionLabel: "Open trend view",
      action: { kind: "chart", value: "concentration-trend", scope: "all" },
      preview: "timeline",
      previewData: topicIndex.years,
    },
    {
      id: "investment-scatter",
      eyebrow: "Scale Map",
      title: "Investment Scale Scatter",
      body: "Find the largest announcements, year clusters, and the long tail of smaller commitments.",
      detail: `${topicIndex.coverage.chartableAnnouncements} chartable announcements`,
      actionLabel: "Open scale view",
      action: { kind: "chart", value: "investment-scatter", scope: "all" },
      preview: "records",
      previewData: scalePreview,
    },
  ];
}

function buildTopicIndex(records: InvestmentRecord[]) {
  const states = groupByConvertedMetric(records, "records", (record) => record.state);
  const industries = groupByConvertedMetric(records, "records", (record) => record.industry);
  const capabilities = groupByConvertedMetric(records, "records", (record) => record.capability);
  const institutions = buildInstitutionTopicIndex(records);
  const years = groupByConvertedMetric(records, "records", (record) => String(record.year))
    .sort((a, b) => Number(a.name) - Number(b.name));
  const yearRange = years.length ? `${years[0].name}–${years[years.length - 1].name}` : "No years";

  return {
    states,
    industries,
    capabilities,
    institutions,
    years,
    coverage: {
      announcements: records.length,
      chartableAnnouncements: records.filter((record) => record.amount.chartable).length,
      relationships: records.reduce((sum, record) => sum + (record.institutionRelationships?.length || 0), 0),
      yearRange,
    },
  };
}

function buildInstitutionTopicIndex(records: InvestmentRecord[]): ChartDatum[] {
  const groups = new Map<string, { name: string; records: Map<string, InvestmentRecord> }>();

  records.forEach((record) => {
    const labels = record.majorPlayers.length ? record.majorPlayers : [record.organization];
    const seenRecordInstitutions = new Set<string>();
    labels.forEach((rawLabel) => {
      const name = rawLabel.trim();
      const key = slugify(name);
      if (!name || !key || seenRecordInstitutions.has(key)) return;
      seenRecordInstitutions.add(key);
      const group = groups.get(key) || { name, records: new Map<string, InvestmentRecord>() };
      group.records.set(record.id, record);
      groups.set(key, group);
    });
  });

  return [...groups.values()]
    .map((group) => {
      const groupRecords = [...group.records.values()];
      return { name: group.name, value: groupRecords.length, records: groupRecords };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

function buildCharts(records: InvestmentRecord[], metric: MetricMode) {
  const capabilities = groupByConvertedMetric(records, metric, (record) => record.capability);
  const industries = groupByConvertedMetric(records, metric, (record) => record.industry);
  const years = groupByConvertedMetric(records, metric, (record) => String(record.year)).sort((a, b) => Number(a.name) - Number(b.name));
  const heatmapStates = groupByConvertedMetric(records, metric, (record) => record.state)
    .map((state) => state.name);
  const heatmapCapabilities = groupByConvertedMetric(records, "records", (record) => record.capability)
    .map((capability) => capability.name);
  const heatmapRaw = heatmapStates.flatMap((state) =>
    heatmapCapabilities.map((capability) => {
      const cellRecords = records.filter((record) => record.state === state && record.capability === capability);
      return {
        state,
        capability,
        records: cellRecords,
        value: cellRecords.reduce((sum, record) => sum + convertedValueForMetric(record, metric), 0),
      };
    }),
  );
  const heatmapMax = Math.max(1, ...heatmapRaw.map((cell) => cell.value));
  const heatmap = heatmapRaw.map((cell) => ({
    ...cell,
    intensity: Math.round((cell.value / heatmapMax) * 100),
  }));
  const rawScatter = records
    .filter((record) => record.amount.chartable)
    .map((record) => {
      const amount = convertedValueForMetric(record, metric);
      return {
        id: record.id,
        year: record.year,
        amount,
        plotYear: record.year,
        plotAmount: amount,
        size: amount,
        state: record.state,
        organization: record.organization,
        industry: record.industry,
        capability: record.capability,
        currency: metric === "usd" ? "USD" as const : "INR" as const,
      };
    })
    .sort((a, b) => b.amount - a.amount || a.organization.localeCompare(b.organization));
  const { scatter, scatterDomain } = spreadScatterPoints(rawScatter);

  return {
    capabilities,
    industries,
    years,
    heatmap,
    heatmapStates,
    heatmapCapabilities,
    scatter,
    scatterDomain,
  };
}

function spreadScatterPoints(points: ScatterDatum[]) {
  if (!points.length) {
    return {
      scatter: points,
      scatterDomain: {
        x: [0, 1] as [number, number],
        y: [0, 1] as [number, number],
        sizeRange: [8, 24] as [number, number],
      },
    };
  }

  const amounts = points.map((point) => point.amount);
  const years = points.map((point) => point.year);
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);
  const amountRange = Math.max(1, maxAmount - minAmount);
  const yearGroups = new Map<number, ScatterDatum[]>();

  points.forEach((point) => {
    yearGroups.set(point.year, [...(yearGroups.get(point.year) || []), point]);
  });

  const largestYearCluster = Math.max(1, ...[...yearGroups.values()].map((group) => group.length));
  const yearSpread = Math.min(0.36, 0.08 + Math.sqrt(largestYearCluster) * 0.055);
  const amountSpread = Math.max(amountRange * 0.09, maxAmount * 0.025, 1);
  const sortedByYear = new Map(
    [...yearGroups.entries()].map(([year, group]) => [
      year,
      group.slice().sort((a, b) => a.amount - b.amount || a.organization.localeCompare(b.organization)),
    ]),
  );

  const scatter = points.map((point) => {
    const group = sortedByYear.get(point.year) || [point];
    const index = group.findIndex((item) => item.id === point.id);
    const centeredIndex = group.length <= 1 ? 0 : index / (group.length - 1) - 0.5;
    const alternatingLift = group.length <= 1 ? 0 : ((index % 3) - 1) * amountSpread * 0.18;
    return {
      ...point,
      plotYear: point.year + centeredIndex * yearSpread * 2,
      plotAmount: Math.max(0, point.amount + centeredIndex * amountSpread + alternatingLift),
    };
  });

  const plotYears = scatter.map((point) => point.plotYear);
  const plotAmounts = scatter.map((point) => point.plotAmount);
  const xPadding = Math.max(0.45, yearSpread + 0.18);
  const yPadding = Math.max(amountRange * 0.14, maxAmount * 0.06, 1);
  const density = scatter.length;

  return {
    scatter,
    scatterDomain: {
      x: [Math.min(...plotYears) - xPadding, Math.max(...plotYears) + xPadding] as [number, number],
      y: [Math.max(0, Math.min(...plotAmounts) - yPadding), Math.max(...plotAmounts) + yPadding] as [number, number],
      sizeRange: [
        density > 36 ? 7 : density > 20 ? 8 : 10,
        density > 36 ? 22 : density > 20 ? 26 : 30,
      ] as [number, number],
    },
  };
}

function buildStateSummaries(records: InvestmentRecord[]): StateSummary[] {
  return uniqueSorted(records.map((record) => record.state)).map((state) => buildStateSummary(state, records.filter((record) => record.state === state)));
}

function buildStateSummary(state: string, records: InvestmentRecord[]): StateSummary {
  const inr = records.reduce((sum, record) => sum + convertedValueForMetric(record, "inr"), 0);
  const usd = records.reduce((sum, record) => sum + convertedValueForMetric(record, "usd"), 0);
  const capabilities = uniqueSorted(records.map((record) => record.capability));
  const count = records.length;
  return {
    name: state,
    count,
    inr,
    usd,
    capabilities,
    color: stateColor(state),
    intensity: Math.max(18, Math.min(100, Math.round((count / 28) * 100))),
    records,
  };
}

function buildPortfolioBreadth(records: InvestmentRecord[]) {
  return uniqueSorted(records.map((record) => record.state))
    .map((state) => {
      const stateRecords = records.filter((record) => record.state === state);
      const sectors = uniqueSorted(stateRecords.map((record) => record.capability));
      return {
        state,
        sectorCount: sectors.length,
        records: stateRecords,
      };
    })
    .sort((a, b) => b.sectorCount - a.sectorCount || b.records.length - a.records.length || a.state.localeCompare(b.state));
}

function formatShare(value: number | undefined, total: number): string {
  if (!value || total <= 0) return "0%";
  const share = (value / total) * 100;
  if (share > 0 && share < 1) return "<1%";
  return `${Math.round(share)}%`;
}

function buildHighlights(records: InvestmentRecord[], metric: MetricMode) {
  const years = [...new Set(records.map((record) => record.year))].sort((a, b) => a - b);
  const latestYear = years[years.length - 1];
  const previousYear = years[years.length - 2];
  const latestValue = records
    .filter((record) => record.year === latestYear)
    .reduce((sum, record) => sum + convertedValueForMetric(record, metric), 0);
  const previousValue = records
    .filter((record) => record.year === previousYear)
    .reduce((sum, record) => sum + convertedValueForMetric(record, metric), 0);
  const movement = previousValue ? Math.round(((latestValue - previousValue) / previousValue) * 100) : 0;
  const totalCommitments = records.reduce((sum, record) => sum + convertedValueForMetric(record, metric), 0);
  const chartableRecords = records.filter((record) => record.amount.chartable);
  const states = uniqueSorted(records.map((record) => record.state));
  const organizations = uniqueSorted(records.map((record) => record.organization));
  const sectors = uniqueSorted(records.map((record) => record.capability));
  const publishers = uniqueSorted(records.map((record) => sourcePublisher(record.sourceUrl)));
  const yearRange = years.length ? `${years[0]}-${years[years.length - 1]}` : "No years";

  return {
    totalCommitments: {
      value: formatMetricValue(totalCommitments, metric),
      detail: `${chartableRecords.length} chartable announcements`,
    },
    trendMovement: {
      value: latestYear ? `${latestYear}` : "-",
      detail: previousYear
        ? `${formatMetricValue(latestValue, metric)} vs ${formatMetricValue(previousValue, metric)} in ${previousYear}; ${movement >= 0 ? "up" : "down"} ${Math.abs(movement)}%`
        : "Single-year view",
    },
    recordsTracked: {
      value: formatCompact(records.length),
      detail: `${organizations.length} organizations across ${sectors.length} sectors`,
    },
    stateCoverage: {
      value: formatCompact(states.length),
      detail: `${yearRange} coverage in the active ledger`,
    },
    sourceBase: {
      value: formatCompact(publishers.length),
      detail: `publishers cited across ${records.length} records`,
    },
  };
}

function matchesSearch(record: InvestmentRecord, query: string): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  const categoryAliases = categorySearchAliases(normalizedQuery);
  if (categoryAliases.length) {
    const categoryHaystack = normalizeText([record.industry, record.capability].join(" "));
    return categoryAliases.some((alias) => categoryHaystack.includes(alias) || alias.includes(categoryHaystack));
  }

  const haystack = normalizeText(
    [
      record.year,
      record.state,
      record.location,
      record.organization,
      (record as InvestmentRecord & { majorPlayers?: string[] }).majorPlayers?.join(" ") || "",
      record.initiative,
      record.industry,
      record.capability,
      record.investmentDomain,
      record.investmentBrought,
      record.investmentType,
      record.technologyUse,
      record.sourceSummary,
    ].join(" "),
  );
  if (haystack.includes(normalizedQuery)) return true;
  const terms = normalizedQuery.split(/\s+/).filter((term) => term.length > 1);
  const matched = terms.filter((term) => searchAliases(term).some((alias) => haystack.includes(alias)));
  return matched.length >= Math.max(1, Math.ceil(terms.length * 0.65));
}

function categorySearchAliases(query: string): string[] {
  const categoryLabels = [
    "AI Applications",
    "AI Research & Innovation",
    "AI Strategy & Governance",
    "AI Talent & Skilling",
    "Agriculture",
    "Automation & Enterprise Tech",
    "Capability Domain",
    "Cloud & Compute",
    "Data Infrastructure",
    "Defence",
    "Digital Public Infrastructure",
    "Finance",
    "Government",
    "Healthcare",
    "Industry Domain",
    "Manufacturing",
    "Retail & Commerce",
    "Semiconductor & Electronics",
    "Startup & Innovation Ecosystem",
    "Transportation",
  ];
  const queryTerms = query.split(/\s+/).filter((term) => term.length > 1);
  const matches = categoryLabels
    .map((label) => ({ label: normalizeText(label), terms: normalizeText(label).split(/\s+/).filter((term) => term.length > 1) }))
    .filter(({ label, terms }) => {
      if (query === label) return true;
      if (queryTerms.length === 1) return terms.includes(queryTerms[0]);
      return queryTerms.length > 1 && queryTerms.every((term) => terms.includes(term));
    });
  return matches.length === 1 ? [matches[0].label] : [];
}

function normalizeText(value: string): string {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/data\s*-?\s*cent(?:re|er)s?/g, "data centre")
    .replace(/datacent(?:re|er)s?/g, "data centre")
    .replace(/co\s*-?\s*e/g, "coe")
    .replace(/ai\/ml/g, "ai ml")
    .replace(/it\/ites/g, "it ites")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchAliases(term: string): string[] {
  const aliases: Record<string, string[]> = {
    ai: ["ai", "artificial intelligence", "machine learning", "ml"],
    agri: ["agri", "agriculture", "farm", "farmer", "crop"],
    bangalore: ["bangalore", "bengaluru"],
    bengaluru: ["bengaluru", "bangalore"],
    centre: ["centre", "center", "coe", "hub", "facility"],
    center: ["center", "centre", "coe", "hub", "facility"],
    cloud: ["cloud", "data centre", "digital infrastructure"],
    compute: ["compute", "computing", "cloud", "data centre", "digital infrastructure"],
    datacenter: ["data centre", "data center", "datacenter"],
    govt: ["government", "govt", "public", "cabinet", "department"],
    government: ["government", "govt", "public", "cabinet", "department"],
    healthcare: ["healthcare", "health", "medical", "hospital", "diagnosis"],
    infra: ["infrastructure", "infra", "data centre", "cloud", "digital"],
    startup: ["startup", "start up", "incubation", "ecosystem"],
    surveillance: ["surveillance", "cctv", "camera", "anpr", "police"],
  };
  const fallback = term.length > 3 && term.endsWith("s") ? [term, term.slice(0, -1)] : [term];
  return [...new Set([...(aliases[term] || fallback), ...fallback])].map(normalizeText).filter(Boolean);
}

function sortRecords(records: InvestmentRecord[], sortKey: SortKey, direction: SortDirection): InvestmentRecord[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return records.slice().sort((a, b) => {
    let result = 0;
    if (sortKey === "year") result = a.year - b.year;
    if (sortKey === "state") result = a.state.localeCompare(b.state);
    if (sortKey === "organization") result = a.organization.localeCompare(b.organization);
    if (sortKey === "industry") result = a.industry.localeCompare(b.industry) || a.capability.localeCompare(b.capability);
    if (sortKey === "capability") result = a.capability.localeCompare(b.capability);
    if (sortKey === "amount") result = nativeAmountValue(a) - nativeAmountValue(b);
    return result * multiplier || a.organization.localeCompare(b.organization);
  });
}

function nativeAmountValue(record: InvestmentRecord): number {
  if (record.amount.currency === "INR") return record.amount.croreValue || 0;
  if (record.amount.currency === "USD") return record.amount.usdMillionValue || 0;
  return 0;
}

function currencyLabel(record: InvestmentRecord): string {
  return record.amount.currency || "";
}

function stateFill(state: string, selectedState: string | null, value: number, maxValue: number): string {
  const base = stateColor(state);
  return state === selectedState ? base : mixWithWhite(base, 0.18);
}

function stateColor(state: string, fallbackIndex?: number): string {
  const seed = fallbackIndex ?? [...state].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return DOMAIN_COLORS[Math.abs(seed) % DOMAIN_COLORS.length];
}

function mixWithWhite(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const mix = (value: number) => Math.round(value + (255 - value) * amount);
  return `rgb(${mix(red)}, ${mix(green)}, ${mix(blue)})`;
}
