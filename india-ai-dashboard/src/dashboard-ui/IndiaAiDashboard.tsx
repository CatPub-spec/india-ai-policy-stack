"use client";

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
  Menu,
  MapPinned,
  Search,
  Sparkles,
} from "lucide-react";
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
import { slugify } from "../lib/slugs";
import {
  type ChartDatum,
  type CurrencyCode,
  type DashboardDataset,
  type InvestmentRecord,
  type MetricMode,
  formatCompact,
  formatMetricValue,
  metricLabel,
  uniqueSorted,
} from "../dashboard-data/investmentDataset";

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
type TrendDimension = "industry" | "capability";
type ChartViewId = "state-comparison" | "industry-ranking" | "concentration-trend" | "investment-scatter";

type ConcentrationPoint = {
  year: number;
  topOneShare: number;
  topThreeShare: number;
  leader: string;
  topThree: string[];
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
  | { kind: "chart"; value: string };

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
  eyebrow: string;
  title: string;
  body: string;
  detail: string;
  chartId: string;
};

type HeroStateNode = {
  state: string;
  label: string;
  x: string;
  y: string;
  color: string;
  delay: string;
};

const EMPTY_FILTERS: FilterState = {
  states: [],
  years: [],
  industries: [],
  capabilities: [],
  disclosure: null,
  search: "",
};

const CHART_VIEW_IDS: ChartViewId[] = ["state-comparison", "industry-ranking", "concentration-trend", "investment-scatter"];

const CHART_VIEW_LABELS: Record<ChartViewId, string> = {
  "state-comparison": "State Comparison",
  "industry-ranking": "Industry Ranking",
  "concentration-trend": "Concentration Trajectory",
  "investment-scatter": "Investment Scale Scatter",
};

const CURRENCY_OPTIONS: Array<{ value: MetricMode; label: string }> = [
  { value: "inr", label: "INR" },
  { value: "usd", label: "USD" },
];

