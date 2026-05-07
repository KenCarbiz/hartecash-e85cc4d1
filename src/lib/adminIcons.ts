/**
 * Curated Lucide subset for the admin surface.
 *
 * Item 18 of the May 2026 employee-flow audit called out icon
 * sprawl — the sidebar mixed Flame / Inbox / RotateCcw / LineChart /
 * BarChart3 in a single nav, twelve metaphor families in twelve rows.
 * This module documents the canonical icons admin/ should reach for,
 * keyed by domain rather than glyph, so a contributor adding a new
 * surface picks the same icon two surfaces over already use.
 *
 * IMPORTANT — this file is a directory, not a wrapper. Components
 * still import directly from `lucide-react`; the export below tells
 * future PRs which icon to pick. The canonical set is intentionally
 * small (~24) so the visual language stays coherent across the app.
 *
 *   Domain                Use this        Avoid
 *   --------------------- --------------- ------------------------
 *   All Leads / inbox     Inbox           ListChecks, MessageSquare
 *   BDC / phone work      PhoneCall       Flame, Phone (call-out)
 *   Appraiser / re-do     RotateCcw       UserCheck, RefreshCw
 *   Appointments          CalendarDays    Calendar, Clock
 *   Performance / KPIs    LineChart       BarChart3, PieChart
 *   Reports / export      Send            Download, FileDown
 *   Branding / appearance Palette         Paintbrush, Brush, Sparkles
 *   Capture & Inspection  FileText        Camera, ListChecks
 *   Pricing / money       DollarSign      CreditCard, Receipt
 *   Locations             MapPin          Map, Building
 *   Communications        Phone           MessageSquare, AtSign
 *   Marketing             Megaphone       Loudspeaker, Speaker
 *   Embed / website       Code2           Globe, ExternalLink
 *   Integrations          Activity        Plug, Workflow
 *   Staff / users         Users           User, UserCheck
 *   Plan / account        CreditCard      Receipt, Wallet
 *   Onboarding            Rocket          Sparkles, Wand
 *   Settings              Settings        Sliders, Cog
 *   Vehicle image cache   Car             Image, ImageIcon
 *   Tenants               Network         Building2, Globe
 *   Demo                  Target          Eye, PlayCircle
 *   SaaS pricing          Tag             DollarSign, Receipt
 *   Billing               Receipt         CreditCard, DollarSign
 *   Changelog             ScrollText      FileText, History
 *   Inspection check-in   LogIn           ScanLine, QrCode
 *   Service quick entry   Wrench          Tool, Settings
 *
 * The semantic icons below are wired to the design tokens added in
 * 20260507 (--success / --warning / --info) via Tailwind's text-*
 * utilities — no need to color-code icons inline.
 */

export {
  // Pipeline / queues
  Inbox,
  PhoneCall,        // BDC Queue (item 18 — replaced Flame)
  RotateCcw,        // Appraiser Queue
  CalendarDays,    // Appointments

  // Performance
  LineChart,       // Performance / KPIs
  Send,            // Reports / Export

  // Capture & Inspection / Branding
  FileText,        // Lead Form / Inspection Sheet / Documents
  Camera,          // Photos overlay
  Palette,         // Branding / appearance
  Gauge,           // Inspection standards

  // Money + ops
  DollarSign,      // Pricing rules
  CreditCard,      // Plan / billing
  Receipt,         // Billing

  // Geo + comms
  MapPin,          // Locations
  Phone,           // Communications
  Megaphone,       // Marketing
  Code2,           // Embed / website
  Activity,        // Integrations

  // Account + platform
  Users,           // Staff & permissions
  Rocket,          // Onboarding wizard
  Settings,        // System settings
  Car,             // Vehicle image cache
  Network,         // Tenants / groups
  Target,          // Prospect demo
  Tag,             // SaaS pricing
  ScrollText,      // Changelog

  // Lane tools
  LogIn,           // Inspection check-in
  Wrench,          // Service quick entry

  // Status / semantic — pair with text-success / text-warning / text-info
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Sparkles,        // AI / boost markers ONLY (not generic decoration)
} from "lucide-react";
