import React from "react";
import {
  Dimensions,
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import FloatingBackButton from "../components/FloatingBackButton";
import { useEnergy } from "../context/EnergyContext";

const screenWidth = Dimensions.get("window").width;

export default function StatisticsScreen() {
  const {
    reading,
    usageHistory,
    powerHistory,
    lastUpdate,
    error,
    debugState,
  } = useEnergy();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ width: 28 }} />
          <Text style={styles.headerTitle}>Statistics</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.graphCard}>
          <View style={styles.graphHeader}>
            <View>
              <Text style={styles.graphLabel}>Power Usage</Text>
              <Text style={styles.graphValue}>{reading.powerUsageWatts} W</Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{debugState}</Text>
            </View>
          </View>
          <View style={styles.chartContainer}>
            <LineChart
              data={{
                labels: usageHistory.map((_, i) => i.toString()),
                datasets: [
                  {
                    data: usageHistory.length ? usageHistory : [0],
                  },
                ],
              }}
              width={screenWidth - 80}
              height={220}
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
                  r: "4",
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
          <View style={styles.graphStatsRow}>
            <View style={styles.graphStat}>
              <Text style={styles.graphStatLabel}>Solar</Text>
              <Text style={styles.graphStatValue}>{reading.solarWatts} W</Text>
            </View>
            <View style={styles.graphStat}>
              <Text style={styles.graphStatLabel}>Grid</Text>
              <Text style={styles.graphStatValue}>{reading.gridWatts} W</Text>
            </View>
            <View style={styles.graphStat}>
              <Text style={styles.graphStatLabel}>Export</Text>
              <Text style={styles.graphStatValue}>{reading.exportWatts} W</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Current Energy Flow</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Power Usage</Text>
            <Text style={styles.value}>{reading.powerUsageWatts} W</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Solar Generated</Text>
            <Text style={styles.value}>{reading.solarWatts} W</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Grid Consumption</Text>
            <Text style={styles.value}>{reading.gridWatts} W</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Exported Power</Text>
            <Text style={styles.value}>{reading.exportWatts} W</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Reading Summary</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Solar Data Points</Text>
            <Text style={styles.value}>{powerHistory.length}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Usage Data Points</Text>
            <Text style={styles.value}>{usageHistory.length}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Update State</Text>
            <Text style={styles.value}>{debugState}</Text>
          </View>
        </View>

        {lastUpdate ? (
          <Text style={styles.meta}>Last update: {lastUpdate}</Text>
        ) : null}

        {error ? <Text style={styles.error}>IoT error: {error}</Text> : null}
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
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 110,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 25,
  },

  headerTitle: {
    color: "#32702f",
    fontSize: 28,
    fontWeight: "bold",
  },

  graphCard: {
    backgroundColor: "#3d3d3d",
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 16,
    marginBottom: 25,
  },

  graphHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  graphLabel: {
    color: "#d8e6d6",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },

  graphValue: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
  },

  statusBadge: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
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
    height: 236,
    backgroundColor: "#f7faf6",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    overflow: "hidden",
  },

  chart: {
    borderRadius: 12,
  },

  graphStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },

  graphStat: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    width: "31%",
  },

  graphStatLabel: {
    color: "#555555",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },

  graphStatValue: {
    color: "#32702f",
    fontSize: 14,
    fontWeight: "800",
  },

  infoCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 18,
    marginBottom: 25,
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
