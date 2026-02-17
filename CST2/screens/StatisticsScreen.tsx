import React from "react";
import { SafeAreaView, View, Text, StyleSheet } from "react-native";
import FloatingBackButton from "../components/FloatingBackButton";

export default function StatisticsScreen() {
  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ width: 28 }} />
        <Text style={styles.headerTitle}>Statistics</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* LARGE GRAPH */}
      <View style={styles.graphCard}>
        <Text style={styles.graphTitle}>Power Usage (24 Hours)</Text>
        <View style={styles.graphPlaceholder} />
      </View>

      {/* ENERGY VALUES */}
      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Today's Energy Flow</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Solar Generated</Text>
          <Text style={styles.value}>3.42 kWh</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Grid Consumption</Text>
          <Text style={styles.value}>2.15 kWh</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Battery Storage</Text>
          <Text style={styles.value}>1.07 kWh</Text>
        </View>
      </View>

      <FloatingBackButton />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 25,
    paddingTop: 60,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 25,
  },

  headerTitle: {
    color: "#FFE100",
    fontSize: 28,
    fontWeight: "bold",
  },

  graphCard: {
    backgroundColor: "#f0f0f0",
    borderRadius: 14,
    padding: 15,
    marginBottom: 25,
  },

  sectionTitle: {
    color: "#FFE100",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },

    graphTitle: {
    color: "#000",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },

  graphPlaceholder: {
    height: 220,
    backgroundColor: "#ddd",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbb",
  },

  infoCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 18,
    marginBottom: 25,
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
    color: "#FFE100",
    fontSize: 16,
    fontWeight: "bold",
  },

});
