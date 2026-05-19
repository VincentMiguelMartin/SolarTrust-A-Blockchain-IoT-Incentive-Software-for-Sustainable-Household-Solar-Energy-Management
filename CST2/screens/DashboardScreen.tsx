import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import { useEnergy } from "../context/EnergyContext";
import { supabase } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

function getPlantStorageKey(userId?: string) {
  return `userPlantId:${userId ?? "guest"}`;
}

function formatLocalDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

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

type AdminPlant = { id: string; name: string };

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

function buildAnomalyReports(
  data: any,
  solarWatts: number,
  ts: string,
  history: number[]
): AnomalyReport[] {
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
    if (solarWatts < 0 || solarWatts > 100000) {
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
  const { role } = useContext(AuthContext);
  const isAdmin = true;
  const {
    selectedPlantId,
    setSelectedPlantId,
    reading,
    powerHistory,
    lastUpdate,
    error,
    debugUrl,
    debugState,
    rawData,
  } = useEnergy();
  const solarWatts = reading.solarWatts;
  const [anomalyReports, setAnomalyReports] =
    useState<AnomalyReport[]>(normalReports);
  const [selectedReport, setSelectedReport] = useState<AnomalyReport | null>(
    null
  );
  const [adminPlants, setAdminPlants] = useState<AdminPlant[]>([]);
  const [showPlantDropdown, setShowPlantDropdown] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showAddPlantForm, setShowAddPlantForm] = useState(false);
  const [newPlantId, setNewPlantId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const selectedPlant =
    adminPlants.find((plant) => plant.id === selectedPlantId) ??
    adminPlants[0] ?? { id: "", name: "No plant selected" };

  useEffect(() => {
    let active = true;

    (async () => {
      const { data, error: plantsError } = await supabase
        .from("allowed_plants")
        .select("plant_id, label")
        .order("plant_id", { ascending: true });

      if (!active) return;

      if (plantsError) {
        console.log("Unable to load allowed_plants:", plantsError.message);
        return;
      }

      const plants: AdminPlant[] = (data ?? []).map((row) => ({
        id: row.plant_id,
        name: row.label || row.plant_id,
      }));

      setAdminPlants(plants);

      if (selectedPlantId) return;

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      let savedPlantId = "";
      if (userId) {
        if (!isAdmin) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("plant_id")
            .eq("id", userId)
            .maybeSingle<{ plant_id: string | null }>();

          savedPlantId = String(profile?.plant_id ?? "").trim();
        }

        if (!savedPlantId) {
          const cached = await AsyncStorage.getItem(getPlantStorageKey(userId));
          savedPlantId = String(cached ?? "").trim();
        }
      }

      if (!active) return;

      const matched = savedPlantId
        ? plants.find((p) => p.id === savedPlantId)
        : null;

      if (matched) {
        setSelectedPlantId(matched.id);
      } else if (plants.length > 0) {
        setSelectedPlantId(plants[0].id);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedPlantId, setSelectedPlantId, isAdmin]);

  const fetchPendingRequests = async () => {
  const { data, error } = await supabase
    .from("reward_redemptions")
    .select()
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (!error && data) {
    console.log("PENDING:", data);

    setPendingRequests(data);
  }
};

  const generateReferenceNumber = () => {
  const random = Math.floor(100000 + Math.random() * 900000);

  return `SOL-${random}`;
};

const approveRequest = async (request: any) => {
  try {
    const referenceNumber = generateReferenceNumber();

    const { error } = await supabase
      .from("reward_redemptions")
      .update({
        status: "approved",
        reference_number: referenceNumber,
        approved_at: new Date(),
      })
      .eq("id", request.id);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    await supabase.from("notifications").insert([
      {
        user_id: request.user_id,
        title: "Reward Approved",
        message: `Your free cleaning request was approved.\nReference Number: ${referenceNumber}`,
        type: "reward",
      },
    ]);

    Alert.alert("Approved Successfully");

    fetchPendingRequests();
  } catch (err) {
    console.log(err);
  }
};

const rejectRequest = async (request: any) => {
  try {
    const { error } = await supabase
      .from("reward_redemptions")
      .update({
        status: "rejected",
      })
      .eq("id", request.id);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    await supabase.from("notifications").insert([
      {
        user_id: request.user_id,
        title: "Reward Rejected",
        message:
          "Your free cleaning request was rejected by the admin.",
        type: "reward",
      },
    ]);

    Alert.alert("Request Rejected");

    fetchPendingRequests();
  } catch (err) {
    console.log(err);
  }
};

useEffect(() => {
  fetchPendingRequests();
}, []);

const onRefresh = async () => {
  setRefreshing(true);

  await fetchPendingRequests();

  setRefreshing(false);
};

  const handleAddPlant = async () => {
    const plantId = newPlantId.trim().toUpperCase();

    if (!plantId) {
      return;
    }

    const { data: allowedPlant, error: lookupError } = await supabase
      .from("allowed_plants")
      .select("plant_id, label")
      .eq("plant_id", plantId)
      .maybeSingle<{ plant_id: string; label: string | null }>();

    if (lookupError || !allowedPlant) {
      Alert.alert(
        "Plant ID not available",
        lookupError
          ? `Unable to check allowed_plants: ${lookupError.message}`
          : `No allowed_plants row was visible for ${plantId}. Check the plant ID or Supabase SELECT/RLS policy.`
      );
      return;
    }

    if (!adminPlants.some((plant) => plant.id === allowedPlant.plant_id)) {
      setAdminPlants((current) => [
        ...current,
        { id: allowedPlant.plant_id, name: allowedPlant.label || allowedPlant.plant_id },
      ]);
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userId) {
      await AsyncStorage.setItem(
        getPlantStorageKey(userId),
        allowedPlant.plant_id
      );

      if (!isAdmin) {
        const { error: updateError } = await supabase
          .from("user_profiles")
          .update({ plant_id: allowedPlant.plant_id })
          .eq("id", userId);

        if (
          updateError &&
          !updateError.message.toLowerCase().includes("schema cache")
        ) {
          Alert.alert("Unable to save plant", updateError.message);
          return;
        }
      }
    } else {
      await AsyncStorage.setItem(getPlantStorageKey(), allowedPlant.plant_id);
    }

    setSelectedPlantId(allowedPlant.plant_id);
    setNewPlantId("");
    setShowAddPlantForm(false);
  };

  useEffect(() => {
    if (error) {
      setAnomalyReports([
        {
          level: "urgent",
          label: "Urgent",
          message: `Energy sync failed: ${error}`,
          time: "Now",
        },
      ]);
      setSelectedReport(null);
      return;
    }

    if (!rawData) {
      return;
    }

    setAnomalyReports(
      buildAnomalyReports(rawData, solarWatts, lastUpdate, powerHistory.slice(0, -1))
    );
    setSelectedReport(null);
  }, [error, lastUpdate, powerHistory, rawData, solarWatts]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
  contentContainerStyle={styles.scrollContent}
  showsVerticalScrollIndicator={false}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={["#32702f"]}
      tintColor="#32702f"
    />
  }
>
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

        <Text style={styles.title}>DashBoard</Text>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => navigation.push("Statistics")}
        >
          <View style={styles.powerRow}>
            <View>
              <Text style={styles.cardLabel}>Solar Power</Text>
              <Text style={styles.powerText}>{solarWatts} W</Text>
            </View>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{debugState}</Text>
            </View>
          </View>

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
              withInnerLines={false}
              withOuterLines={false}
              withShadow={false}
              fromZero
              chartConfig={{
                backgroundColor: "#f7faf6",
                backgroundGradientFrom: "#f7faf6",
                backgroundGradientTo: "#ffffff",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(50, 112, 47, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                propsForDots: {
                  r: "3",
                  strokeWidth: "2",
                  stroke: "#32702f",
                },
                propsForBackgroundLines: {
                  strokeDasharray: "",
                  stroke: "#d7e4d5",
                },
              }}
              bezier
              style={styles.chart}
            />
          </View>
        </TouchableOpacity>

        <Text style={styles.indicatorNote}>Please wait 15 minutes for indicator</Text>

        {lastUpdate ? (
          <Text style={styles.meta}>Last update: {formatLocalDateTime(lastUpdate)}</Text>
        ) : null}

        {error ? <Text style={styles.error}>IoT error: {error}</Text> : null}

        <Text style={styles.meta}>API: {debugUrl || "not set"}</Text>
        <Text style={styles.meta}>State: {debugState}</Text>

        <Text style={styles.details}>Click the Graph to view full details!</Text>

        {showAddPlantForm ? (
          <View style={styles.addPlantForm}>
            <Text style={styles.addPlantTitle}>Add New Plant</Text>
            <TextInput
              style={styles.plantInput}
              placeholder="Plant ID"
              placeholderTextColor="#777777"
              value={newPlantId}
              onChangeText={setNewPlantId}
              autoCapitalize="characters"
            />

            <View style={styles.addPlantActions}>
              <TouchableOpacity
                style={styles.backPlantButton}
                activeOpacity={0.85}
                onPress={() => {
                  setNewPlantId("");
                  setShowAddPlantForm(false);
                }}
              >
                <MaterialIcons name="arrow-back" size={20} color="#32702f" />
                <Text style={styles.backPlantText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.savePlantButton,
                  !newPlantId.trim() ? styles.disabledPlantButton : null,
                ]}
                activeOpacity={0.85}
                disabled={!newPlantId.trim()}
                onPress={handleAddPlant}
              >
                <Text style={styles.savePlantText}>Add Plant</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.plantSelector}>
            <View style={styles.plantSelectorActions}>
              <TouchableOpacity
                style={styles.plantSelectButton}
                activeOpacity={0.8}
                onPress={() => setShowPlantDropdown((current) => !current)}
              >
                <View style={styles.plantSelectText}>
                  <Text style={styles.plantSelectLabel}>Current Plant</Text>
                  <Text style={styles.plantSelectValue}>
                    {selectedPlant.name}
                  </Text>
                </View>
                <MaterialIcons
                  name={
                    showPlantDropdown
                      ? "keyboard-arrow-up"
                      : "keyboard-arrow-down"
                  }
                  size={26}
                  color="#32702f"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.plantInfoButton}
                activeOpacity={0.85}
                onPress={() =>
                  Alert.alert(
                    selectedPlant.name,
                    `Plant ID: ${selectedPlant.id}`
                  )
                }
              >
                <MaterialIcons name="info-outline" size={22} color="#32702f" />
              </TouchableOpacity>

            </View>

            {showPlantDropdown ? (
              <View style={styles.plantDropdown}>
                {adminPlants.map((plant) => {
                  const active = plant.id === selectedPlantId;

                  return (
                    <TouchableOpacity
                      key={plant.id}
                      style={[
                        styles.plantOption,
                        active ? styles.activePlantOption : null,
                      ]}
                      activeOpacity={0.75}
                      onPress={() => {
                        setSelectedPlantId(plant.id);
                        setShowPlantDropdown(false);
                      }}
                    >
                      <View>
                        <Text style={styles.plantOptionName}>{plant.name}</Text>
                      </View>
                      {active ? (
                        <MaterialIcons name="check" size={22} color="#32702f" />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        )}

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
                <Text style={styles.reportTime}>
                  {report.time === "Now" ? "Now" : formatLocalDateTime(report.time)}
                </Text>
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
                Time: {selectedReport.time === "Now" ? "Now" : formatLocalDateTime(selectedReport.time)}
              </Text>
              <Text style={styles.reportDetailsText}>
                Action: {selectedReport.message}
              </Text>
            </View>
          ) : null}
        </View>
        {isAdmin && (
  <View
    style={{
      backgroundColor: "#ffffff",
      borderRadius: 12,
      padding: 14,
      marginTop: 20,
    }}
  >
    <Text
      style={{
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 12,
        color: "#32702f",
      }}
    >
      Pending Reward Requests
    </Text>

    {pendingRequests.length === 0 ? (
      <Text>No pending requests</Text>
    ) : (
      pendingRequests.map((request, index) => (
        <View
          key={`${request.id}-${index}`}
          style={{
            backgroundColor: "#f5f5f5",
            padding: 12,
            borderRadius: 10,
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontWeight: "bold",
              fontSize: 15,
              marginBottom: 4,
            }}
          >
            {request.reward_name}
          </Text>

          <Text>Plant: {request.plant_id}</Text>

          <Text>Points Used: {request.points_used}</Text>

          <View
            style={{
              flexDirection: "row",
              marginTop: 10,
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: "#32702f",
                padding: 10,
                borderRadius: 8,
                marginRight: 6,
              }}
              onPress={() => approveRequest(request)}
            >
              <Text
                style={{
                  color: "#fff",
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                Approve
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: "#d32f2f",
                padding: 10,
                borderRadius: 8,
                marginLeft: 6,
              }}
              onPress={() => rejectRequest(request)}
            >
              <Text
                style={{
                  color: "#fff",
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                Reject
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))
    )}
  </View>
)}
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
    marginBottom: 15,
  },

  topRight: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconButton: {
    marginLeft: 18,
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    color: "#32702f",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 20,
  },

  plantSelector: {
    marginBottom: 18,
  },

  plantSelectorActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  plantSelectButton: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 2,
  },

  plantSelectText: {
    flex: 1,
    paddingRight: 8,
  },

  plantSelectLabel: {
    color: "#555555",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 3,
  },

  plantSelectValue: {
    color: "#1f1f1f",
    fontSize: 16,
    fontWeight: "800",
  },

  addPlantButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#32702f",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    elevation: 2,
  },

  plantInfoButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    elevation: 2,
  },

  addPlantForm: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 18,
    elevation: 2,
  },

  addPlantTitle: {
    color: "#1f1f1f",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },

  plantInput: {
    backgroundColor: "#f1f1f1",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    color: "#1f1f1f",
    fontSize: 15,
    marginBottom: 12,
  },

  addPlantActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backPlantButton: {
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#32702f",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  backPlantText: {
    color: "#32702f",
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 6,
  },

  savePlantButton: {
    height: 46,
    borderRadius: 8,
    backgroundColor: "#32702f",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  disabledPlantButton: {
    backgroundColor: "#9fb59d",
  },

  savePlantText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  plantDropdown: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    marginTop: 8,
    overflow: "hidden",
    elevation: 2,
  },

  plantOption: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  activePlantOption: {
    backgroundColor: "#e7f6e6",
  },

  plantOptionName: {
    color: "#1f1f1f",
    fontSize: 14,
    fontWeight: "700",
  },

  plantOptionId: {
    color: "#555555",
    fontSize: 12,
    marginTop: 2,
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
    alignItems: "center",
    marginBottom: 12,
  },

  cardLabel: {
    color: "#d8e6d6",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },

  powerText: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "800",
  },

  liveBadge: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#32702f",
    marginRight: 6,
  },

  liveText: {
    color: "#32702f",
    fontSize: 11,
    fontWeight: "600",
  },

  details: {
    color: "#000000",
    textAlign: "center",
    marginTop: 18,
    marginBottom: 18,
  },

  indicatorNote: {
    color: "#555555",
    textAlign: "center",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 8,
    marginBottom: 4,
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
    fontSize: 12,
  },

  error: {
    color: "#ff7070",
    textAlign: "center",
    marginTop: 10,
    fontSize: 12,
  },

  chartContainer: {
    backgroundColor: "#f7faf6",
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    overflow: "hidden",
  },

  chart: {
    borderRadius: 12,
  },
});
