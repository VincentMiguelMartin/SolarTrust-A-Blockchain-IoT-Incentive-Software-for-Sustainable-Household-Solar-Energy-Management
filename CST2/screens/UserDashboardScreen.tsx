import React, { useEffect, useState } from "react";
import {
  Dimensions,
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LineChart } from "react-native-chart-kit";
import { RootStackParamList } from "../App";
import { useEnergy } from "../context/EnergyContext";
import { supabase } from "../lib/supabase";

type Props = NativeStackScreenProps<RootStackParamList, "UserDashboard">;

type ReportLevel = "minor" | "warning" | "urgent";

type EnergyReport = {
  level: ReportLevel;
  label: string;
  message: string;
  time: string;
  readingWatts?: number;
  previousAverageWatts?: number;
};

const normalReports: EnergyReport[] = [
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

const emptyUserPlant = { id: "", name: "No plant selected" };

type UserPlant = {
  id: string;
  name: string;
};

type AllowedPlant = {
  plant_id: string;
  label: string | null;
};

type AllowedPlantLookup = {
  plant: AllowedPlant | null;
  errorMessage: string;
};

function getPlantStorageKey(userId?: string) {
  return `userPlantId:${userId ?? "guest"}`;
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[], avg: number) {
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function buildReports(solarWatts: number, history: number[], ts: string): EnergyReport[] {
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

export default function UserDashboardScreen({ navigation }: Props) {
  const screenWidth = Dimensions.get("window").width;
  const {
    selectedPlantId,
    setSelectedPlantId,
    reading,
    usageHistory,
    powerHistory,
    lastUpdate,
    error,
    debugState,
  } = useEnergy();
  const [reports, setReports] = useState<EnergyReport[]>(normalReports);
  const [selectedReport, setSelectedReport] = useState<EnergyReport | null>(null);
  const [userPlant, setUserPlant] = useState<UserPlant>(emptyUserPlant);
  const [showAddPlantForm, setShowAddPlantForm] = useState(false);
  const [newPlantId, setNewPlantId] = useState("");
  const hasPlant = Boolean(selectedPlantId.trim() && userPlant.id);

  const loadAllowedPlant = async (
    plantId: string
  ): Promise<AllowedPlantLookup> => {
    const { data, error } = await supabase
      .from("allowed_plants")
      .select("plant_id, label")
      .eq("plant_id", plantId)
      .maybeSingle<AllowedPlant>();

    if (error) {
      console.log("Unable to load allowed plant:", error.message);
      return { plant: null, errorMessage: error.message };
    }

    return { plant: data, errorMessage: "" };
  };

  useEffect(() => {
    let active = true;
    setSelectedPlantId("");

    async function loadUserPlant() {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (profileError || !active) {
        if (profileError) {
          console.log("Unable to load profile plant:", profileError.message);
        }
        return;
      }

      const profilePlantId =
        profile?.plant_id;
      const storedPlantId = await AsyncStorage.getItem(
        getPlantStorageKey(userData.user.id)
      );
      const plantId = String(profilePlantId ?? storedPlantId ?? "").trim();

      if (!plantId) {
        setUserPlant(emptyUserPlant);
        return;
      }

      const { plant: allowedPlant } = await loadAllowedPlant(plantId);

      if (!allowedPlant || !active) {
        setUserPlant(emptyUserPlant);
        setSelectedPlantId("");
        return;
      }

      setUserPlant({
        id: allowedPlant.plant_id,
        name: allowedPlant.label || "Plant",
      });
      setSelectedPlantId(plantId);
    }

    loadUserPlant();

    return () => {
      active = false;
    };
  }, [setSelectedPlantId]);

  const handleAddPlant = async () => {
    const plantId = newPlantId.trim().toUpperCase();

    if (!plantId) {
      return;
    }

    const { plant: allowedPlant, errorMessage } = await loadAllowedPlant(plantId);

    if (!allowedPlant) {
      Alert.alert(
        "Plant ID not available",
        errorMessage
          ? `Unable to check allowed_plants: ${errorMessage}`
          : `No allowed_plants row was visible for ${plantId}. Check the plant ID or Supabase SELECT/RLS policy.`
      );
      return;
    }

    const plant = {
      id: allowedPlant.plant_id,
      name: allowedPlant.label || "Plant",
    };
    const { data: userData } = await supabase.auth.getUser();

    if (userData.user) {
      await AsyncStorage.setItem(getPlantStorageKey(userData.user.id), plantId);

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ plant_id: plantId })
        .eq("id", userData.user.id);

      if (
        updateError &&
        !updateError.message.toLowerCase().includes("schema cache")
      ) {
        Alert.alert("Unable to save plant", updateError.message);
        return;
      }
    } else {
      await AsyncStorage.setItem(getPlantStorageKey(), plantId);
    }

    setUserPlant(plant);
    setSelectedPlantId(plantId);
    setNewPlantId("");
    setShowAddPlantForm(false);
  };

  useEffect(() => {
    if (!hasPlant) {
      setReports(normalReports);
      setSelectedReport(null);
      return;
    }

    if (error) {
      setReports([
        {
          level: "urgent",
          label: "Urgent",
          message: `Energy sync failed: ${error}`,
          time: "Now",
          readingWatts: reading.solarWatts,
        },
      ]);
      setSelectedReport(null);
      return;
    }

    setReports(
      buildReports(reading.solarWatts, powerHistory.slice(0, -1), lastUpdate)
    );
    setSelectedReport(null);
  }, [error, hasPlant, lastUpdate, powerHistory, reading.solarWatts]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
              onPress={() => navigation.navigate("Notifications")}
            >
              <Ionicons name="notifications-outline" size={24} color="black" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.title}>Dashboard</Text>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => navigation.push("Statistics")}
        >
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardLabel}>Current Power Usage</Text>
              <Text style={styles.powerValue}>
                {hasPlant ? reading.powerUsageWatts : 0} W
              </Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{debugState}</Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            <LineChart
              data={{
                labels: hasPlant ? usageHistory.map((_, i) => i.toString()) : ["0"],
                datasets: [
                  {
                    data: hasPlant && usageHistory.length ? usageHistory : [0],
                  },
                ],
              }}
              width={screenWidth - 90}
              height={170}
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
              }}
              bezier
              style={styles.chart}
            />
          </View>
        </TouchableOpacity>

        <Text style={styles.details}>Click the Graph for Statistics Tab</Text>

        <View style={styles.plantSelector}>
          <View style={styles.plantDisplay}>
            <View style={styles.plantTextGroup}>
              <Text style={styles.plantLabel}>Current Plant</Text>
              <Text style={styles.plantName}>{userPlant.name}</Text>
              <Text style={styles.plantId}>
                Plant ID: {userPlant.id || "Empty"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.plantInfoButton}
              activeOpacity={0.85}
              onPress={() => {
                if (!userPlant.id) {
                  Alert.alert("Plant ID is empty", "Add your Plant ID first.");
                  return;
                }

                Alert.alert(userPlant.name, `Plant ID: ${userPlant.id}`);
              }}
            >
              <MaterialIcons name="info-outline" size={22} color="#32702f" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addPlantButton}
              activeOpacity={0.85}
              onPress={() => {
                setNewPlantId(userPlant.id);
                setShowAddPlantForm((current) => !current);
              }}
            >
              <MaterialIcons name="add" size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {showAddPlantForm ? (
            <View style={styles.addPlantForm}>
              <TextInput
                style={styles.plantInput}
                placeholder="Plant ID"
                placeholderTextColor="#777777"
                value={newPlantId}
                onChangeText={setNewPlantId}
                autoCapitalize="characters"
              />

              <TouchableOpacity
                style={[
                  styles.savePlantButton,
                  !newPlantId.trim() ? styles.disabledPlantButton : null,
                ]}
                activeOpacity={0.85}
                disabled={!newPlantId.trim()}
                onPress={handleAddPlant}
              >
                <Text style={styles.savePlantText}>Save Plant</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.reportBoard}>
          <Text style={styles.reportTitle}>Anomaly Detection Reports</Text>

          {reports.map((report, index) => (
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
                Current reading: {selectedReport.readingWatts ?? reading.solarWatts} W
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

        {error ? <Text style={styles.error}>IoT error: {error}</Text> : null}
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
    padding: 4,
  },

  title: {
    color: "#32702f",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#3d3d3d",
    borderRadius: 14,
    padding: 15,
    elevation: 4,
    marginBottom: 20,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  cardLabel: {
    color: "#d8e6d6",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },

  powerValue: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
  },

  statusBadge: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#32702f",
    marginRight: 6,
  },

  statusText: {
    color: "#32702f",
    fontSize: 11,
    fontWeight: "700",
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

  infoCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
  },

  details: {
    color: "#000000",
    textAlign: "center",
    marginTop: -4,
    marginBottom: 18,
  },

  plantSelector: {
    marginBottom: 18,
  },

  plantDisplay: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 2,
  },

  plantTextGroup: {
    flex: 1,
    paddingRight: 10,
  },

  plantLabel: {
    color: "#555555",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 3,
  },

  plantName: {
    color: "#1f1f1f",
    fontSize: 16,
    fontWeight: "800",
  },

  plantId: {
    color: "#555555",
    fontSize: 12,
    marginTop: 3,
  },

  plantInfoButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#f1f1f1",
    alignItems: "center",
    justifyContent: "center",
  },

  addPlantButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#32702f",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  addPlantForm: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
    elevation: 2,
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

  savePlantButton: {
    height: 46,
    borderRadius: 8,
    backgroundColor: "#32702f",
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

  reportActionGroup: {
    alignItems: "flex-end",
  },

  reportTime: {
    color: "#555555",
    fontSize: 11,
    fontWeight: "600",
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

  sectionTitle: {
    color: "#32702f",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  label: {
    color: "#fff",
    fontSize: 16,
  },

  value: {
    color: "#32702f",
    fontSize: 16,
    fontWeight: "bold",
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
});
