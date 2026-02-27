import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
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

export default function DashboardScreen({ navigation }: Props) {
  const screenWidth = Dimensions.get("window").width;

  const [solarWatts, setSolarWatts] = useState(0);
  const [powerHistory, setPowerHistory] = useState<number[]>([]);
  const [lastUpdate, setLastUpdate] = useState("");
  const [error, setError] = useState("");
  const [debugUrl, setDebugUrl] = useState("");
  const [debugState, setDebugState] = useState("idle");

  useEffect(() => {
    let mounted = true;

    const loadEnergy = async () => {
      try {
        const base =
          process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.39:3000";
        setDebugUrl(`${base}/energy/sync/TTC60011`);
        setDebugState("loading");

        const data = await syncEnergy("TTC60011");

        console.log("FULL API RESPONSE:", JSON.stringify(data, null, 2));
        console.log("Solar from API:", data?.reading?.solarWatts);

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

        // 🔥 Update chart history (keep last 20 points)
        setPowerHistory(prev => {
          const updated = [...prev, rounded];
          if (updated.length > 20) updated.shift();
            return updated;
        });

      }

    } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load energy");
        setDebugState("failed");
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ebeaea",
    paddingHorizontal: 20,
    paddingTop: 50
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
    marginBottom: 25
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