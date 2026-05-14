import React, { useCallback, useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import FloatingBackButton from "../components/FloatingBackButton";
import { supabase } from "../lib/supabase";
import { useEnergy } from "../context/EnergyContext";
import { API_BASE_URL } from "../config";

const FREE_CLEANING_COST = 100;

export default function StoreScreen() {
  const { selectedPlantId } = useEnergy();
  const plantId = selectedPlantId.trim();
  const [points, setPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [purchasing, setPurchasing] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [purchaseStatus, setPurchaseStatus] = useState<"idle" | "success">("idle");

  const loadPoints = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      const token = session?.access_token;

      if (!token) {
        setError("Not signed in");
        setLoading(false);
        return;
      }

      if (!plantId) {
        setPoints(0);
        setLoading(false);
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/api/rewards/${encodeURIComponent(plantId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body?.error || `Failed to load points (${res.status})`);
        setLoading(false);
        return;
      }

      const total = Number(body?.totalPoints);
      setPoints(Number.isFinite(total) ? total : 0);
      setError("");
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load points");
      setLoading(false);
    }
  }, [plantId]);

  useEffect(() => {
    loadPoints();
  }, [loadPoints]);

  const performPurchase = async () => {
    if (!plantId) {
      Alert.alert("No plant selected", "Add a plant from the dashboard first.");
      return;
    }

    setPurchasing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        Alert.alert("Session expired", "Please sign in again.");
        setPurchasing(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/rewards/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          householdId: plantId,
          itemKey: "free_cleaning",
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        Alert.alert(
          "Purchase failed",
          body?.error || `Unable to redeem (${res.status})`
        );
        setPurchasing(false);
        return;
      }

      const newTotal = Number(body?.totalPoints);
      setPoints(Number.isFinite(newTotal) ? newTotal : points);
      
      // Set reference number and show success status
      const refNum = body?.referenceNumber || "N/A";
      setReferenceNumber(refNum);
      setPurchaseStatus("success");
      
      Alert.alert(
        "Request Submitted!",
        `Your free cleaning request has been submitted.\n\nReference Number: ${refNum}\n\nPlease wait for admin confirmation. You'll receive a notification once your request is approved.`
      );
    } catch (e) {
      Alert.alert(
        "Purchase failed",
        e instanceof Error ? e.message : "Unable to redeem"
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handlePurchaseFreeCleaning = () => {
    const available = points ?? 0;

    if (available < FREE_CLEANING_COST) {
      Alert.alert(
        "Not enough points",
        `You need ${FREE_CLEANING_COST} points to redeem this. You have ${available.toFixed(2)}.`
      );
      return;
    }

    Alert.alert(
      "Confirm purchase",
      `Redeem Free Cleaning for ${FREE_CLEANING_COST} points?\n\nYour balance: ${available.toFixed(2)}\nAfter purchase: ${(available - FREE_CLEANING_COST).toFixed(2)}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", style: "default", onPress: performPurchase },
      ]
    );
  };

  const canAfford = (points ?? 0) >= FREE_CLEANING_COST;

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ width: 28 }} />
        <Text style={styles.headerTitle}>Store</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* POINTS CARD */}
      <View style={styles.pointsCard}>
        <View style={styles.pointsLeft}>
          <Ionicons name="leaf-outline" size={22} color="#32702f" />
          <Text style={styles.pointsLabel}>Your Points</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#32702f" />
        ) : error ? (
          <Text style={styles.pointsError}>{error}</Text>
        ) : (
          <Text style={styles.pointsValue}>
            {(points ?? 0).toFixed(2)}
          </Text>
        )}
      </View>

      {/* PURCHASE SUCCESS CARD */}
      {purchaseStatus === "success" && referenceNumber && (
        <View style={styles.successCard}>
          <MaterialIcons name="check-circle" size={28} color="#32702f" />
          <View style={styles.successContent}>
            <Text style={styles.successTitle}>Request Submitted!</Text>
            <Text style={styles.successText}>
              Your free cleaning request is pending admin approval.
            </Text>
            <View style={styles.referenceBox}>
              <Text style={styles.referenceLabel}>Reference Number:</Text>
              <Text style={styles.referenceNumber}>{referenceNumber}</Text>
            </View>
            <Text style={styles.successNote}>
              You'll receive a notification once the admin confirms your request.
            </Text>
          </View>
        </View>
      )}

      {/* ITEMS */}
      <View style={styles.itemsArea}>
        <Text style={styles.sectionTitle}>Available</Text>

        <View style={styles.itemCard}>
          <View style={styles.itemIcon}>
            <MaterialIcons name="cleaning-services" size={28} color="#32702f" />
          </View>

          <View style={styles.itemBody}>
            <Text style={styles.itemName}>Free cleaning</Text>
            <Text style={styles.itemDescription}>
              One scheduled solar panel cleaning at no extra charge.
            </Text>
            <Text style={styles.itemCost}>{FREE_CLEANING_COST} pts</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.buyButton,
              (!canAfford || purchasing || loading) && styles.buyButtonDisabled,
            ]}
            onPress={handlePurchaseFreeCleaning}
            disabled={!canAfford || purchasing || loading}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buyButtonText}>
                {canAfford ? "Buy" : "Locked"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* BACK BUTTON */}
      <FloatingBackButton />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ebeaea",
    paddingHorizontal: 25,
    paddingTop: 60,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  headerTitle: {
    color: "#32702f",
    fontSize: 28,
    fontWeight: "bold",
  },

  pointsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 20,
  },

  pointsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  pointsLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  pointsValue: {
    color: "#32702f",
    fontSize: 22,
    fontWeight: "bold",
  },

  pointsError: {
    color: "#c0392b",
    fontSize: 13,
    maxWidth: "60%",
    textAlign: "right",
  },

  itemsArea: {
    flex: 1,
  },

  sectionTitle: {
    color: "#333",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },

  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    gap: 12,
  },

  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#eaf3ea",
    alignItems: "center",
    justifyContent: "center",
  },

  itemBody: {
    flex: 1,
  },

  itemName: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },

  itemDescription: {
    color: "#555",
    fontSize: 12,
    marginTop: 2,
  },

  itemCost: {
    color: "#32702f",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 6,
  },

  buyButton: {
    backgroundColor: "#32702f",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 72,
    alignItems: "center",
  },

  buyButtonDisabled: {
    backgroundColor: "#888",
  },

  buyButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
