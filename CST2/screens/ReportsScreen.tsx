import React, { useState } from "react";
import {
  SafeAreaView,
  Text,
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialIcons } from "@expo/vector-icons";
import FloatingBackButton from "../components/FloatingBackButton";
import { getReadingHistory } from "../services/apiService.js";

type HistoryRecord = {
  id: string;
  ts: string;
  solarWatts: number;
  gridWatts: number;
  exportWatts: number;
  powerUsageWatts: number;
  blockchainStatus?: string;
};

const PLANT_ID = "TTC60011";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(date: Date | null) {
  if (!date) return "00 / 00 / 0000";
  return date.toLocaleDateString();
}

function formatRecordTime(ts: string) {
  if (!ts) return "No timestamp";
  return new Date(ts).toLocaleString();
}

export default function ReportsScreen() {
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const onFromChange = (_: any, selectedDate?: Date) => {
    setShowFromPicker(false);
    if (selectedDate) setFromDate(selectedDate);
  };

  const onToChange = (_: any, selectedDate?: Date) => {
    setShowToPicker(false);
    if (selectedDate) setToDate(selectedDate);
  };

  const loadHistory = async () => {
    if (!fromDate || !toDate) {
      setError("Please select both From and To dates.");
      return;
    }

    if (fromDate > toDate) {
      setError("From date must be before To date.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setHasSearched(true);

      const data = await getReadingHistory(
        PLANT_ID,
        toDateInputValue(fromDate),
        toDateInputValue(toDate)
      );

      setRecords(data?.records ?? []);
    } catch (e) {
      setRecords([]);
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>History Report</Text>

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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {hasSearched && !loading && !error ? (
          <Text style={styles.resultSummary}>
            {records.length} record{records.length === 1 ? "" : "s"} found
          </Text>
        ) : null}

        <View style={styles.recordsList}>
          {records.map((record) => (
            <View key={record.id} style={styles.recordCard}>
              <Text style={styles.recordTime}>{formatRecordTime(record.ts)}</Text>

              <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Power Usage</Text>
                <Text style={styles.recordValue}>{record.powerUsageWatts} W</Text>
              </View>

              <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Solar</Text>
                <Text style={styles.recordValue}>{record.solarWatts} W</Text>
              </View>

              <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Grid</Text>
                <Text style={styles.recordValue}>{record.gridWatts} W</Text>
              </View>

              <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Export</Text>
                <Text style={styles.recordValue}>{record.exportWatts} W</Text>
              </View>

              {record.blockchainStatus ? (
                <Text style={styles.statusText}>
                  Blockchain: {record.blockchainStatus}
                </Text>
              ) : null}
            </View>
          ))}
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
    marginBottom: 40,
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
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

  resultSummary: {
    color: "#333333",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
  },

  recordsList: {
    width: "100%",
  },

  recordCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },

  recordTime: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },

  recordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },

  recordLabel: {
    color: "#f1f1f1",
    fontSize: 13,
  },

  recordValue: {
    color: "#32702f",
    fontSize: 13,
    fontWeight: "800",
  },

  statusText: {
    color: "#cfcfcf",
    fontSize: 12,
    marginTop: 5,
  },
});
