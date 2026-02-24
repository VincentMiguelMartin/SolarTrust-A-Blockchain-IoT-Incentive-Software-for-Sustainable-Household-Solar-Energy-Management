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

/* THIS connects the screen to the real navigator */
type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

export default function DashboardScreen({ navigation }: Props) {
  const [solarWatts, setSolarWatts] = useState(0);
  const [lastUpdate, setLastUpdate] = useState("");
  const [error, setError] = useState("");
  const [debugUrl, setDebugUrl] = useState("");
  const [debugState, setDebugState] = useState("idle");

  useEffect(() => {
    let mounted = true;

    const loadEnergy = async () => {
      try {
        const base =
          process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.218.168.107:3000";
        setDebugUrl(`${base}/energy/sync/TTC60011`);
        setDebugState("loading");

        const data = await syncEnergy("TTC60011"); // replace with your real plantId
        if (!mounted) return;

        const solar = Number(data?.reading?.solarWatts ?? data?.latest?.sap ?? 0);
        const ts = data?.reading?.ts ?? data?.latest?.ts ?? "";

        setSolarWatts(Math.round(solar));
        setLastUpdate(ts);
        setError("");
        setDebugState("ok");
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load energy");
        setDebugState("failed");
      }
    };

    loadEnergy();
    const timer = setInterval(loadEnergy, 10000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>

      {/* TOP BAR */}
      <View style={styles.topBar}>

        {/* MENU BUTTON */}
        <TouchableOpacity onPress={() => navigation.navigate("Menu")}>
          <MaterialIcons name="menu" size={26} color="white" />
        </TouchableOpacity>

        {/* RIGHT SIDE ICONS */}
        <View style={styles.topRight}>

          {/* WALLET */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.push("Wallet")}
          >
            <Ionicons name="wallet-outline" size={24} color="white" />
          </TouchableOpacity>

          {/* STORE (CART) */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Store")}
          >
            <Ionicons name="cart-outline" size={24} color="white" />
          </TouchableOpacity>

          {/* NOTIFICATIONS */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Ionicons name="notifications-outline" size={24} color="white" />
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
            <Text style={styles.powerText}>Solar Power: {solarWatts} W</Text>
          </View>

        {/* GRAPH PLACEHOLDER */}
        <View style={styles.graphBox} />
      </TouchableOpacity>

      {lastUpdate ? <Text style={styles.meta}>Last update: {lastUpdate}</Text> : null}
      {error ? <Text style={styles.error}>IoT error: {error}</Text> : null}
      <Text style={styles.meta}>API: {debugUrl || "not set"}</Text>
      <Text style={styles.meta}>State: {debugState}</Text>

      {/* DETAILS TEXT */}
      <Text style={styles.details}>Click to view full details!</Text>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
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
    color: "#FFE100",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 20
  },

  card: {
    backgroundColor: "#f0f0f0",
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
    color: "#000",
    fontWeight: "600"
  },

  graphBox: {
    height: 160,
    backgroundColor: "#ddd",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbb"
  },

  details: {
    color: "#ffffff",
    textAlign: "center",
    marginTop: 18,
    marginBottom: 25
  },

  meta: {
    color: "#cccccc",
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

});
