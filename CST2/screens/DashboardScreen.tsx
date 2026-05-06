import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet
} from "react-native";
import { syncEnergy } from "../services/apiService.js";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";

/* THIS connects the screen to the real navigator */
type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

type AnomalyLevel = "minor" | "warning" | "urgent";

type AnomalyReport = {
  level: AnomalyLevel;
  label: string;
  message: string;
  time: string;
  readingWatts?: number;
  previousAverageWatts?: number;
};

const normalReports: AnomalyReport[] = [
  {
    level: "minor",
    label: "Minor Update",
    message: "No warnings or urgent anomalies to check.",
    time: "Now",
  },
];

const reportStyleByLevel = {
  minor: "minorReport",
  warning: "warningReport",
  urgent: "urgentReport",
} as const;

function getReportLevel(severity: unknown): AnomalyLevel {
  const value = String(severity ?? "").toLowerCase();

  if (["urgent", "emergency", "critical", "high", "red"].includes(value)) {
    return "urgent";
  }

  if (["warning", "warn", "medium", "orange", "yellow"].includes(value)) {
    return "warning";
  }

  return "minor";
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[], avg: number) {
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function buildAnomalyReports(data: any, solarWatts: number, ts: string, history: number[]): AnomalyReport[] {
  const alert =
    data?.anomaly ??
    data?.alert ??
    data?.warning ??
    data?.reading?.anomaly ??
    data?.reading?.alert ??
    data?.latest?.anomaly ??
    data?.latest?.alert;

  const severity =
    alert?.severity ??
    alert?.level ??
    alert?.status ??
    data?.severity ??
    data?.status;

  const issueSeverities = [
    "warning",
    "warn",
    "medium",
    "orange",
    "yellow",
    "urgent",
    "emergency",
    "critical",
    "high",
    "red",
  ];

  const hasIssue =
    Boolean(alert?.isAnomaly) ||
    Boolean(alert?.active) ||
    Boolean(alert?.message) ||
    issueSeverities.includes(String(severity ?? "").toLowerCase());

  if (!hasIssue) {
    if (solarWatts < 0 || solarWatts > 20000) {
      return [
        {
          level: "urgent",
          label: "Urgent",
          message: `Emergency reading detected at ${solarWatts} W. Check the system immediately.`,
          time: ts || "Now",
          readingWatts: solarWatts,
        },
      ];
    }

    if (history.length >= 3) {
      const recent = history.slice(-5);
      const avg = mean(recent);
      const sd = stdDev(recent, avg);
      const dropRatio = avg > 0 ? (avg - solarWatts) / avg : 0;
      const zScore = sd > 0 ? Math.abs((solarWatts - avg) / sd) : 0;

      if (dropRatio >= 0.75 || zScore >= 5) {
        return [
          {
            level: "urgent",
            label: "Urgent",
            message: `Emergency change detected at ${solarWatts} W. Check inverter or grid connection.`,
            time: ts || "Now",
            readingWatts: solarWatts,
            previousAverageWatts: Math.round(avg),
          },
        ];
      }

      if (dropRatio >= 0.4 || zScore >= 3) {
        return [
          {
            level: "warning",
            label: "Warning",
            message: `Current reading changed sharply to ${solarWatts} W. Monitor panel performance.`,
            time: ts || "Now",
            readingWatts: solarWatts,
            previousAverageWatts: Math.round(avg),
          },
        ];
      }
    }

    return normalReports;
  }

  const level = getReportLevel(severity);

  return [
    {
      level,
      label: level === "urgent" ? "Urgent" : "Warning",
      message:
        alert?.message ??
        alert?.reason ??
        (level === "urgent"
          ? `Emergency anomaly detected at ${solarWatts} W. Check the system immediately.`
          : `Warning detected at ${solarWatts} W. Monitor panel performance.`),
      time: ts || "Now",
      readingWatts: solarWatts,
    },
  ];
}

export default function DashboardScreen({ navigation }: Props) {
  const screenWidth = Dimensions.get("window").width;
  const powerHistoryRef = useRef<number[]>([]);

  const [solarWatts, setSolarWatts] = useState(0);
  const [powerHistory, setPowerHistory] = useState<number[]>([]);
  const [lastUpdate, setLastUpdate] = useState("");
  const [error, setError] = useState("");
  const [debugUrl, setDebugUrl] = useState("");
  const [debugState, setDebugState] = useState("idle");
  const [anomalyReports, setAnomalyReports] =
    useState<AnomalyReport[]>(normalReports);
  const [selectedReport, setSelectedReport] = useState<AnomalyReport | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadEnergy = async () => {
      try {
        const base =
          process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.39:3000";

        setDebugUrl(`${base}/energy/sync/TTC60011`);
        setDebugState("loading");

        const data = await syncEnergy("TTC60011");

        const solarRaw =
          data?.reading?.solarWatts;
        
        const ts =
          data?.reading?.ts ??
          data?.latest?.ts ??
        "";

        if (typeof solarRaw === "number" && !isNaN(solarRaw)) {
          const rounded = Math.round(solarRaw);

        console.log("⚡ Solar value:", rounded);

        setSolarWatts(rounded);
        setLastUpdate(ts);
        setError("");
        setDebugState("ok");
        const reports = buildAnomalyReports(
          data,
          rounded,
          ts,
          powerHistoryRef.current
        );
        setAnomalyReports(reports);
        setSelectedReport(null);

        // 🔥 Update chart history (keep last 20 points)
        setPowerHistory(prev => {
          const updated = [...prev, rounded];
          if (updated.length > 20) updated.shift();
            powerHistoryRef.current = updated;
            return updated;
        });

      }

    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load energy";
        setError(message);
        setDebugState("failed");
        setAnomalyReports([
          {
            level: "urgent",
            label: "Urgent",
            message: `Energy sync failed: ${message}`,
            time: "Now",
          },
        ]);
    }
  };

    loadEnergy();

    // ✅ 5 minutes interval (300,000 ms)
    const timer = setInterval(loadEnergy, 300000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.navigate("Menu")}>
          <MaterialIcons name="menu" size={26} color="black" />
        </TouchableOpacity>

        <View style={styles.topRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Game")}
          >
            <Ionicons name="game-controller-outline" size={24} color="black" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Store")}
          >
            <Ionicons name="cart-outline" size={24} color="black" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Ionicons name="notifications-outline" size={24} color="black" />
          </TouchableOpacity>
        </View>
      </View>

      {/* TITLE */}
      <Text style={styles.title}>DashBoard</Text>

      {/* CARD */}
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.push("Statistics")}
      >

        <View style={styles.powerRow}>
          <Text style={styles.powerText}>
            Solar Power: {solarWatts} W
          </Text>
        </View>

        {/* 🔥 LIVE LINE CHART */}
        <View style={styles.chartContainer}>
        <LineChart
          data={{
            labels: powerHistory.map((_, i) => i.toString()),
            datasets: [
              {
                data: powerHistory.length ? powerHistory : [0],
              },
            ],
          }}
          width={screenWidth - 90}
          height={160}
          yAxisSuffix="W"
          chartConfig={{
            backgroundColor: "#ffffff",
            backgroundGradientFrom: "#ffffff",
            backgroundGradientTo: "#ffffff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(50,112,47, ${opacity})`,
            labelColor: () => "#000",
            propsForDots: {
              r: "4",
              strokeWidth: "2",
              stroke: "#32702f",
            },
          }}
          bezier
          style={{
            borderRadius: 10,
          }}
        />
      </View>

      </TouchableOpacity>

      {lastUpdate ? (
        <Text style={styles.meta}>Last update: {lastUpdate}</Text>
      ) : null}

      {error ? (
        <Text style={styles.error}>IoT error: {error}</Text>
      ) : null}

      <Text style={styles.meta}>API: {debugUrl || "not set"}</Text>
      <Text style={styles.meta}>State: {debugState}</Text>

      <Text style={styles.details}>
        Click the Graph to view full details!
      </Text>

      <View style={styles.reportBoard}>
        <Text style={styles.reportTitle}>Anomaly Detection Reports</Text>

        {anomalyReports.map((report, index) => (
          <TouchableOpacity
            key={`${report.level}-${report.time}-${index}`}
            style={[
              styles.reportRow,
              styles[reportStyleByLevel[report.level]],
            ]}
            activeOpacity={report.level === "minor" ? 1 : 0.75}
            disabled={report.level === "minor"}
            onPress={() =>
              setSelectedReport((current) =>
                current === report ? null : report
              )
            }
          >
            <View style={styles.reportTextGroup}>
              <Text style={styles.reportLabel}>{report.label}</Text>
              <Text style={styles.reportMessage}>{report.message}</Text>
            </View>
            <View style={styles.reportActionGroup}>
              <Text style={styles.reportTime}>{report.time}</Text>
              {report.level !== "minor" ? (
                <Text style={styles.viewReportText}>View</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}

        {selectedReport ? (
          <View style={styles.reportDetails}>
            <Text style={styles.reportDetailsTitle}>
              {selectedReport.label} Reading
            </Text>
            <Text style={styles.reportDetailsText}>
              Current reading: {selectedReport.readingWatts ?? solarWatts} W
            </Text>
            {selectedReport.previousAverageWatts != null ? (
              <Text style={styles.reportDetailsText}>
                Recent average: {selectedReport.previousAverageWatts} W
              </Text>
            ) : null}
            <Text style={styles.reportDetailsText}>
              Time: {selectedReport.time}
            </Text>
            <Text style={styles.reportDetailsText}>
              Action: {selectedReport.message}
            </Text>
          </View>
        ) : null}
      </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ebeaea",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15
  },

  topRight: {
    flexDirection: "row",
    alignItems: "center"
  },

  iconButton: {
    marginLeft: 18,
    padding: 4
  },

  title: {
    color: "#32702f",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 20
  },

  card: {
    backgroundColor: "#3d3d3d",
    borderRadius: 14,
    padding: 15,
    elevation: 4,
  },

  powerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },

  powerText: {
    color: "#FFF",
    fontWeight: "600"
  },

  details: {
    color: "#000000",
    textAlign: "center",
    marginTop: 18,
    marginBottom: 18
  },

  reportBoard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    elevation: 3,
  },

  reportTitle: {
    color: "#1f1f1f",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },

  reportRow: {
    borderLeftWidth: 6,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  minorReport: {
    backgroundColor: "#e7f6e6",
    borderLeftColor: "#2e7d32",
  },

  warningReport: {
    backgroundColor: "#fff4d6",
    borderLeftColor: "#f5a623",
  },

  urgentReport: {
    backgroundColor: "#ffe5e5",
    borderLeftColor: "#d32f2f",
  },

  reportTextGroup: {
    flex: 1,
    paddingRight: 10,
  },

  reportLabel: {
    color: "#1f1f1f",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },

  reportMessage: {
    color: "#333333",
    fontSize: 12,
  },

  reportTime: {
    color: "#555555",
    fontSize: 11,
    fontWeight: "600",
  },

  reportActionGroup: {
    alignItems: "flex-end",
  },

  viewReportText: {
    color: "#1f1f1f",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },

  reportDetails: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
    marginTop: 2,
  },

  reportDetailsTitle: {
    color: "#1f1f1f",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },

  reportDetailsText: {
    color: "#333333",
    fontSize: 12,
    marginBottom: 5,
  },

  meta: {
    color: "#000000",
    textAlign: "center",
    marginTop: 10,
    fontSize: 12
  },

  error: {
    color: "#ff7070",
    textAlign: "center",
    marginTop: 10,
    fontSize: 12
  },

  chartContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
});