const USD_MILLION_TO_INR_CRORE = 8.3;

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
  const concentrationTrendRecords = useMemo(
    () => applyFilters(records, { ...filters, years: [] }),
    [filters, records],
  );
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
  const kpis = useMemo(() => buildKpis(filteredRecords, metric), [filteredRecords, metric]);
  const highlights = useMemo(() => buildHighlights(filteredRecords, metric), [filteredRecords, metric]);
  const editorialInsights = useMemo(() => buildEditorialInsights(records, metric), [records, metric]);
  const explorerCards = useMemo(() => buildExplorerCards(records), [records]);
  const topicIndex = useMemo(() => buildTopicIndex(records), [records]);
  const selectedRecords = useMemo(
    () => (selectedState ? filteredRecords.filter((record) => record.state === selectedState) : filteredRecords),
    [filteredRecords, selectedState],
  );
  const selectedSummary = useMemo(
    () => buildStateSummary(selectedState || "All States", selectedRecords),
    [selectedRecords, selectedState],
  );
  const sortedLedger = useMemo(
    () => sortRecords(filteredRecords, sortKey, sortDirection),
    [filteredRecords, sortDirection, sortKey],
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

  const applyInsightAction = (action: InsightAction) => {
    if (action.kind === "state") focusState(action.value);
    if (action.kind === "capability") focusCapability(action.value);
    if (action.kind === "industry") focusIndustryFilter(action.value);
    if (action.kind === "year") focusYearFilter(action.value);
    if (action.kind === "search") focusSearchFilter(action.value);
    if (action.kind === "chart") openChart(action.value);
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
            <span>Verified ledger</span>
            <span>State comparison</span>
            <span>Source-backed</span>
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
              <section id="charts" className="chart-zone" aria-label="Interactive charts">
                <div className="chart-zone-heading">
                  <span>Chart Lab</span>
                  <h2>Browse the chart views</h2>
                  <p>State, industry, concentration, and investment-scale views in a publication-width frame.</p>
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
                    subtitle={`Yearly ${metricLabel(metric).toLowerCase()} share by ${trendDimension}. Hover points for names.`}
                    chartId="concentration-trend"
                    expanded={isChartExpanded("concentration-trend")}
                    onExpansionChange={setExpandedChart}
                    action={
                      <div className="comparison-toggle" aria-label="Concentration dimension">
                        <button type="button" className={trendDimension === "industry" ? "active" : ""} aria-pressed={trendDimension === "industry"} onClick={() => setTrendDimension("industry")}>Industry</button>
                        <button type="button" className={trendDimension === "capability" ? "active" : ""} aria-pressed={trendDimension === "capability"} onClick={() => setTrendDimension("capability")}>Capability</button>
                      </div>
                    }
                  >
                    <ChartFrame className="chart-frame concentration-trend-frame">
                      <ConcentrationLineChartGraphic data={concentrationTrend} dimension={trendDimension} />
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
                </ChartDeck>
              </section>

              <aside id="states" className="drilldown-panel" aria-label="State activity details">
                <StatePortfolio summaries={summaries} selectedState={selectedState} onSelect={togglePortfolioState} metric={metric} />
                <StateDrilldown summary={selectedSummary} />
              </aside>
            </div>

            <ExploreOurData cards={explorerCards} topicIndex={topicIndex} onAction={applyInsightAction} />

            <section id="evidence" className="table-section">
              <Panel title="Announcements Explorer" subtitle="Compact source-backed initiative details without overwhelming the dashboard." wide>
                <EvidenceExplorer records={sortedLedger} sortKey={sortKey} sortDirection={sortDirection} onSort={changeSort} />
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
  const analystRecords = allRecords;
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<AnalystResponse | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const topState = useMemo(() => groupByConvertedMetric(analystRecords, metric, (record) => record.state)[0], [metric, analystRecords]);
  const topCapability = useMemo(() => groupByConvertedMetric(analystRecords, metric, (record) => record.capability)[0], [metric, analystRecords]);
  const topIndustry = useMemo(() => groupByConvertedMetric(analystRecords, metric, (record) => record.industry)[0], [metric, analystRecords]);
  const prompts = ["Which state leads?", "Which capability dominates?", "What is the largest commitment?"];

  const ask = async (nextQuestion: string) => {
    const submittedQuestion = nextQuestion.trim() || "Summarize the most important signal in the full dataset.";
    setQuestion(submittedQuestion);
    setIsAsking(true);

    try {
      const apiResponse = await fetch("/api/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: submittedQuestion,
          metric,
        }),
      });

      if (!apiResponse.ok) throw new Error(`Analyst request failed with ${apiResponse.status}`);
      const nextResponse = (await apiResponse.json()) as AnalystResponse & { fallback?: boolean };
      if (nextResponse.fallback) throw new Error("AI analyst is not configured.");
      setResponse(nextResponse);
    } catch {
      setResponse(buildAnalystResponse(submittedQuestion, analystRecords, metric));
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <section className="ask-analyst" aria-labelledby="ask-analyst-title" data-reveal>
      <div className="ask-analyst-copy">
        <span>Ask the Analyst</span>
        <h2 id="ask-analyst-title">Ask a question about this data</h2>
        <p>Ask about leading states, industries, capabilities, yearly trends, totals, or the largest verified commitments.</p>
      </div>

      <form
        className="analyst-search"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          value={question}
          placeholder="Ask, for example: which state leads in cloud and compute?"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button type="submit">
          Ask <ArrowRight size={14} aria-hidden="true" />
        </button>
      </form>

      <div className="ask-analyst-prompts">
        <div className="analyst-prompts" aria-label="Example analyst questions">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => setQuestion(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="ask-analyst-console">
        {(isAsking || response) && (
          <article className={`analyst-answer ${isAsking ? "is-thinking" : "is-ready"}`} aria-live="polite" aria-busy={isAsking}>
            <span>{isAsking ? "Thinking" : "Answer"}</span>
            {isAsking ? (
              <p className="analyst-answer-loading">Reading the full source-backed dataset and preparing an answer...</p>
            ) : (
              response && (
                <div className="analyst-answer-body" key={`${response.answer}-${response.evidence.join("|")}`}>
                  <p>{response.answer}</p>
                  <ul>
                    {response.evidence.map((item, index) => (
                      <li key={item} style={{ "--answer-line-delay": `${180 + index * 70}ms` } as CSSProperties}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </article>
        )}

        <div className="analyst-jump-actions" aria-label="Apply analyst focus">
          {topState && (
            <button type="button" onClick={() => onAction({ kind: "state", value: topState.name })}>
              Focus {topState.name}
            </button>
          )}
          {topCapability && (
            <button type="button" onClick={() => onAction({ kind: "capability", value: topCapability.name })}>
              Focus {topCapability.name}
            </button>
          )}
          {topIndustry && (
            <button type="button" onClick={() => onAction({ kind: "industry", value: topIndustry.name })}>
              Focus {industryLabel(topIndustry.name)}
            </button>
          )}
        </div>
      </div>
    </section>
  );
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
  return (
    <section className="owid-explore" aria-labelledby="explore-data-title">
      <div className="owid-section-heading">
        <span>Data Atlas</span>
        <h2 id="explore-data-title">Interactive views for state, industry, capability, and commitment patterns</h2>
        <p>Open a chart, browse a capability page, or jump into the source-backed announcement explorer.</p>
      </div>
      <div className="owid-explorer-grid">
        {cards.map((card) => (
          <article key={card.chartId} className="owid-explorer-card">
            <span>{card.eyebrow}</span>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
            <small>{card.detail}</small>
            <button type="button" onClick={() => onAction({ kind: "chart", value: card.chartId })}>
              Explore the chart <ArrowRight size={14} aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>
      <div className="owid-topic-index" aria-label="Topic index">
        <TopicGroup title="States" items={topicIndex.states} kind="state" />
        <TopicGroup title="Industries" items={topicIndex.industries} kind="industry" />
        <TopicGroup title="Capabilities" items={topicIndex.capabilities} kind="capability" />
      </div>
    </section>
  );
}

function TopicGroup({
  title,
  items,
  kind,
}: {
  title: string;
  items: ChartDatum[];
  kind: "state" | "industry" | "capability";
}) {
  return (
    <div className="owid-topic-group">
      <h3>{title}</h3>
      <div>
        {items.slice(0, 8).map((item) => (
          <Link key={item.name} href={topicHref(kind, item.name)}>
            <span>{formatTopicLabel(kind, item.name)}</span>
            <small>{item.records.length}</small>
          </Link>
        ))}
      </div>
    </div>
  );
}

function topicHref(kind: "state" | "industry" | "capability", value: string): string {
  if (kind === "state") return `/states/${slugify(value)}`;
  if (kind === "industry") return `/sector-types/${slugify(value)}`;
  return `/sectors/${slugify(value)}`;
}

function formatTopicLabel(kind: "state" | "industry" | "capability", value: string): string {
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
  onSort,
}: {
  records: InvestmentRecord[];
  sortKey: SortKey;
  sortDirection: SortDirection;
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

function ConcentrationLineChartGraphic({ data, dimension }: { data: ConcentrationPoint[]; dimension: TrendDimension }) {
  const [activePoint, setActivePoint] = useState<{ key: "topOneShare" | "topThreeShare"; index: number } | null>(null);
  const width = 720;
  const height = 330;
  const grid = { top: 34, right: 42, bottom: 46, left: 58 };
  const plotWidth = width - grid.left - grid.right;
  const plotHeight = height - grid.top - grid.bottom;
  const xFor = (index: number) => grid.left + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const yFor = (share: number) => grid.top + (1 - share / 100) * plotHeight;
  const series = [
    { key: "topThreeShare" as const, label: "Top three share", color: "#2f80ed" },
    { key: "topOneShare" as const, label: "Leading share", color: "#e05252" },
  ];
  const linePath = (key: "topOneShare" | "topThreeShare") =>
    data.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(point[key])}`).join(" ");
  const activeSeries = activePoint ? series.find((item) => item.key === activePoint.key) : undefined;
  const activeDatum = activePoint ? data[activePoint.index] : undefined;
  const activeNames = activeSeries && activeDatum
    ? activeSeries.key === "topOneShare" ? activeDatum.leader : activeDatum.topThree.join(", ")
    : "";
  const activeNameLines = activeNames ? wrapSvgLabel(activeNames, 38) : [];
  const tooltipWidth = 270;
  const tooltipHeight = 42 + activeNameLines.length * 14;
  const activeX = activePoint ? xFor(activePoint.index) : 0;
  const activeY = activeSeries && activeDatum ? yFor(activeDatum[activeSeries.key]) : 0;
  const tooltipX = Math.max(8, Math.min(width - tooltipWidth - 8, activeX - tooltipWidth / 2));
  const tooltipY = activeY - tooltipHeight - 12 < 4 ? activeY + 14 : activeY - tooltipHeight - 12;

  return (
    <svg className="chart-graphic" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${dimension} concentration trajectory`} preserveAspectRatio="xMidYMid meet">
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = yFor(tick);
        return (
          <g key={tick}>
            <line x1={grid.left} x2={width - grid.right} y1={y} y2={y} stroke={CHART_GRID_COLOR} strokeDasharray="4 6" />
            <text x={grid.left - 10} y={y + 4} textAnchor="end" fill={CHART_TEXT_COLOR} fontSize="12" fontWeight="700">{tick}%</text>
          </g>
        );
      })}
      {data.map((point, index) => (
        <text key={point.year} x={xFor(index)} y={height - 13} textAnchor="middle" fill={CHART_TEXT_COLOR} fontSize="12" fontWeight="800">{point.year}</text>
      ))}
      {series.map((item) => (
        <path key={item.key} d={linePath(item.key)} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <g transform={`translate(${grid.left}, 16)`}>
        {series.map((item, index) => (
          <g key={item.key} transform={`translate(${index * 150}, 0)`}>
            <line x1="0" x2="22" y1="0" y2="0" stroke={item.color} strokeWidth="3" />
            <text x="30" y="4" fill={CHART_AXIS_COLOR} fontSize="11" fontWeight="800">{item.label}</text>
          </g>
        ))}
      </g>
      {series.map((item) =>
        data.map((point, index) => {
          const names = item.key === "topOneShare" ? point.leader : point.topThree.join(", ");
          return (
            <g
              key={`${item.key}-${point.year}`}
              className="concentration-point"
              tabIndex={0}
              role="img"
              aria-label={`${point.year} ${item.label}: ${point[item.key].toFixed(1)}%. ${names}.`}
              onMouseEnter={() => setActivePoint({ key: item.key, index })}
              onMouseLeave={() => setActivePoint(null)}
              onFocus={() => setActivePoint({ key: item.key, index })}
              onBlur={() => setActivePoint(null)}
            >
              <circle cx={xFor(index)} cy={yFor(point[item.key])} r="6" fill={item.color} stroke="#fff" strokeWidth="2" />
            </g>
          );
        }),
      )}
      {activeSeries && activeDatum && (
        <g className="concentration-point-tooltip" transform={`translate(${tooltipX}, ${tooltipY})`} aria-hidden="true">
          <rect width={tooltipWidth} height={tooltipHeight} rx="8" fill="#f7fbff" stroke="#b9ccdf" />
          <text x="12" y="19" fill="#17324d" fontSize="11" fontWeight="800">
            {activeDatum.year} · {activeSeries.label}: {activeDatum[activeSeries.key].toFixed(1)}%
          </text>
          <text x="12" y="38" fill="#526b82" fontSize="10.5" fontWeight="700">
            {activeNameLines.map((line, lineIndex) => (
              <tspan key={`${activeDatum.year}-${activeSeries.key}-${lineIndex}`} x="12" dy={lineIndex === 0 ? 0 : 14}>
                {line}
              </tspan>
            ))}
          </text>
        </g>
      )}
      {!data.length && <text x={width / 2} y={height / 2} textAnchor="middle" fill={CHART_TEXT_COLOR} fontSize="13" fontWeight="700">No chartable commitments in this scope</text>}
    </svg>
  );
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

function convertedValueForMetric(record: InvestmentRecord, metric: MetricMode): number {
  if (metric === "records") return 1;
  if (!record.amount.chartable || !record.amount.currency) return 0;
  if (metric === "inr") {
    return record.amount.currency === "INR" ? record.amount.croreValue || 0 : (record.amount.usdMillionValue || 0) * USD_MILLION_TO_INR_CRORE;
  }
  return record.amount.currency === "USD" ? record.amount.usdMillionValue || 0 : (record.amount.croreValue || 0) / USD_MILLION_TO_INR_CRORE;
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

function buildConcentrationTrend(records: InvestmentRecord[], metric: MetricMode, dimension: TrendDimension): ConcentrationPoint[] {
  const chartableRecords = records.filter((record) => convertedValueForMetric(record, metric) > 0);
  const years = [...new Set(chartableRecords.map((record) => record.year))].sort((a, b) => a - b);

  return years.map((year) => {
    const yearRecords = chartableRecords.filter((record) => record.year === year);
    const groups = groupByConvertedMetric(yearRecords, metric, (record) => record[dimension]);
    const total = groups.reduce((sum, group) => sum + group.value, 0);
    const share = (value: number) => total > 0 ? (value / total) * 100 : 0;
    return {
      year,
      topOneShare: share(groups[0]?.value || 0),
      topThreeShare: share(groups.slice(0, 3).reduce((sum, group) => sum + group.value, 0)),
      leader: groups[0]?.name || "No leader",
      topThree: groups.slice(0, 3).map((group) => group.name),
    };
  });
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

function buildExplorerCards(records: InvestmentRecord[]): ExplorerCard[] {
  const stateCount = uniqueSorted(records.map((record) => record.state)).length;
  const industryCount = uniqueSorted(records.map((record) => record.industry)).length;
  const sourceCount = records.length;
  return [
    {
      eyebrow: "State Lens",
      title: "State Comparison",
      body: "Compare source-backed AI commitments by state and toggle filtered states against the full state set.",
      detail: `${stateCount} states represented`,
      chartId: "state-comparison",
    },
    {
      eyebrow: "Industry Pulse",
      title: "Industry Ranking",
      body: "Rank industry domains by value and toggle filtered industries against the full industry set.",
      detail: `${industryCount} industries classified`,
      chartId: "industry-ranking",
    },
    {
      eyebrow: "Portfolio Shape",
      title: "Concentration Trajectory",
      body: "Track annual leading and top-three shares to see whether commitments are broadening or concentrating.",
      detail: "Industry and capability views",
      chartId: "concentration-trend",
    },
    {
      eyebrow: "Scale Map",
      title: "Investment Scale Scatter",
      body: "Plot source-backed commitments by year and amount to find the largest records and clusters.",
      detail: `${sourceCount} chartable announcements`,
      chartId: "investment-scatter",
    },
  ];
}

function buildTopicIndex(records: InvestmentRecord[]) {
  return {
    states: groupByConvertedMetric(records, "records", (record) => record.state),
    industries: groupByConvertedMetric(records, "records", (record) => record.industry),
    capabilities: groupByConvertedMetric(records, "records", (record) => record.capability),
  };
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
