import React, { useCallback, useContext, useEffect, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import FloatingBackButton from "../components/FloatingBackButton";
import { AuthContext } from "../context/AuthContext";
import { useEnergy } from "../context/EnergyContext";
import { API_BASE_URL as BASE_URL } from "../config";
import { supabase } from "../lib/supabase";

type RewardRow = {
  id?: string;
  batch_id?: string | null;
  energy_saved_kwh?: number | string | null;
  baseline_kwh?: number | string | null;
  w_time?: number | string | null;
  w_network?: number | string | null;
  w_behavior?: number | string | null;
  reward_points?: number | string | null;
  computed_at?: string | null;
};

type RewardsResponse = {
  householdId: string;
  totalPoints: number;
  history: RewardRow[];
};

function toNumber(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(value?: string | null) {
  if (!value) return "Pending timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function RewardScreen({ navigation }: any) {
  const { role } = useContext(AuthContext);
  const { selectedPlantId } = useEnergy();
  const homeRoute = role === "admin" ? "AdminDashboard" : "UserDashboard";
  const [rewardData, setRewardData] = useState<RewardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRewards = useCallback(async (isRefresh = false) => {
    const plantId = selectedPlantId.trim();
    if (!plantId) {
      setError("No plant selected. Add one from the dashboard first.");
      setRewardData(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${BASE_URL}/api/rewards/${encodeURIComponent(plantId)}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body?.error || `Rewards request failed: ${res.status}`);
      }

      setRewardData({
        householdId: body.householdId || plantId,
        totalPoints: toNumber(body.totalPoints),
        history: Array.isArray(body.history) ? body.history : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRewardData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPlantId]);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
         style={styles.iconButton}
         onPress={() => navigation.push("Menu")}
         activeOpacity={0.6}
        >
         <MaterialIcons name="menu" size={28} color="#000" />
        </TouchableOpacity>

         <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.push("Notifications")}
          activeOpacity={0.6}
        >
          <MaterialIcons name="notifications-none" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Rewards!</Text>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRewards(true)}
            tintColor="#32702f"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#32702f" />
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <MaterialIcons name="error-outline" size={32} color="#a83232" />
            <Text style={styles.stateTitle}>Unable to load rewards</Text>
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadRewards()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.cardLabel}>Verified Reward Balance</Text>
              <Text style={styles.pointsValue}>
                {(rewardData?.totalPoints ?? 0).toFixed(2)}
              </Text>
              <Text style={styles.pointsLabel}>points</Text>
              <View style={styles.householdRow}>
                <MaterialIcons name="solar-power" size={18} color="#32702f" />
                <Text style={styles.householdText}>
                  Household {rewardData?.householdId || selectedPlantId || "—"}
                </Text>
              </View>
            </View>

            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>Recent Rewards</Text>
              <Text style={styles.historyCount}>
                {rewardData?.history.length ?? 0}
              </Text>
            </View>

            {rewardData?.history.length ? (
              rewardData.history.map((item, index) => (
                <View style={styles.rewardRow} key={item.id || item.batch_id || index}>
                  <View style={styles.rewardIcon}>
                    <MaterialIcons name="verified" size={20} color="#32702f" />
                  </View>
                  <View style={styles.rewardDetails}>
                    <Text style={styles.rewardDate}>
                      {formatDate(item.computed_at)}
                    </Text>
                    <Text style={styles.rewardMeta}>
                      {toNumber(item.energy_saved_kwh).toFixed(3)} kWh saved
                    </Text>
                  </View>
                  <Text style={styles.rewardPoints}>
                    +{toNumber(item.reward_points).toFixed(2)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons name="hourglass-empty" size={28} color="#666" />
                <Text style={styles.emptyText}>No confirmed rewards yet</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={{ marginBottom: 80 }}>
        <TouchableOpacity
         style={styles.homeButton}
         onPress={() => navigation.replace(homeRoute)}
      >
        <Text style={styles.homeText}>Home</Text>
      </TouchableOpacity>

      </View>
      <FloatingBackButton />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ebeaea",
    paddingHorizontal: 20,
    paddingTop: 50,
  },

    topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15
  },

    iconButton: {
    padding: 8,
    borderRadius: 20,
  },

    title: {
    color: "#32702f",
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 10,
  },

  content: {
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 30,
  },

  centerState: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
  },

  stateCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 18,
    alignItems: "center",
    elevation: 2,
  },

  stateTitle: {
    color: "#1f1f1f",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 6,
  },

  stateText: {
    color: "#333",
    textAlign: "center",
    marginBottom: 14,
  },

  retryButton: {
    backgroundColor: "#32702f",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },

  retryText: {
    color: "#fff",
    fontWeight: "800",
  },

  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 18,
    elevation: 3,
    marginBottom: 18,
  },

  cardLabel: {
    color: "#555",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },

  pointsValue: {
    color: "#32702f",
    fontSize: 42,
    fontWeight: "900",
  },

  pointsLabel: {
    color: "#1f1f1f",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 16,
  },

  householdRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e7f6e6",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },

  householdText: {
    color: "#1f1f1f",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },

  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  sectionTitle: {
    color: "#1f1f1f",
    fontSize: 17,
    fontWeight: "800",
  },

  historyCount: {
    minWidth: 28,
    textAlign: "center",
    color: "#32702f",
    fontWeight: "900",
    backgroundColor: "#e7f6e6",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },

  rewardRow: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
  },

  rewardIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#e7f6e6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  rewardDetails: {
    flex: 1,
  },

  rewardDate: {
    color: "#1f1f1f",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 3,
  },

  rewardMeta: {
    color: "#555",
    fontSize: 12,
  },

  rewardPoints: {
    color: "#32702f",
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 10,
  },

  emptyState: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 22,
    alignItems: "center",
    elevation: 2,
  },

  emptyText: {
    color: "#333",
    fontWeight: "700",
    marginTop: 8,
  },

    homeButton: {
    alignSelf: "center",
    backgroundColor: "#32702f",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginBottom: 25, // space between Done and FloatingBackButton
    elevation: 5,
  },

  homeText: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#FFF",
  },
});
