import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  Text,
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import FloatingBackButton from "../components/FloatingBackButton";
import { getReadingHistory } from "../services/apiService.js";
import { useEnergy } from "../context/EnergyContext";

type HistoryRecord = {
  id: string;
  ts: string;
  solarWatts: number;
  gridWatts: number;
  exportWatts: number;
  powerUsageWatts: number;
  blockchainStatus?: string;
};

type DayBucket = {
  date: string;
  readings: HistoryRecord[];
  totalKwh: number;
  count: number;
  confirmedCount: number;
};

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(date: Date | null) {
  if (!date) return "00 / 00 / 0000";
  return date.toLocaleDateString();
}

function formatDayLabel(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeOnly(ts: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Trapezoidal rule, ported from CST2_backend/services/energyConversionService.js.
// Single reading: assume 0.25h interval.
function readingsToKwh(readings: HistoryRecord[]): number {
  if (!readings || readings.length === 0) return 0;
  if (readings.length === 1) {
    return (Number(readings[0].solarWatts || 0) * 0.25) / 1000;
  }
  const sorted = [...readings].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  );
  let wattHours = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const dtHours =
      (new Date(sorted[i + 1].ts).getTime() -
        new Date(sorted[i].ts).getTime()) /
      3600000;
    const avgWatts =
      (Number(sorted[i].solarWatts || 0) +
        Number(sorted[i + 1].solarWatts || 0)) /
      2;
    wattHours += avgWatts * dtHours;
  }
  return wattHours / 1000;
}

