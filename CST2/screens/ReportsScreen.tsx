import React, { useState } from "react";
import { SafeAreaView, Text, StyleSheet, TouchableOpacity, View, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialIcons } from "@expo/vector-icons";
import FloatingBackButton from "../components/FloatingBackButton";
export default function ReportsScreen() {

  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const onFromChange = (_: any, selectedDate?: Date) => {
    setShowFromPicker(false);
    if (selectedDate) setFromDate(selectedDate);
  };

  const onToChange = (_: any, selectedDate?: Date) => {
    setShowToPicker(false);
    if (selectedDate) setToDate(selectedDate);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "00 / 00 / 0000";
    return date.toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.container}>

      <Text style={styles.title}>History Report</Text>

      {/* FROM DATE */}
      <View style={styles.dateRow}>
        <Text style={styles.label}>From</Text>

        <TouchableOpacity onPress={() => setShowFromPicker(true)}>
          <MaterialIcons name="calendar-month" size={34} color="black" />
        </TouchableOpacity>

        <View style={styles.dateBox}>
          <Text style={styles.dateText}>{formatDate(fromDate)}</Text>
        </View>
      </View>

      {/* TO DATE */}
      <View style={styles.dateRow}>
        <Text style={styles.label}>To</Text>

        <TouchableOpacity onPress={() => setShowToPicker(true)}>
          <MaterialIcons name="calendar-month" size={34} color="black" />
        </TouchableOpacity>

        <View style={styles.dateBox}>
          <Text style={styles.dateText}>{formatDate(toDate)}</Text>
        </View>
      </View>

      {/* DATE PICKERS */}
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

      <FloatingBackButton />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ebeaea",
    paddingTop: 80,
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
    marginBottom: 35,
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
});