function StatusChip({ status }: { status?: string }) {
  const s = (status || "pending").toLowerCase();
  let bg = "#c9a227";
  let label = "⋯ Pending";
  if (s === "confirmed") {
    bg = "#32702f";
    label = "✓ On-chain";
  } else if (s === "failed") {
    bg = "#c0392b";
    label = "✗ Failed";
  }
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

export default function ReportsScreen() {
  const { selectedPlantId } = useEnergy();
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);

  const onFromChange = (_: any, selectedDate?: Date) => {
    setShowFromPicker(false);
    if (selectedDate) setFromDate(selectedDate);
  };

  const onToChange = (_: any, selectedDate?: Date) => {
    setShowToPicker(false);
    if (selectedDate) setToDate(selectedDate);
  };

  const fetchHistory = async (from: Date, to: Date) => {
    if (from > to) {
      setError("From date must be before To date.");
      return;
    }
    const plantId = selectedPlantId.trim();
    if (!plantId) {
      setRecords([]);
      setError("No plant selected. Add one from the dashboard first.");
      setHasSearched(true);
      return;
    }
    try {
      setLoading(true);
      setError("");
      setHasSearched(true);

      const data = await getReadingHistory(
        plantId,
        toDateInputValue(from),
        toDateInputValue(to)
      );

      setRecords(data?.records ?? []);
      setExpanded({});
    } catch (e) {
      setRecords([]);
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!fromDate || !toDate) {
      setError("Please select both From and To dates.");
      return;
    }
    await fetchHistory(fromDate, toDate);
  };

  const applyQuickRange = (daysBack: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - daysBack);
    setFromDate(from);
    setToDate(to);
    fetchHistory(from, to);
  };

  useEffect(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    setFromDate(from);
    setToDate(to);
    fetchHistory(from, to);
  }, [selectedPlantId]);

  const buckets = useMemo<DayBucket[]>(() => {
    const map: Record<string, HistoryRecord[]> = {};
    for (const r of records) {
      if (!r.ts) continue;
      const d = new Date(r.ts);
      if (Number.isNaN(d.getTime())) continue;
      const key = toDateInputValue(d);
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    const result: DayBucket[] = Object.keys(map).map((date) => {
      const sorted = [...map[date]].sort(
        (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
      );
      return {
        date,
        readings: sorted,
        totalKwh: readingsToKwh(sorted),
        count: sorted.length,
        confirmedCount: sorted.filter(
          (r) => (r.blockchainStatus || "").toLowerCase() === "confirmed"
        ).length,
      };
    });
    result.sort((a, b) => (a.date < b.date ? 1 : -1));
    return result;
  }, [records]);

  const summary = useMemo(() => {
    let totalKwh = 0;
    let totalReadings = 0;
    let confirmed = 0;
    for (const b of buckets) {
      totalKwh += b.totalKwh;
      totalReadings += b.count;
      confirmed += b.confirmedCount;
    }
    return { totalKwh, totalReadings, confirmed };
  }, [buckets]);

  const toggleExpand = (date: string) => {
    setExpanded((prev) => ({ ...prev, [date]: !prev[date] }));
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const buildReportHtml = () => {
    const fromLabel = fromDate ? formatDisplayDate(fromDate) : "—";
    const toLabel = toDate ? formatDisplayDate(toDate) : "—";
    const plantLabel = escapeHtml(selectedPlantId || "Unknown");
    const generatedAt = new Date().toLocaleString();

    const dayRows = buckets
      .map((bucket) => {
        const readingRows = bucket.readings
          .map(
            (r) => `
              <tr>
                <td>${escapeHtml(formatTimeOnly(r.ts))}</td>
                <td style="text-align:right;">${Number(r.solarWatts || 0)} W</td>
                <td>${escapeHtml(r.blockchainStatus || "pending")}</td>
              </tr>`
          )
          .join("");

        return `
          <section class="day">
            <h3>${escapeHtml(formatDayLabel(bucket.date))}</h3>
            <p class="day-meta">
              ${bucket.totalKwh.toFixed(2)} kWh •
              ${bucket.count} reading${bucket.count === 1 ? "" : "s"} •
              ${bucket.confirmedCount} confirmed
            </p>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th style="text-align:right;">Solar Watts</th>
                  <th>Blockchain Status</th>
                </tr>
              </thead>
              <tbody>${readingRows}</tbody>
            </table>
          </section>`;
      })
      .join("");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>SolarTrust Report</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1f1f1f; padding: 24px; }
            h1 { color: #32702f; margin: 0 0 4px; }
            .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
            .summary { display: flex; gap: 12px; margin-bottom: 20px; }
            .tile { flex: 1; background: #1a1a1a; color: #fff; padding: 12px; border-radius: 8px; text-align: center; }
            .tile .value { color: #7ec47a; font-size: 18px; font-weight: 800; }
            .tile .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
            section.day { margin-bottom: 18px; page-break-inside: avoid; }
            section.day h3 { color: #32702f; margin: 0 0 4px; font-size: 15px; }
            .day-meta { color: #555; font-size: 12px; margin: 0 0 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d7d7d7; padding: 6px 8px; }
            th { background: #f1f1f1; text-align: left; }
          </style>
        </head>
        <body>
          <h1>SolarTrust History Report</h1>
          <div class="meta">
            Plant: ${plantLabel}<br/>
            Range: ${escapeHtml(fromLabel)} — ${escapeHtml(toLabel)}<br/>
            Generated: ${escapeHtml(generatedAt)}
          </div>

          <div class="summary">
            <div class="tile">
              <div class="value">${summary.totalKwh.toFixed(2)}</div>
              <div class="label">Total kWh</div>
            </div>
            <div class="tile">
              <div class="value">${summary.totalReadings}</div>
              <div class="label">Readings</div>
            </div>
            <div class="tile">
              <div class="value">${summary.confirmed}/${summary.totalReadings}</div>
              <div class="label">Confirmed</div>
            </div>
          </div>

          ${dayRows || '<p style="color:#555;">No readings in this range.</p>'}
        </body>
      </html>
    `;
  };

  const downloadPdf = async () => {
    if (!fromDate || !toDate) {
      Alert.alert("Pick a date range", "Please select both From and To dates first.");
      return;
    }
    if (records.length === 0) {
      Alert.alert("Nothing to export", "Generate a report with readings before downloading.");
      return;
    }
    try {
      setExporting(true);
      const html = buildReportHtml();
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      if (Platform.OS === "web") {
        Alert.alert("PDF created", uri);
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Save SolarTrust Report",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF saved", `Saved to: ${uri}`);
      }
    } catch (e) {
      Alert.alert(
        "PDF export failed",
        e instanceof Error ? e.message : "Unknown error"
      );
    } finally {
      setExporting(false);
    }
  };

  const showEmptyState =
    hasSearched && !loading && !error && records.length === 0;
  const showSummary =
    hasSearched && !loading && !error && summary.totalReadings > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>History Report</Text>

        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => applyQuickRange(0)}
            disabled={loading}
          >
            <Text style={styles.quickChipText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => applyQuickRange(7)}
            disabled={loading}
          >
            <Text style={styles.quickChipText}>7 Days</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => applyQuickRange(30)}
            disabled={loading}
          >
            <Text style={styles.quickChipText}>30 Days</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateRow}>
          <Text style={styles.label}>From</Text>

          <TouchableOpacity onPress={() => setShowFromPicker(true)}>
            <MaterialIcons name="calendar-month" size={34} color="black" />
          </TouchableOpacity>

          <View style={styles.dateBox}>
            <Text style={styles.dateText}>{formatDisplayDate(fromDate)}</Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Text style={styles.label}>To</Text>

          <TouchableOpacity onPress={() => setShowToPicker(true)}>
            <MaterialIcons name="calendar-month" size={34} color="black" />
          </TouchableOpacity>

          <View style={styles.dateBox}>
            <Text style={styles.dateText}>{formatDisplayDate(toDate)}</Text>
          </View>
        </View>

        {showFromPicker && (
          <DateTimePicker
            value={fromDate || new Date()}
            mode="date"
            display="default"
            onChange={onFromChange}
          />
        )}

        {showToPicker && (
          <DateTimePicker
            value={toDate || new Date()}
            mode="date"
            display="default"
            onChange={onToChange}
          />
        )}

        <TouchableOpacity
          style={[styles.reportButton, loading && styles.disabledButton]}
          onPress={loadHistory}
          disabled={loading}
        >
          <MaterialIcons name="summarize" size={20} color="#fff" />
          <Text style={styles.reportButtonText}>
            {loading ? "Loading Report..." : "Generate Report"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.downloadButton,
            (exporting || loading || records.length === 0) &&
              styles.disabledButton,
          ]}
          onPress={downloadPdf}
          disabled={exporting || loading || records.length === 0}
        >
          <MaterialIcons name="picture-as-pdf" size={20} color="#fff" />
          <Text style={styles.reportButtonText}>
            {exporting ? "Preparing PDF..." : "Download PDF"}
          </Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#32702f" />
          </View>
        ) : null}

        {showSummary ? (
          <View style={styles.summaryRow}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryValue}>
                {summary.totalKwh.toFixed(2)}
              </Text>
              <Text style={styles.summaryLabel}>Total kWh</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryValue}>{summary.totalReadings}</Text>
              <Text style={styles.summaryLabel}>Readings</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryValue}>
                {summary.confirmed}/{summary.totalReadings}
              </Text>
              <Text style={styles.summaryLabel}>Confirmed</Text>
            </View>
          </View>
        ) : null}

        {showEmptyState ? (
          <Text style={styles.emptyText}>
            No readings in this date range — try a wider window.
          </Text>
        ) : null}

        <View style={styles.recordsList}>
          {buckets.map((bucket) => {
            const isOpen = !!expanded[bucket.date];
            return (
              <View key={bucket.date} style={styles.dayCard}>
                <TouchableOpacity
                  onPress={() => toggleExpand(bucket.date)}
                  activeOpacity={0.7}
                  style={styles.dayHeader}
                >
                  <View style={styles.dayHeaderText}>
                    <Text style={styles.dayDate}>
                      {formatDayLabel(bucket.date)}
                    </Text>
                    <Text style={styles.daySub}>
                      {bucket.totalKwh.toFixed(2)} kWh • {bucket.count} reading
                      {bucket.count === 1 ? "" : "s"} • {bucket.confirmedCount}{" "}
                      confirmed
                    </Text>
                  </View>
                  <MaterialIcons
                    name={isOpen ? "expand-less" : "expand-more"}
                    size={26}
                    color="#ffffff"
                  />
                </TouchableOpacity>

                {isOpen ? (
                  <View style={styles.readingsList}>
                    {bucket.readings.map((r) => (
                      <View key={r.id} style={styles.readingRow}>
                        <Text style={styles.readingTime}>
                          {formatTimeOnly(r.ts)}
                        </Text>
                        <Text style={styles.readingWatts}>
                          {r.solarWatts} W
                        </Text>
                        <StatusChip status={r.blockchainStatus} />
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <FloatingBackButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ebeaea",
  },

  scrollContent: {
    paddingTop: 80,
    paddingHorizontal: 25,
    paddingBottom: 120,
    alignItems: "center",
  },

  title: {
    color: "#32702f",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
  },

  quickRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 22,
    gap: 10,
  },

  quickChip: {
    backgroundColor: "#1a1a1a",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },

  quickChipText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    justifyContent: "center",
  },

  dateBox: {
    backgroundColor: "#d9d9d9",
    marginLeft: 15,
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 6,
    minWidth: 180,
    alignItems: "center",
  },

  dateText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },

  label: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
    width: 55,
    marginRight: 8,
  },

  reportButton: {
    backgroundColor: "#32702f",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 16,
    minWidth: 220,
  },

  downloadButton: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
    marginBottom: 16,
    minWidth: 220,
  },

  disabledButton: {
    opacity: 0.7,
  },

  reportButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 8,
  },

  error: {
    color: "#d32f2f",
    textAlign: "center",
    marginBottom: 12,
  },

  loadingWrap: {
    paddingVertical: 24,
  },

  emptyText: {
    color: "#555",
    fontSize: 14,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 12,
  },

  summaryRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 8,
  },

  summaryTile: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
  },

  summaryValue: {
    color: "#32702f",
    fontSize: 18,
    fontWeight: "800",
  },

  summaryLabel: {
    color: "#f1f1f1",
    fontSize: 11,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  recordsList: {
    width: "100%",
  },

  dayCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },

  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 15,
  },

  dayHeaderText: {
    flex: 1,
  },

  dayDate: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },

  daySub: {
    color: "#cfcfcf",
    fontSize: 12,
    marginTop: 4,
  },

  readingsList: {
    borderTopWidth: 1,
    borderTopColor: "#2c2c2c",
    paddingHorizontal: 15,
    paddingVertical: 8,
  },

  readingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },

  readingTime: {
    color: "#f1f1f1",
    fontSize: 13,
    width: 80,
  },

  readingWatts: {
    color: "#32702f",
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
  },

  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },

  chipText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
});
